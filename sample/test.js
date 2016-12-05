/**
 * Created by wuyuedong on 16/12/5.
 */

define('test', ['jquery', 'RequestCache'], function($, RequestCache){
	var cache = RequestCache.default;
	$.get('http://rap.alibaba-inc.com/mockjsdata/1427/api/list').then(function(data){
		for(var i=0, l=10; i<l; i++){
			cache.setCache('http://rap.alibaba-inc.com/mockjsdata/1427/api/list', {No: i}, data);
		}
	})
})