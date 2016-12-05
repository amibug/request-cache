//缓存的 key 里仅包括 url 和 params，这样是为了可以同时缓存不同 params 的结果
//value 中放入 _identityKey 来标记缓存是否变化，其中有当前 userId 用于保证切换用户后缓存过期。数据更新时间保证数据更新后自动过期。
//同时使用了 _expireAt 和 _deleteAt 两个时间。其中 _expireAt 来标记数据什么时候过期，_deleteAt 来标记什么时候删除缓存数据。
//这样是为了实现接口报错后读取缓存的目的。如把支付金额的 _expireAt 设置为 5 秒钟，_deleteAt 设置为当天结束 23:59:59。
//这样就可以防止用户疯狂刷新页面。因为在 5 秒内的刷新都不会再发请求，超过5秒后才会发请求。如果两个小时后接口报错，就会读取当天已过期但还没删除的数据。
//虽然数据延迟的问题无法解决，但保证了页面能正常访问。
//缓存会阻止发送请求，因此遇到页面数据错误的时候，很难确定是缓存问题，还是 JS 逻辑问题，缓存是最容易“背黒锅”的。
//这时候详细的日志很有必要。我们加了一个贴心的功能，在 url 上加 showLog=true 后会显示缓存命中日志


import { isFunction, isEmpty, cloneDeep } from 'lodash';
import StoregeLru from './localstore-lru';
import { endOfToday } from './util';

// HACK: 当 url 中有 disableCache=true 时，禁用 localStorage
const DISABLE_CACHE = location.search.indexOf('disableCache=true') > -1;
// HACK: 当 url 中有 showLog=true 时，显示命中日志
const SHOW_LOG = location.search.indexOf('showLog=true') > -1;

// 约定以下参数自动过滤掉
const skipStoreParams = [
	'dtMaxAge', 'dtExpireTime', 'callback', 'sycmToken', 'ctoken', 'token', 't', '_', '_t'
];

// 存储的 key 名
const DATA_KEY = '_data';   // 实际数据
const EXPIRE_KEY = '_expireTime'; // 过期时间
const DELETE_KEY = '_deleteTime'; // 过期后删除时间
const IDENTITY_KEY = '_id'; // 惟一性 key


/**
 * 从 params 对象中去除 skipedKeys 和以双下划线__开头的 key，对参数进行排序
 * 返回一个新对象
 */
function stripParams(params = {}, skipedKeys = []) {
	return Object.keys(params).sort().filter(key => {
		return key.indexOf('__') === -1 && skipedKeys.indexOf(key) === -1;
	}).reduce((result, key) => {
		result[key] = params[key];
		return result;
	}, {});
}

/**
 * protocol :// host : port pathname hash
 * 拼接 params 到 url
 * @param {String} url 原始 url，可包含 param 和 hash,一般异步请求不考虑hash
 *        http://xxxx.com/index#!/steps?step=1
 *        http://xxxx.com/index?step=1#!/steps
 * @param {Object} params 参数
 * @param {disableCache} disableCache 是否禁用缓存，默认为 false，如果禁用 需要在 params 结尾加上 _=timestamp
 */
const _generateCacheKey = function (url, params = {}) {
	let urlPath = url,
		paramsPart = '';
	Object.keys(params).forEach((key) => {
		paramsPart += `&${key}=${params[key]}`;
	});

	if (paramsPart.length > 0) paramsPart = paramsPart.replace(/^&/, '?');

	return [urlPath, paramsPart].join('-');
};

/**
 * 生成缓存的 key
 */
function generateCacheKey(url, params = {}) {
	// 这里的 url 里也可能有参数，需要和 params 进行合并，找到直接的 pathname 和 params 部分
	if (url.indexOf('?') === -1) {
		return _generateCacheKey(url, stripParams(params, skipStoreParams));
	} else {
		const mergedParams = cloneDeep(params);
		const [urlPart, paramsPart] = url.split('?');

		// merge
		paramsPart.split('&').forEach((paramsStr) => {
			const [k, v] = paramsStr.split('=');
			mergedParams[k] = v;
		});
		return _generateCacheKey(urlPart, stripParams(mergedParams, skipStoreParams));
	}
}


