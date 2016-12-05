
const _serialize = function (value) {
	return JSON.stringify(value);
};

/**
 * 序列化工具，将过期时间、长度校验等加入进去
 */
const serialize = function (value) {
	return JSON.stringify(value);
};

/**
 * 反序列化工具，将过期时间、长度校验检出
 */
const deserialize = function (value) {
	value = JSON.parse(value);
	return value;
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

export {
	serialize,
	deserialize,
	isStorageSupported,
	endOfToday
};
