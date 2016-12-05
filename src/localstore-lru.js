import {deserialize, serialize} from './util';
import {isArray, isString} from 'lodash';
const storage = localStorage;

class StoregeLru {
	constructor() {
		// 最大尝试删除次数，避免无限循环；
		this._maxRetry = 20;
		// 一次删除的条数，为了加速清空；
		this._sizePerTry = 20;
		// 存储缓存数据的lru信息
		this._cache_queue = 'cache_queue';
	}

	/**
	 * @private
	 * 类似 localStorage 的 setItem，只是支持对象，自动序列化
	 */
	setItem(key, val) {
		if (val === undefined) {
			return this.remove(key);
		}

		storage.setItem(key, serialize(val));
		return val;
	}

	/**
	 * @private
	 * 类似 localStorage 的 getItem，只是支持对象，自动序列化
	 */
	getItem(key) {
		return deserialize(storage.getItem(key));
	}

	/**
	 * @public
	 * @param key
	 * @param value
	 * @param force
	 * @returns {*}
	 */
	set(key, value, force = true) {
		try {
			this.setItem(key, value);
			this.setQueue(key);
			return value;
		} catch (e) {
			if (force) {
				// 开始强制写入
				let max = this._maxRetry;   // 最大尝试删除的次数
				while (max > 0) {
					max--;
					const qkeys = this.getLruQueueKeys(this._sizePerTry);
					if (qkeys.length > 0) {
						this.removeQueue(qkeys);
						qkeys.forEach((qkey) => {
							this.remove(qkey)
						});
						if (this.set(key, value, false) !== null) {
							return value;
						}
					}
				}
				if (max === 0) {
					// 超过了尝试次数还是不够用，则抛出异常
					console.error(e);
					throw e;
				}
			}
			return null;
		}
	}

	/**
	 * @public
	 * @param key
	 * @returns {*}
	 */
	get(key) {
		if (key == null)
			return null;

		const value = this.getItem(key);
		if (value != null) {
			this.setQueue(key);
		}
		return value;
	}

	/**
	 * @public
	 * @param key
	 */
	remove(key) {
		if (key == null)
			return;
		storage.removeItem(key);
		this.removeQueue(key);
	}


	/**
	 * 清空缓存
	 */
	clear() {
		storage.clear();
		this.removeQueue();
	}


	/**
	 * private
	 * lru策略
	 * @param key
	 */
	setQueue(key) {
		const cacheQueue = this.getItem(this._cache_queue) || {};
		const current = cacheQueue[key];
		if (current == null) {
			cacheQueue[key] = {};
			//cacheQueue[key].key = key;
			cacheQueue[key].fre = 1; // 初始化使用频率为1
			cacheQueue[key].time = Date.now();
		} else {
			cacheQueue[key].fre++;
			cacheQueue[key].time = Date.now();
		}

		this.setItem(this._cache_queue, cacheQueue);
	}

	/**
	 * 删除lru策略数据,支持批量
	 * @param key
	 */
	removeQueue(key) {
		let cacheQueue = this.getItem(this._cache_queue) || {};
		if (isArray(key)) {
			key.forEach((k)=> {
				if (cacheQueue[k] == null) return;
				delete cacheQueue[k];
			})
		}
		if (isString(key)) {
			if (cacheQueue[key] == null) return;
			delete cacheQueue[key];
		}
		if (key == null) {
			cacheQueue = {};
		}
		this.setItem(this._cache_queue, cacheQueue);
	}

	// 返回最近最少使用的size个queue
	getLruQueueKeys(size) {
		const cacheQueue = this.getItem(this._cache_queue) || {};
		// 从高到低排序
		// 清理时我们根据频率的使用fre标志，fre最小的优先清理，同时相同的fre，我们优先清理time比较小的
		const keys = Object.keys(cacheQueue).sort((a, b)=> {
			const AQueue = cacheQueue[a];
			const BQueue = cacheQueue[b];
			return BQueue.fre == AQueue.fre ? BQueue.time - AQueue.time : BQueue.fre - AQueue.fre;
		});

		const ret = keys.length < size
			? keys
			: keys.slice(keys.length - size);
		return ret;
	}
}


export default StoregeLru;