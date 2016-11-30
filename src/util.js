const Util = {
	/**
	 * 序列化工具，将过期时间、长度校验等加入进去
	 */
	_serialize(value) {
		return JSON.stringify(value);
	},

	/**
	 * 给上面序列化的结果一层包装，增加length
	 * 增加的 length 是为了校验完整性
	 */
	serialize(value) {
		const out = this._serialize(value);
		return out.length + '|' + out;
	},

	/**
	 * 反序列化工具，将过期时间、长度校验检出
	 */
	deserialize(value) {
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
	}
};

export default Util;