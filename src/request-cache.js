/* global location */
/**
 * @file 请求缓存类
 * URL 中添加 disableCache=true 可以全局禁用缓存。
 * 任何接口都会先尝试读取缓存，如果读到且没有过期，则使用，过期了才发请求
 * 如何判断过期：
 *   离线数据：identityKey 中添加通信表日期
 *   实时数据：identityKey 中也有通信表日期，如果变化也会过期
 * params 中字段解析：
 *   '__fallbackToCache', default false。设置 true 后缓存永不过期，但内部保留一个 expire 来判断是否过期
 *   dtMaxAge, dtUpdateTime, dtExpireTime 三种设置缓存时长的方式
 * @author 会影
 *
 *
 */

//缓存的 key 里仅包括 url 和 params，这样是为了可以同时缓存不同 params 的结果。而且当 url 和 params 相同时，如果再发请求，就会自动覆盖之前的缓存；
//value 中放入 _identityKey 来标记缓存是否变化，其中有当前 userId 用于保证切换用户后缓存过期。数据更新时间保证数据更新后自动过期。还有 storeVersion 是页面埋点的方式传给前端，来标记缓存缓存，变化后，缓存自动过期。
//同时使用了 _expireAt 和 _deleteAt 两个时间。其中 _expireAt 来标记数据什么时候过期，_deleteAt 来标记什么时候删除缓存数据。
//这样是为了实现接口报错后读取缓存的目的。如把支付金额的 _expireAt 设置为 5 秒钟，_deleteAt 设置为当天结束 23:59:59。
//这样就可以防止用户疯狂刷新页面。因为在 5 秒内的刷新都不会再发请求，超过5秒后才会发请求。如果两个小时后接口报错，就会读取当天已过期但还没删除的数据。
//虽然数据延迟的问题无法解决，但保证了页面能正常访问。


//缓存会阻止发送请求，因此遇到页面数据错误的时候，很难确定是缓存问题，还是 JS 逻辑问题，缓存是最容易“背黒锅”的。
//这时候详细的日志很有必要。我们加了一个贴心的功能，在 url 上加 showLog=true 后会显示缓存命中日志


import { isFunction, isEmpty, cloneDeep } from 'lodash';
import StoregeLru from './localstore-lru';
import {serialize, deserialize, endOfToday} from './util';

// HACK: 当 url 中有 disableCache=true 时，禁用 localStorage
const DISABLE_CACHE = location.search.indexOf('disableCache=true') > -1;
// HACK: 当 url 中有 showLog=true 时，显示命中日志
const SHOW_LOG = location.search.indexOf('showLog=true') > -1;

// 约定以两个下划线结尾的自动过滤掉
const skipStoreParams = [
	'dtUpdateTime', 'dtMaxAge', 'dtExpireTime', 'callback', 'sycmToken', 'ctoken', 'token', 't', '_', '_t',
];

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
 * 拼接 params 到 url
 * @param {String} url 原始 url，可包含 param 和 hash
 * @param {Object} params 参数
 * @param {disableCache} disableCache 是否禁用缓存，默认为 false，如果禁用会在 params 结尾加上 _=timestamp
 */
const _generateCacheKey = function (url, params = {}) {
	let urlWithParams, urlPath, paramsPart, hashPart;
	urlPath = paramsPart = hashPart = '';
	if (url.indexOf('#') > 0) {
		hashPart = url.substring(url.indexOf('#'), url.length);
		urlWithParams = url.substring(0, url.indexOf('#'));
	} else {
		urlWithParams = url;
	}

	if (urlWithParams.indexOf('?') > 0) {
		urlPath = urlWithParams.substring(0, url.indexOf('?'));
		paramsPart = urlWithParams.substring(urlWithParams.indexOf('?'), urlWithParams.length);
	} else {
		urlPath = urlWithParams;
	}

	Object.keys(params).forEach((key) => {
		paramsPart += `&${key}=${params[key]}`;
	});

	if (paramsPart.length > 0) paramsPart = paramsPart.replace(/^&/, '?');

	return [urlPath, paramsPart, hashPart].join('-');
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
			if (mergedParams[k] === undefined) {
				mergedParams[k] = v;
			}
		});
		return _generateCacheKey(urlPart, stripParams(mergedParams, skipStoreParams));
	}
}

/**
 * 读取缓存，不存在则返回 null
 * @param {string} url
 * @param {object} params
 * @param {object} options
 * @returns {*}
 */
function getCache(url, params = {}, options = {}) {
	const { identityKeyFunc, fallbackToCache } = options;
	// 禁用缓存则直接返回
	if (DISABLE_CACHE || params.__disableCache) {
		return null;
	}

	try {
		const key = generateCacheKey(url, params);

		// 这里如果缓存过期，storex 会自动删除它
		const storeData = storex.get(key);
		const identityKey = isFunction(identityKeyFunc) ? identityKeyFunc(url, params) : '';

		if (storeData && storeData[DATA_KEY]) {
			if (identityKey !== storeData[IDENTITY_KEY]) { // identityKey 变化，返回空
				return null;
			}
			if (fallbackToCache) { // 强制读取时不检查是否过期，直接返回，对应于 __fallbackToCache
				return storeData[DATA_KEY];
			}
			if (storeData[EXPIRE_KEY] >= Date.now()) { // 检查是否过期
				return storeData[DATA_KEY];
			}
		}

		return null;
	} catch (e) {
		console.error(e);
	}
	return null;
}