/*
 *  core library abstraction (YUI2)
 */

var Y = YAHOO;
var YUID = Y.util.Dom;

TwentyC.cla = {
  _name : "YUI2"
}

/*
 * Environment
 */

TwentyC.cla.Env = {
  ua : {
    ie : Y.env.ua.ie
  }
}

/*
 * Color
 */

TwentyC.cla.Color = {
  hex2rgb : function(v) {
    return Y.util.Color.hex2rgb(v);
  },
  rgb2hex : function(r,g,b) {
    return Y.util.Color.rgb2hex(r,g,b);
  }
}

/*
 * Events
 */

TwentyC.cla.Event = { 
  addListener : function(el, name, fn, param) {
    return Y.util.Event.addListener(el, name, fn, param);
  },
  removeListener : function(el, name, fn) {
    return Y.util.Event.removeListener(el, name, fn);
  },
  on : function(node, name, fn) {
    return Y.util.Event.on(node, name, fn);
  },
  stopEvent : function(e) {
    return Y.util.Event.stopEvent(e);
  },
  getXY : function(e) {
    return Y.util.Event.getXY(e);
  },
  getPageX : function(e) {
    return Y.util.Event.getPageX(e);
  },
  getPageY : function(e) {
    return Y.util.Event.getPageY(e);
  },
  getCharCode : function(e) {
    return Y.util.Event.getCharCode(e);
  }
}

/*
 * Event Handler
 */

if(Y.util.CustomEvent) {
  Y.util.CustomEvent.prototype.notify_20c = Y.util.CustomEvent.prototype.notify;
  Y.util.CustomEvent.prototype.notify = function() {
    this.notify_20c.apply(this, arguments);
    if(this.lastError && TwentyCError) {
      TwentyCError.Log(this.lastError, true);
    }
  }
}
TwentyC.cla.EventHandler = function(name) {
  this.name = name
  this._event = new Y.util.CustomEvent;
};

TwentyC.cla.EventHandler.prototype.subscribe = function(fn, payload) {
  this._event.subscribe(fn, payload);
}

TwentyC.cla.EventHandler.prototype.unsubscribe = function(fn, payload) {
  this._event.unsubscribe(fn, payload);
}

TwentyC.cla.EventHandler.prototype.fire = function(args) {
  this._event.fire(args);
}

/*
 * Stylesheet
 */

TwentyC.cla.StyleSheet = function(node) {
  this._stylesheet = new Y.util.StyleSheet;
}

TwentyC.cla.StyleSheet.prototype.set = function(sel, css) {
  this._stylesheet.set(sel, css);
}

TwentyC.cla.StyleSheet.prototype.disable = function() {
  this._stylesheet.disable();
}

TwentyC.cla.StyleSheet.prototype.enable = function() {
  this._stylesheet.enable();
}

/*
 * Number operations
 */

TwentyC.cla.Number = {
  /*
   * valid config attributes:
   *
   *   - thousandsSeparator (str)
   */
  format : function(n, config) {
    return Y.util.Number.format(n, config);
  }
}

/*
 * Various widgets (FIXME: abstract properly)
 */


// only needed for colorpicker and calendar widgets 
TwentyC.cla.Dialog = Y.widget.Dialog

TwentyC.cla.ColorPicker = Y.widget.ColorPicker
TwentyC.cla.Calendar = Y.widget.Calendar
TwentyC.cla.Slider = Y.widget.Slider

TwentyC.cla.Menu = function(id, config) {
  this._menu = new Y.widget.Menu(id, config);
  this.cfg = this._menu.cfg;
}
TwentyC.cla.Menu.prototype.clearContent = function() {
  return this._menu.clearContent();
}
TwentyC.cla.Menu.prototype.getRoot = function() {
  return this._menu.getRoot();
}
TwentyC.cla.Menu.prototype.getItem = function(index) {
  return this._menu.getItem(index);
}
TwentyC.cla.Menu.prototype.getItems = function() {
  return this._menu.getItems();
}
TwentyC.cla.Menu.prototype.addItem = function(item) {
  return this._menu.addItem(item);
}
TwentyC.cla.Menu.prototype.addItems = function(items) {
  return this._menu.addItems(items);
}
TwentyC.cla.Menu.prototype.render = function(toNode) {
  return this._menu.render(toNode);
}
TwentyC.cla.Menu.prototype.show = function() {
  return this._menu.show();
}
TwentyC.cla.Menu.prototype.hide = function() {
  return this._menu.hide();
}
TwentyC.cla.Menu.prototype.removeItem = function(item) {
  return this._menu.removeItem(item);
}
TwentyC.cla.Menu.prototype.getPosition = function() {
  var cfg = this._menu.cfg.getConfig();
  return {
    x : cfg.x,
    y : cfg.y
  }
}
TwentyC.cla.Menu.prototype.getSubmenus = function() {
  return this._menu.getSubmenus()
}
TwentyC.cla.Menu.prototype.setSubMenu = function(itemIndex, menu) {
  this._menu.getItem(itemIndex).cfg.setProperty("submenu", menu._menu);
}

TwentyC.cla.ContextMenu = function(id, config) {
  this._menu = new Y.widget.ContextMenu(id, config);
  this.triggerContextMenuEvent = new TwentyC.cla.EventHandler("triggerContextMenu");
  this._menu.triggerContextMenuEvent.subscribe(function(e,d,me) {
    me.triggerContextMenuEvent.fire(d[0]);
  }, this);
  
}
TwentyC.cla.ContextMenu.prototype = TwentyC.cla.Menu.prototype;

// This is replaced by TwentyC.widget.HTML5.UI_Tabs
// However leaving it here for backwards support for the time being
TwentyC.cla.TabView = Y.widget.TabView
TwentyC.cla.Tab = Y.widget.Tab

/*
 * IO
 */

TwentyC.cla.XHR = {
  isCallInProgress : function(req) {
    return Y.util.Connect.isCallInProgress(req);
  },
  abort : function(req) {
    return Y.util.Connect.abort(req);
  },
  send : function(method, url, handlers, arg) {
    Y.util.Connect.asyncRequest(method, url, handlers, arg); 
  }
}

/*
 * Dom manipulation
 */

TwentyC.cla.Dom = {
  get : function(node) {
    return YUID.get(node);
  },
  hasClass : function(el, cls) {
    return YUID.hasClass(el, cls);
  },
  addClass : function(el, cls) {
    return YUID.addClass(el, cls);
  },
  removeClass : function(el, cls) {
    return YUID.removeClass(el, cls);
  },
  getRegion : function(el) {
    return YUID.getRegion(el);
  },
  getViewportWidth : function() {
    return YUID.getViewportWidth();
  },
  getViewportHeight : function() {
    return YUID.getViewportHeight();
  },
  getDocumentScrollTop : function() {
    return YUID.getDocumentScrollTop();
  },
  getStyle : function(el, prop) {
    return YUID.getStyle(el, prop);
  },
  setStyle : function(el, prop, value) {
    return YUID.setStyle(el, prop, value);
  },
  setAttribute : function(el, prop, value) {
    return YUID.setAttribute(el, prop, value);
  },
  getXY : function(el) {
    return YUID.getXY(el);
  },
  setXY : function(el, pos) {
    return YUID.setXY(el, pos);
  },
  insertBefore : function(el, sibling) {
    return YUID.insertBefore(el, sibling);
  },
  insertAfter : function(el, sibling) {
    return YUID.insertAfter(el, sibling);
  }
}
