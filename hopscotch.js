/*
	  Copyright 2011 PraizedMedia Inc.
	  License: Pending Review...
	  Author: Francois Lafortune
*/
 (function() {
     var FourSquare = {
         endpoints: {
             users: {
                 methods: {
                     search: ['phone', 'email', 'twitter', 'twitterSource', 'fbid', 'name'],
                     requests: []
                 },
                 aspects: {
                     badges: [],
                     checkins: ['limit', 'offset', 'afterTimestamp', 'beforeTimestamp'],
                     friends: [],
                     tips: ['sort', 'll'],
                     todos: ['sort', 'll'],
                     venuehistory: [],
                 },
                 // actions: {
                 //     request: [],
                 //     unfriend: [],
                 //     approve:[],
                 //     deny:[],
                 //     setpings: ['value']
                 // },
             },
             venues: {
                 methods: {
                     add: ['name', 'address', 'crossStreet', 'city', 'state', 'zip', 'phone', 'll', 'primaryCategoryId'],
                     categories: [],
                     search: ['ll', 'llAcc', 'alt', 'altAcc', 'query', 'limit', 'intent']
                 },
                 aspects: {
                     herenow: [],
                     tips: ['sort']
                 },
                 // actions: {
                 //     marktodo: ['text'],
                 //     flag: ['problem:mislocated|closed|duplicate'],
                 //     proposeedit: ['name','address','crossStreet','city','state','zip','phone','ll','primaryCategoryId'],
                 // },
             },
             checkins: {
                 methods: {
                     add: ['venueId', 'venue', 'shout', 'broadcast', 'll', 'llAcc', 'alt', 'altAcc'],
                     recent: ['ll', 'limit', 'offset', 'afterTimestamp']
                 },
                 // actions: {
                 //     addcomment: ['text'],
                 //     deletecomment: ['commentId']
                 // },
             },
             tips: {
                 methods: {
                     add: ['venueId', 'text', 'url'],
                     search: ['ll', 'limit', 'offset', 'filter', 'query']
                 },
                 // actions: {
                 //     marktodo: [],
                 //     markdone:[],
                 //     unmark:[]
                 // },
             },
             photos: {
                 methods: {
                     add: ['checkingId', 'tipId', 'venueId', 'broadcast', 'll', 'llAcc', 'alt', 'altAcc']
                 }
             },
             settings: {
                 methods: {
                     all: []
                 },
                 // actions: {
                 //     set: ['value']
                 // },
             },
             badges: {},
             mayorships: {}
         }
     };
     
	/* 
		Fake sessionStorage() by storing token in cookie if no sessionStorage
		(used by session obj)
	*/
	if (typeof sessionStorage !== 'object') {
		var sessionStorage = {
			setItem: function(name, value) {
				document.cookie = name + "=" + value + "; path=/";
				return value;
			},
			getItem: function(name) {
				var nameEQ = name + "=";
				var ca = document.cookie.split(';');
				for (var i = 0; i < ca.length; i++) {
					var c = ca[i];
					while (c.charAt(0) == ' ') c = c.substring(1, c.length);
					if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);
				}
				return null;
			},
			removeItem: function(name) {
				sessionStorage.setItem(name, '')
			}
		}
	};
	/* 
		Utilities 
		=========
	*/
	// add "s" to string doesnt already end in "s"
	function sing(str) {
		return str.replace(/s$/, '')
	};
	// capitalize first char
	function caps(str) {
		return str.charAt(0).toUpperCase() + str.slice(1);
	};
	// capitalize an remove last "s" for syntax fancy
	function oname(str) {
		return caps(sing(str))
	};
	// decorate fousquare responses
	function decorate(type, obj, parent) {
		var typeKlass = oname(type);
		if (typeof obj !== 'string' && typeof Hopscotch[typeKlass] !== 'undefined') {
			if (typeof obj.count !== 'undefined') {
                var objects = [];			    
				if (obj.count > 0 && obj.items) {
					$.each(obj.items,
					function(i) {
						objects.push(new Hopscotch[typeKlass](obj.items[i]))
					});
				};
				if (parent) parent[type + 'Count'] = obj.count;
				return objects;

			} else return new Hopscotch[typeKlass](obj);
		};
		return obj
	};
	/*
		Core
		====
	*/
	var Session = {
		getToken: function() {
			var token = sessionStorage.getItem('hopscotch_foursquare_token');
			if (token === 'null') return null;
			return token
		},
		setToken: function(value) {
			return sessionStorage.setItem('hopscotch_foursquare_token', value);
		},
		clearToken: function() {
			return sessionStorage.removeItem('hopscotch_foursquare_token');
		},
		initialize: function() {
			var tokRE = /\#?access_token\=(.+)/;
			var token = window.location.hash.match(tokRE);
			token = token ? [token[1], (window.location.hash = '')][0] : Session.getToken();
			Session.setToken(token);
		}
	};
	var Fetcher = {
		cache: {},
		fetch: function() {
			var fargs = Fetcher.swapargs(arguments);
			var url = 'https://api.foursquare.com/v2/' + fargs.path;
			var ctx = this;
			if (Fetcher.cache[url]) return fargs.callback.call(ctx, fetch.cache[url]);
			$.getJSON(url + '?callback=?', fargs.params,
			function(json) {
				if (json.meta.code !== 200) throw json.meta.code + ' ' + json.meta.errorDetail;
				$.each(json.response,
				function(k, obj) {
					if (k !== 'groups') {
						json.response[k] = decorate(k, obj)
					} else {
						$.each(json.response.groups,
						function(i) {
							$.each(json.response.groups[i].items,
							function(k, item) {
								json.response.groups[i].items[k] = decorate('venues', item)
							});
						})
					}
				});
				Fetcher.cache[url] = json.response;
				fargs.callback.call(ctx, json.response);
			});
		},
		swapargs: function(args) {
			var args = Array.prototype.slice.call(args);
			var swap = {
				callback: $.noop,
				params: {
					oauth_token: Session.getToken()
				}
			};
			if (typeof args[args.length - 1] === 'function') swap.callback = args.pop();
			if (typeof args[args.length - 1] === 'object') $.extend(swap.params, args.pop());
			swap.path = args.join('/');
			return swap;
		}
	};
	
	var Hopscotch = {
		getCurrentUser: function(after) {
			var token = Session.getToken();
			if (!token) return after(null);
			else {
				if (Hopscotch.currentUser) return after(Hopscotch.currentUser);
				Fetcher.fetch.call(Hopscotch, 'users', 'self',
				function(json) {
					Hopscotch.currentUser = json;
					after(json);
				});
			};
			return $.hopscotch;
		},
		startSession: function() {
			window.location.href = "https://foursquare.com/oauth2/authenticate?client_id=" + Hopscotch.clientId + "&response_type=token&redirect_uri=http://127.0.0.1/hs"
		},
		endSession: function() {
			Session.clearToken();
			window.location.hash = '';
			window.location.reload(true)
		},
		signInButton: function(el) {
		    var holder = $(el||document.body);
            return $('<a class="hopscotch-sign-in-button" href="#">click to connect to foursquare</a>').bind('click', $.hopscotch.startSession).appendTo(holder)
		},
		signOutButton: function(el) {
		    var holder = $(el||document.body);		    
            return 	$('<a class="hopscotch-sign-out-button" href="#">click to disconnect from foursquare</a>').bind('click',$.hopscotch.endSession).appendTo(holder)
		}
	};
	
	/*
		Meta
		====
	*/
	$.each(FourSquare.endpoints,
	function(endpoint) {
		var klass = oname(endpoint);
		// this dark-magic fancyness helps me debug in console. Not the best approach but works.
		Hopscotch[klass] = (new Function('decorate', 'return function Hopscotch' + klass + '( data ) { for(var k in data){this[k] = decorate(k, data[k], this)}}'))(decorate)
		for (var method in FourSquare.endpoints[endpoint].methods) {
			var getterName = method;
			Hopscotch[klass][method] = FourSquare.endpoints[endpoint].methods[method].length === 0 ?
			function(callback) {
				Fetcher.fetch.call(this, endpoint, method, params, callback);
			}:
			function(params, callback) {
				Fetcher.fetch.call(this, endpoint, method, params, callback);
			};
		};
		for (var aspect in FourSquare.endpoints[endpoint].aspects) {
			var getterName = 'get' + caps(aspect);
			Hopscotch[klass].prototype[getterName] = FourSquare.endpoints[endpoint].aspects[aspect].length === 0 ?
			function(callback) {
				Fetcher.fetch.call(this, endpoint, this.id, aspect, callback);
			}:
			function(params, callback) {
				Fetcher.fetch.call(this, endpoint, this.id, aspect, params, callback);
			};
		};
		Hopscotch[klass].prototype['get'] = function(callback) {
			Fetcher.fetch.call(this, endpoint, this.id, callback);
		};
		if(typeof $.template === 'function'){
            Hopscotch[klass].prototype['render'] = function( receive ) {
                var instance = this;
                var render = function() {
                    if(instance.rendered) $(receive).append(instance.rendered);
                    else{
                        var tsel = '#'+klass.toLowerCase()+'-template';
                        console.debug(instance)
                        $(tsel ).tmpl(instance).appendTo( receive )
                    }
                };
                if(!$('#hopscotch-templates').is('div')) return $('<div id="hopscotch-templates">').hide().load('templates.html', render ).appendTo(document.body);
                else render();
        	};	    
		};

	});

	/*
		Initialize
		==========
	*/
	Session.initialize();
    
	// Expose
	$.extend({
		hopscotch: function(key, readyCallback) {
			if (typeof key !== 'string') throw "Must provide client Id";
			if (!Hopscotch.clientId) {
			    Hopscotch.clientId = key;
				$.extend({
					hopscotch: $({}).extend(Hopscotch)
				});
			};
			setTimeout(function() {
				! ($.isFunction(readyCallback)) || $.hopscotch.bind('ready', readyCallback);
				$.hopscotch.trigger('ready', [$.hopscotch]);
			});
		}
	});

})();
