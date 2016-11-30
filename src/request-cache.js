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
//这时候详细的日志很有必要。我们加了一个贴心的功能，在 url 上加 showLog=true 后会显示缓存命中日志



import { isFunction, isEmpty, cloneDeep } from 'lodash';
import StoregeLru from './localstore-lru';
import Util from './util';

// HACK: 当 url 中有 disableCache=true 时，禁用 localStorage
const DISABLE_CACHE = location.search.indexOf('disableCache=true') > -1;


/**
 *
 * @param {string} url
 * @param {object} params
 * @param
 * @param {object} options
 *   {func} identityKeyFunc 生成缓存标志的函数
 *   {boolean} fallbackToCache 是否开启 fallbackToCache 模式，对应 __fallbackToCache 用于请求失败读取缓存的场景。
 *   useStore 是否强制去读缓存，但还是会判断过期时间
 */
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