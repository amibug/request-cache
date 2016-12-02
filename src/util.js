/**
 * 序列化工具，将过期时间、长度校验等加入进去
 */
const _serialize = function (value) {
	return JSON.stringify(value);
};

/**
 * 给上面序列化的结果一层包装，增加length
 * 增加的 length 是为了校验完整性
 */
const serialize = function (value) {
	const out = this._serialize(value);
	return out.length + '|' + out;
};

/**
 * 反序列化工具，将过期时间、长度校验检出
 */
const deserialize = function (value) {
	// 先剔除length字段, lf = length field
	if (value !== null) {
		try {
			value = JSON.parse(value);
		} catch (e) {
		}
		if (typeof value !== 'string') return value;

		const lf = value.match(/^(\d+?)\|/);
		if (lf !== null && lf.length === 2) {
			// matched
			const len = lf[1] * 1;
			value = value.replace(lf[0], '');
			if (len !== value.length) {
				// throw exception
				return null;
			}
			try {
				value = JSON.parse(value);
			} catch (e) {
				// throw exception
				return null;
			}
		}
	}
};

/**
 * https://github.com/gsklee/ngStorage/blob/master/ngStorage.js#L52
 *
 * When Safari (OS X or iOS) is in private browsing mode, it appears as
 * though localStorage is available, but trying to call .setItem throws an
 * exception below: "QUOTA_EXCEEDED_ERR: DOM Exception 22: An attempt was
 * made to add something to storage that exceeded the quota."
 */
const isStorageSupported = function (storage) {
	var supported = false;
	if (storage && storage.setItem) {
		supported = true;
		var key = '__' + Math.round(Math.random() * 1e7);
		try {
			storage.setItem(key, key);
			storage.removeItem(key);
		} catch (err) {
			supported = false;
		}
	}
	return supported;
};


const endOfToday = function() {
	const actualDate = new Date();
	const endOfDayDate = new Date(
			actualDate.getFullYear(),
			actualDate.getMonth(),
			actualDate.getDate(),
			23, 59, 59, 999
	);

	return endOfDayDate.getTime();
};

export  {
	serialize,
	deserialize,
	isStorageSupported,
	endOfToday
};