// 根据 params 来计算过期时间
function generateCacheExpire(params) {
	// 如果只设置了 dtExpireTime，则把过期时间 dtExpireTime，优先级最高
	if (params.dtExpireTime != null) {
		return params.dtExpireTime;
	}

	// 如果只设置了 dtMaxAge，则过期时间为当前时间 + dtMaxAge
	if (params.dtMaxAge != null && params.dtExpireTime == null) {
		return params.dtMaxAge + Date.now();
	}
	return endOfToday();
}

/**
 * 设置缓存，data 可以为数据或对象
 * @param {string} url
 * @param {object} params
 * @param {object} data 要缓存的数据
 */
function setCache(url, params = {}, data, options = {}) {
	const { identityKeyFunc } = options;
	// 禁用缓存或数据为空时不缓存
	if (DISABLE_CACHE || params.__disableCache || isEmpty(data)) {
		return;
	}
	try {
		let expireTime, deleteTime;

		expireTime = generateCacheExpire(params);
		deleteTime = expireTime;

		const key = generateCacheKey(url, params);
		StoregeLru.set(
			key,
			{
				[DATA_KEY]: data,
				[EXPIRE_KEY]: expireTime,
				[DELETE_KEY]: deleteTime,
				[IDENTITY_KEY]: isFunction(identityKeyFunc) ? identityKeyFunc(url, params) : ''
			},
			true
		);
	} catch (e) {
		console.log(e);
	}
}

/**
 * 读取缓存，不存在则返回 null
 * @param {string} url
 * @param {object} params
 * @param {object} options
 *   {func} identityKeyFunc 生成缓存标志的函数
 * @returns {*}
 */
function getCache(url, params = {}, options = {}) {
	// 以下参数放在url中无效
	const {
		// 强制使用cache, 用于请求失败读取缓存的场景。
		__forceToCache = false,
		// 启用日志命中log
		__showLog = false,
		// 禁用cache
		__disableCache =  false
		} = params;

	const { identityKeyFunc } = options;

	// 禁用缓存则直接返回
	if (DISABLE_CACHE || __disableCache) {
		return null;
	}

	try {
		const key = generateCacheKey(url, params);
		const storeData = StoregeLru.get(key);
		const identityKey = isFunction(identityKeyFunc) ? identityKeyFunc(url, params) : '';

		if (!storeData)
			return null;
		if (storeData && storeData[DATA_KEY]) {
			if (identityKey !== storeData[IDENTITY_KEY]) { // identityKey 变化，返回空,用于区分不同用户的缓存数据
				return null;
			}
			if (__forceToCache) { // 强制读取时不检查是否过期，直接返回
				if (__showLog) {
					console.log(`[Request Cache Return] url: ${url}, parameter: ${JSON.stringify(params)}, result:${JSON.stringify(storeData[DATA_KEY])}`);
				}
				return storeData[DATA_KEY];
			}
			if (storeData[EXPIRE_KEY] >= Date.now()) { // 检查是否过期
				if (__showLog) {
					console.log(`[Request Cache Return] url: ${url}, parameter: ${JSON.stringify(params)}, result:${JSON.stringify(storeData[DATA_KEY])}`);
				}
				return storeData[DATA_KEY];
			} else {
				StoregeLru.remove(key);
				return null;
			}
		}
		return null;
	} catch (e) {
		console.error(e);
	}
	return null;
}

/**
 * 删除缓存
 */
function removeCache(url, params) {
	StoregeLru.remove(generateCacheKey(url, params));
}


export {
	setCache, getCache, removeCache,
	generateCacheKey
};