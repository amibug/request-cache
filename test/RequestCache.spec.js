/* global describe,
 before, after, beforeEach, afterEach, it, localStorage */
import chai, { expect } from 'chai';
import RequestCache from '../src/index';

chai.config.showDiff = true;

describe('RequestCache', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	afterEach(() => {
		localStorage.clear();
	});

	it('will not cache if empty', () => {
		RequestCache.setCache('http://rap.alibaba-inc.com/mockjsdata/1427/api/list', {});
		expect(localStorage.length).to.equal(0);
		RequestCache.setCache('http://rap.alibaba-inc.com/mockjsdata/1427/api/list', {}, {});
		expect(localStorage.length).to.equal(0);
		RequestCache.setCache('http://rap.alibaba-inc.com/mockjsdata/1427/api/list', {}, {foo: 123});
		expect(localStorage.length).to.equal(2);
	});

	it('setCache offline will work', () => {
		RequestCache.setCache('http://rap.alibaba-inc.com/mockjsdata/1427/api/list', {
			pageNo: 1
		}, {foo: 123});
		expect(RequestCache.getCache('http://rap.alibaba-inc.com/mockjsdata/1427/api/list', {pageNo: 1})).to.deep.equal({foo: 123});
	});

	it('works on key', () => {
		RequestCache.setCache('http://rap.alibaba-inc.com/mockjsdata/1427/api/list', {dtMaxAge: 3000}, {foo: 123});
		expect(RequestCache.getCache('http://rap.alibaba-inc.com/mockjsdata/1427/api/list', {pageNo: 1})).to.deep.equal(null);
	});

	it('setCache will work on live data', () => {
		RequestCache.setCache('http://rap.alibaba-inc.com/mockjsdata/1427/api/list', {}, {
			code: 200,
			list: [{id: 100}]
		});
		expect(RequestCache.getCache('http://rap.alibaba-inc.com/mockjsdata/1427/api/list', {})).to.deep.equal({
			code: 200,
			list: [{id: 100}]
		});
	});

	it('setCache will work on live data', () => {
		RequestCache.setCache('http://rap.alibaba-inc.com/mockjsdata/1427/api/list', {dtMaxAge: -200}, {
			code: 200,
			list: [{id: 100}]
		});
		expect(RequestCache.getCache('http://rap.alibaba-inc.com/mockjsdata/1427/api/list', {})).to.deep.equal(null);
		// force read cache works
		expect(RequestCache.getCache('http://rap.alibaba-inc.com/mockjsdata/1427/api/list', {__forceToCache: true})).to.deep.equal({
			code: 200,
			list: [{id: 100}]
		});
	});

	it('identityKeyFunc for live data works', () => {
		function identityKeyFunc() {
			return 'awesome-key';
		}

		RequestCache.setCache('http://rap.alibaba-inc.com/mockjsdata/1427/api/list', {}, {
			code: 200,
			list: [{id: 100}]
		}, {identityKeyFunc});
		// identityKeyFunc wrong
		expect(RequestCache.getCache('http://rap.alibaba-inc.com/mockjsdata/1427/api/list', {})).to.deep.equal(null);
		expect(RequestCache.getCache('http://rap.alibaba-inc.com/mockjsdata/1427/api/list', {}, {identityKeyFunc})).to.deep.equal({
			code: 200,
			list: [{id: 100}]
		});
		expect(RequestCache.getCache('http://rap.alibaba-inc.com/mockjsdata/1427/api/list', {}, {
			identityKeyFunc: () => {
				return 'wrong';
			}
		})).to.equal(null);
	});


	it('setCache will update data if existed', () => {
		function identityKeyFunc() {
			return 'awesome-key';
		}

		RequestCache.setCache('http://rap.alibaba-inc.com/mockjsdata/1427/api/list', {dtMaxAge: -5000}, {foo: 'old'}, {identityKeyFunc});
		RequestCache.setCache('http://rap.alibaba-inc.com/mockjsdata/1427/api/list', {dtMaxAge: 1000}, {foo: 'new'}, {identityKeyFunc});
		expect(RequestCache.getCache('http://rap.alibaba-inc.com/mockjsdata/1427/api/list', {}, {identityKeyFunc})).to.deep.equal({foo: 'new'});
	});


	it('lru fre will work', () => {
		RequestCache.setCache('http://rap.alibaba-inc.com/mockjsdata/1427/api/list', {foo: 'old'}, {foo: 'old'});
		expect(JSON.parse(localStorage.getItem('cache_queue'))['http://rap.alibaba-inc.com/mockjsdata/1427/api/list-'+'?foo=old'].fre).to.equal(1);
		RequestCache.getCache('http://rap.alibaba-inc.com/mockjsdata/1427/api/list', {foo: 'old'});
		expect(JSON.parse(localStorage.getItem('cache_queue'))['http://rap.alibaba-inc.com/mockjsdata/1427/api/list-'+'?foo=old'].fre).to.equal(2);
		RequestCache.setCache('http://rap.alibaba-inc.com/mockjsdata/1427/api/list', {foo: 'old'}, {foo: 'old'});
		expect(JSON.parse(localStorage.getItem('cache_queue'))['http://rap.alibaba-inc.com/mockjsdata/1427/api/list-'+'?foo=old'].fre).to.equal(3);
		RequestCache.setCache('http://rap.alibaba-inc.com/mockjsdata/1427/api/list', {foo: 'new'}, {foo: 'new'});
		expect(JSON.parse(localStorage.getItem('cache_queue'))['http://rap.alibaba-inc.com/mockjsdata/1427/api/list-'+'?foo=old'].fre).to.equal(3);
	});
});
