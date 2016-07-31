(function () {

if(typeof window.TwentyC == "undefined")
  TwentyC = {};

TwentyC.widget = {};
TwentyC.util = {};

/**
 * @class Modules
 * @namespace TwentyC
 * Module management
 */

TwentyC.Modules = {
  
  /*
   * Holds the currently loaded vodka modules indexed by there namespace and name
   * @property loaded
   * @type Object
   */

  loaded : {}
}

TwentyC.ClientInfo = {
  isMobile : false
}

/**
 * Update an object with the data from another object, existing keys
 * will be overwritten and new keys will be added
 * @method UpdateObject
 * @param {Object} dest destination object
 * @param {Object} src source object
 * @param {Function} on_change fired everytime a new or updated value is set on dest
 * @returns {Object} destination object
 */

TwentyC.util.UpdateObject = function(dest, src, on_change, prefix) {

  var i, name;

  if(!prefix)
    var prefix = "";

  for(i in src) {
    
    if(prefix)
      name = prefix+"."+i;
    else
      name = i;

    if(typeof src[i] == "object") {
      if(src[i].shift) {
        
        if(on_change && src[i] != dest[i])
          on_change(name, dest[i], src[i]);
  
        dest[i] = src[i];
      } else {
        if(typeof dest[i] != "object") {
  
          if(on_change)
            on_change(name, dest[i], src[i]);
     
          dest[i] = {};
        }
        this.UpdateObject(dest[i], src[i], on_change, name);
      }
    } else {
      if(on_change) {
        if(typeof src[i] != typeof dest[i]||src[i] != dest[i])
          on_change(name, dest[i], src[i]);
      }
      dest[i] = src[i];
    }
  }


  return dest;
};

/**
 * Round a number
 * @method qr
 * @param {Number} n
 * @returns {Number} rounded number
 */

TwentyC.util.qr = function(n) {
  return ~~ (n + (n > 0 ? .5 : -.5));
};


/******************************************************************************
 * Widget to control a HTML 5 canvas element
 * @class Canvas
 * @constructor
 * @namespace TwentyC.widget
 * @param {Number} w width in pixels
 * @param {Number} h height in pixels
 * @param {HTMLNode} toElement canvas element will be appended to this element
 */

TwentyC.widget.Canvas = function(w,h,bgColor,toElement) {
  if(w && h) {
    this.Init(w,h,bgColor,toElement);
  }
};

/******************************************************************************
 * Initializes the canvas element and appends it to the specified parent
 * element
 * @method InitBase
 * @param {Number} w width in pixels
 * @param {Number} h height in pixels
 * @param {HTMLNode} toElement canvas element will be appended to this element
 */

TwentyC.widget.Canvas.prototype.InitBase = function(w,h,bgColor,toElement) {
  var D =  TwentyC.cla.Dom;
  this.element = document.createElement('canvas');
  D.setAttribute(this.element, 'width', w);
  D.setAttribute(this.element, 'height', h);

  this.states = {};
  this.mirrors = [];
  this.sources = [];
  this.images = {};
  
  this.width = w;
  this.height = h;
  this.bgColor = bgColor;

  /**
   * Holds clipping region, See SetClip
   * @property clip
   * @type {Object}
   */

  this.clip = null;



  this.Clear();

  if(toElement)
    toElement.appendChild(this.element);

  // set up event handlers
  
  this.onClick = new TwentyC.cla.EventHandler("onClick");
  this.onMirrorUpdate = new TwentyC.cla.EventHandler("onMirrorUpdate");
 
  // set up click handling

  var el = this.element;
  var canvas = this;

  var evname = (!TwentyC.ClientInfo.isMobile || TwentyC.ClientInfo.isAndroid ? "mousedown" : "touchstart")

  TwentyC.cla.Event.addListener(
    this.element, evname, function(e, o) {
      var xy = TwentyC.cla.Event.getXY(e);
      var r = TwentyC.cla.Dom.getRegion(el);
      var x = xy[0] - r.x;
      var y = xy[1] - r.y;
      canvas.onClick.fire([x,y,e])
    }
  );


  return this;
};
TwentyC.widget.Canvas.prototype.Init = 
TwentyC.widget.Canvas.prototype.InitBase;

/******************************************************************************
 * Get the canvas context
 * @method GetContext
 * @param {String} type context type, defaults to '2d'
 * @returns {Canvas Context}
 */

TwentyC.widget.Canvas.prototype.Ctx = 
TwentyC.widget.Canvas.prototype.GetContext = function(type) {
  if(TwentyC.cla.Env.ua.ie)
    return null;
  else {
    if(!this.ctx) {
      this.ctx = this.element.getContext(type || '2d');
      this.ratio = window.devicePixelRatio / (this.ctx.backingStorePixelRatio || this.ctx.webkitBackingStorePixelRatio);
    }
    return this.ctx;
  }
};

/******************************************************************************
 * Set clipping region
 * @method SetClip
 * @param {Number} x
 * @param {Number} y
 * @param {Number} w
 * @param {Number} h
 */

TwentyC.widget.Canvas.prototype.SetClip = function(x,y,w,h) {
  this.clip = {
    x : x,
    y : y,
    w : w,
    h : h
  };
};

/******************************************************************************
 * Use clipping region setup via SetClip
 * @method UseClip
 */

TwentyC.widget.Canvas.prototype.UseClip = function() {
  var ctx = this.Ctx();
  var clip = this.clip;
  if(clip) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(clip.x, clip.y);
    ctx.lineTo(clip.x+clip.w, clip.y);
    ctx.lineTo(clip.x+clip.w, clip.y+clip.h);
    ctx.lineTo(clip.x, clip.y+clip.h);
    ctx.lineTo(clip.x, clip.y);
    ctx.closePath();
    ctx.clip();
  }
};

/******************************************************************************
 * Restore region after using UseClip()
 * @method EndClip()
 */

TwentyC.widget.Canvas.prototype.EndClip = function() {
  var ctx = this.Ctx();
  var clip = this.clip;
  if(clip)
    ctx.restore();
};


/******************************************************************************
 */

TwentyC.widget.Canvas.prototype.AdjustDPI = function(w, h) {
  var ctx = this.GetContext();
  this.highdpi = true;
  this.element.width = w * this.ratio;
  this.element.height = h * this.ratio;
  this.element.style.width = w + "px";
  this.element.style.height = h + "px";
  ctx.scale(this.ratio, this.ratio);
}

/******************************************************************************
 * Clear canvas or fill it with the background color define in this.bgColor
 * @method Clear
 * @param {Boolean} clear if true, use clearRect() to clear the canvas
 */

TwentyC.widget.Canvas.prototype.Clear = function(proper) {
  
  if(proper) {
    this.GetContext().clearRect(0,0,this.element.width,this.element.height);
    return;
  };

  this.Rect(
    0, 0, this.width, this.height, this.bgColor
  );
};

/******************************************************************************
 * Update the specified state, only if it changed
 * example: SetState("font", "11px arial");
 * @method SetState
 * @param {String} state state property name
 * @param {Mixed} value state property value
 */

TwentyC.widget.Canvas.prototype.SetState = function(state, value) {
/*
  if(this.states[state] != value) {
    this.states[state] = value;
  }
  */
  var ctx = this.GetContext();
  ctx[state] = value;
}

/******************************************************************************
 * Render text
 * @method Text
 * @param {String} text text to render
 * @param {String} color text color
 * @param {Number} x x offset in pixels
 * @param {Number} y y offset in pixels
 * @param {String} font font style, OPTIONAL if not set use this.font
 * @param {String} align font align, OPTIONAL if not set use "top"
 * @param {Number} [maxWidth] specify the maximum width of the text to be rendered - in pixels
 * @param {Boolean} [measure] if true function will return measureText result
 * @param {Object} [options] object literal holding further render options for this call
  */
TwentyC.widget.Canvas.prototype.Text = function(text, color, x, y, font, align, maxWidth, measure, options) {
  if(font)
    this.font = font;

  var ctx = this.GetContext();

  if(typeof text != "string")
    text = ""+text;
  
  if(!ctx)
    return;

  //if(maxWidth)
  //  ctx.maxWidth = maxWidth;
  ctx.textAlign = align || "left";
  ctx.textBaseline = "top";
  ctx.font = font;
  this.SetState("font", font ||  this.font);
  this.SetState("fillStyle", color);
  this.UseClip();

  if(!maxWidth)
    ctx.fillText(text+' ', Math.round(x), Math.round(y));
  else {
    if(!options || !options.clip)
      ctx.fillText(text+' ', Math.round(x), Math.round(y), maxWidth);
    else {
      var cut = false
      var step = Math.max(Math.round(text.length/10), 1)
      maxWidth -= 4;
      while(ctx.measureText(text+"..").width > maxWidth && text.length > 1) {
        text = text.substring(0, text.length-Math.min(text.length, step));
        cut = true
        step = Math.max(Math.round(text.length/10), 1)
      }
      ctx.fillText(text+(!cut?' ':".."), Math.round(x), Math.round(y));
    }
  }
  this.EndClip()
  
  //ctx.fillText(text+' ', x,y));
  //if(maxWidth)
  //  ctx.maxWidth = 0;
  
  if(options) {
    if(options.updateCollisionMap && this.collisionMap) {
      this.collisionMap.Text(text,options.updateCollisionMap,x,y,font,align,maxWidth);
    }
  }

  if(measure)
    return ctx.measureText(text+" ")
};

/**
 * Draw rectangle, if no color value is submitted use clearRect instead
 * @method Rect
 * @param {Number} x upper left corner of rectangle area in pixels (x axis)
 * @param {Number} y upper left corner of rectangle area in pixels (y axis)
 * @param {Number} w width in pixels
 * @param {Number} h height in pixels
 * @param {String} color fill color
 * @param {Object} [options] object literal holding further render options for this call
 */

TwentyC.widget.Canvas.prototype.Rect = function(x, y, w, h, color, options) {
  var qr = TwentyC.util.qr;
  var qr = function(c) { return c };
  if(color) {
    this.SetState("fillStyle", color);
    this.UseClip();
    this.Ctx().fillRect(qr(x), qr(y), qr(w), qr(h), color);
  } else {
    this.UseClip();
    this.Ctx().clearRect(qr(x), qr(y), qr(w), qr(h));
  }
  this.EndClip();

  if(options) {
    if(options.updateCollisionMap && this.collisionMap) {
      this.collisionMap.Rect(x,y,w,h,options.updateCollisionMap);
    }
  }
};


/******************************************************************************
 * Render image
 * @method Image
 * @param {String} src image source path
 * @param {Number} x x offset
 * @param {Number} y y offset
 * @param {Number} w width
 * @param {Number} h height
 */

TwentyC.widget.Canvas.prototype.Image = function(src,x,y,w,h) {
  var Canvas = this;
  var x = Math.round(x);
  var y = Math.round(y);
  if(!this.images[src]) {
    var img = new Image();
    img.src = src;
    img.onload = function() {
      if(!isNaN(w))
        Canvas.GetContext().drawImage(this,x,y,w,h);
      else
        Canvas.GetContext().drawImage(this,x,y);

      Canvas.images[src] = this;
    }
  } else {
    if(!isNaN(w))
      this.GetContext().drawImage(this.images[src],x,y,w,h);
    else
      this.GetContext().drawImage(this.images[src],x,y);
  }
};

/**
 * Stroke a rectangle
 * @method StrokeRect
 * @param {Number} x upper left corner of rectangle area in pixels (x axis)
 * @param {Number} y upper left corner of rectangle area in pixels (y axis)
 * @param {Number} w width in pixels
 * @param {Number} h height in pixels
 * @param {Number} lineWidth in pixels
 * @param {String} color stroke color
 * @param {Object} [options] object literal holding further render options for this call
 */

TwentyC.widget.Canvas.prototype.StrokeRect = function(x, y, w, h, lineWidth, color, options) {
  var qr = TwentyC.util.qr;
  this.SetState("strokeStyle", color);
  this.SetState("lineWidth", lineWidth);
  this.UseClip();
  this.Ctx().strokeRect(qr(x)+0.5, qr(y)+0.5, w-1, h-1);
  this.EndClip();

  if(options) {
    if(options.updateCollisionMap && this.collisionMap) {
      this.collisionMap.StrokeRect(x, y, w, h, lineWidth, options.updateCollisionMap);
    }
  }

};


/******************************************************************************
 * Render a circle
 * @method Circle
 * @param {Number} x x offset
 * @param {Number} y y offset
 * @param {Number} r radius
 * @param {String} color fill color
 */

TwentyC.widget.Canvas.prototype.Circle = function(x, y, r, color) {
  var ctx = this.GetContext();
  
  if(!ctx)
    return;

  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI*2, true);
  ctx.closePath();
  this.SetState("fillStyle", color);
  ctx.fill();
};

/******************************************************************************
 * Draw an even sided triangle
 *
 * d should be a direction: 
 * 'l' pointing left
 * 'r' pointing right
 * 'u' pointing up
 * 'd' pointing down
 * @method Triangle
 * @param {Number} x x offset
 * @param {Number} y y offset
 * @param {Number} w width
 * @param {Number} h height
 * @param {String} color fill color
 * @param {String} d direction
 */

TwentyC.widget.Canvas.prototype.Triangle = function(x, y, w, h, color, d) {
  var r = Math.round;
  if(d == "u") {
    this.Path(color, [
      [x+r(w/2), y],
      [x+w, y+h],
      [x, y+h],
      [x+r(w/2), y]
    ]);
  } else if(d == "d") {
    this.Path(color, [
      [x+r(w/2), y+h],
      [x+w, y],
      [x, y],
      [x+r(w/2), y+h]
    ]);
  } else if(d == "l") {
    this.Path(color, [
      [x, y+r(h/2)],
      [x+w, y],
      [x+w, y+h],
      [x, y+r(h/2)]
    ]);
  } else if(d == "r") {
    this.Path(color, [
      [x+w, y+r(h/2)],
      [x, y],
      [x, y+h],
      [x+w, y+r(h/2)]
    ]);
  } else if(d == "dr") {
    this.Path(color, [
      [x+w, y],
      [x, y],
      [x+w, y-h],
      [x+w, y]
    ]);
  } else if(d == "ur") {
    this.Path(color, [
      [x+w, y],
      [x, y],
      [x+w, y+h],
      [x+w, y]
    ]);
  }

}

/******************************************************************************
 * Fill or stroke a path
 * @method Path
 * @param {String} color color
 * @param {Array} coords array holding [x,y] coordinates 
 * @param {String} fncName render function name defaults to "fill"
 */

TwentyC.widget.Canvas.prototype.Path = function(color, coords, fncName) {
  var ctx = this.GetContext();
  
  if(!ctx)
    return;

  this.SetState("fillStyle", color);
  ctx.beginPath();
  ctx.moveTo(coords[0][0], coords[0][1]);
  var i,c;
  for(i = 1; i < coords.length; i++) {
    c = coords[i];
    if(c.length > 2)
      ctx.bezierCurveTo(c[0],c[1],c[2],c[3],c[4],c[5]);
    else
      ctx.lineTo(c[0], c[1]);
  }
  ctx.closePath();
  ctx[fncName || "fill"]();
};

/**
 * Draw a line from x,y to x2,y2
 * @method Line
 * @param {Number} x starting point (x axis) in pixels
 * @param {Number} y starting point (y axis) in pixels
 * @param {Number} x2 ending point (x axis) in pixels
 * @param {Number} y2 ending point (y axis) in pixels
 * @param {Number} width line width in pixels
 * @param {String} color 
 * @param {Object} [options] object literal holding further render options for this call
 */

TwentyC.widget.Canvas.prototype.Line = function(x, y, x2, y2, width, color, options) {
  var ctx = this.Ctx(), qr = TwentyC.util.qr;
  var clip = this.clip;

  this.SetState("strokeStyle", color);
  this.SetState("lineWidth", width);
 
  this.UseClip();

  ctx.beginPath();
  ctx.moveTo(qr(x)+0.5, qr(y)+0.5);
  ctx.lineTo(qr(x2)+0.5, qr(y2)+0.5);
  ctx.closePath();
  ctx.stroke();

  this.EndClip();

  if(options) {
    if(options.updateCollisionMap && this.collisionMap) {
      this.collisionMap.Line(x, y, x2, y2, width, options.updateCollisionMap);
    }
  }
};


/******************************************************************************
 * Resize the canvas
 * @method Resize
 * @param {Number} width width in pixels
 * @param {Number} height height in pixels
 */

TwentyC.widget.Canvas.prototype.Resize = function(width, height) {
  var D = TwentyC.cla.Dom;

  //var r = window.devicePixelRatio;
  //width *= r;
  //height *= r;
  
  D.setAttribute(this.element, 'width', width);
  D.setAttribute(this.element, 'height', height);
  //this.GetContext().scale(r, r);
  this.width = width;
  this.height = height;
  if(this.collisionMap) {
    this.collisionMap.Resize(width, height);
  }

};

/**
 * Set up collision-map for this canvas
 *
 * @method InitCollisionMap
 */

TwentyC.widget.Canvas.prototype.InitCollisionMap = function() {
  if(!this.collisionMap) {
    this.collisionMap = new TwentyC.widget.Canvas();
    this.collisionMap.Init(this.width, this.height);
    this.collisionMap.Rect(0,0,this.width,this.height,"#000");
    this.collisionMap.webkitImageSmoothingEnabled = false;
    this.collisionMap.element.style.imageRendering = "-webkit-optimize-contrast";
    this.collisionMap.element.style.display = "none";
    document.body.appendChild(this.element);
  }
}

/**
 * Get collision color at the specified area.
 *
 * @method GetCollisionColor
 * @param {Number} x 
 * @param {Number} y
 * @param {Number} [radius=4]
 */

TwentyC.widget.Canvas.prototype.GetCollisionColor = function(x, y, radius, objects) {
  if(!radius)
    var radius = 4;
  x = x - radius
  y = y - radius
  var d = (radius*2)+1;

  if(this.collisionMap) {
    var imgd = this.collisionMap.Ctx().getImageData(x,y,d,d);
    var color, pix = imgd.data, i, grid=[], obj, n, k, a;
    for(i=0; i < pix.length; i+= 4) {
      color = [pix[i], pix[i+1], pix[i+2]];
      color = "#"+(((color[0] << 16) + (color[1] << 8) + (color[2])).toString(16));
      grid.push(color);
    }
    for(k = 0; k < radius; k++) {
      for(i = radius-k; i <= (radius+k); i++) {
        for(n = radius-k; n <= (radius+k); n++) {
          a = (n * d) - (d - i);
          color = grid[a]
          if(color != "0") {
            for(obj in objects) {
              if(color == objects[obj].collisionColor) {
                //console.log("Color at", i-radius, i-radius, a, grid[a], objects[obj], k);
                return objects[obj];
              }
            }
          }
        }
      }
    }
  }
};



//#############################################################################
// Create a new canvas element and link the content of this canvas into it
// Only the contents specified by the coordinates will be linked
//
// Once the section is create you can call RenderMirrors on this canvas to
// render updates into the mirror or RenderFromSources on the new canvas
// for the same effect
//
// mirror is an optional argument that can hold a reference to an existing
// canvas object to mirror into, no new canvas will be created in that case
//
// also if mirror is specified you can define x and y offsets for the mirrored
// content in the mirror via tx and ty

TwentyC.widget.Canvas.prototype.MirrorSection = function(x,y,w,h,mirror,tx,ty,tw,th,skipUpdate) {
 
  if(!mirror) {
    var mirror = new TwentyC.widget.Canvas(tw || w, th || h);
    if(this.highdpi) {
      mirror.AdjustDPI(tw || w, th || h);
    }
  }

  this.mirrors.push([mirror,x,y,w,h,tx||0,ty||0,tw||w,th||h]);
  mirror.sources.push([this,x,y,w,h,tx||0,ty||0,tw||w,th||h]);

  if(!skipUpdate)
    mirror.RenderFromSources();

  return mirror;

};

//#############################################################################

TwentyC.widget.Canvas.prototype.RemoveMirror = function(mirror) {
  
  var i;
  for(i in this.mirrors) {
    if(this.mirrors[i][0] == mirror) {
      this.mirrors.splice(i,1);
      break;
    }
  }

  for(i in mirror.sources) {
    if(mirror.sources[i][0] == this) {
      mirror.sources.splice(i, 1);
      break;
    }
  }

};

//#############################################################################

TwentyC.widget.Canvas.prototype.RemoveSources = function() {
  var i;
  for(i in this.sources) {
    this.sources[i][0].RemoveMirror(this);
  }
};

//#############################################################################
// If any sources are specified for this canvas render updates from those
// source into this canvas

TwentyC.widget.Canvas.prototype.RenderFromSources = function() {

  var r = this.highdpi ? this.ratio : 1;
  
  if(this.sources) {
    var ctx = this.GetContext(),i,S;
    for(i in this.sources) {
      S = this.sources[i];
      ctx.drawImage(
        S[0].element, S[1], S[2], S[3]*r, S[4]*r, S[5], S[6], S[7], S[8]
      );
    }

    this.onMirrorUpdate.fire(this);
  }

}


//#############################################################################
// IF any mirrors are specified for this canvas, render this canvas into
// those mirrors

TwentyC.widget.Canvas.prototype.RenderMirrors = function() {
  if(this.mirrors) {
    var i, M;
    for(i in this.mirrors) {
      M = this.mirrors[i];
      M[0].GetContext().drawImage(
        this.element, M[1], M[2], M[3], M[4], M[5], M[6], M[7], M[8]
      );
      M.onMirrorUpdate.fire(M);
    }
  }
};

/**
 * utility functions
 * @class util
 * @static
 * @namespace TwentyC
 */

TwentyC.util =  {

  /**
   * Wrapper for str.split with additional functionality
   *
   * @method Split
   * @param {String} str
   * @param {String} sep separate using this string
   * @param {Boolean} [keepSep=false] if true resulting array also contains elements for the separator matches
   * @param {Function} [make=undefined] if specified this function will be used to make the items of the resulting array. Function is passed original content and payloadA on items that arent the separator and payloadB on items that are the separator
   * @param {Mixed} payloadA argument passed to make when a non separator item is created, this should return it's new value
   * @param {Mixed} payloadB argument passed to make when a separator item is created, this should return its new value
   * @returns {Array} result str split result
   */

  Split : function(str, sep, keepSep, fnMake, payloadNew, payloadOld) {
    if(!keepSep)
      return str.split(sep)
    else {
      var i, parts = str.split(sep);
      for(i=1; i < parts.length; i+=2) {
        if(fnMake) {
          parts[i-1] = fnMake(parts[i-1], payloadOld);
          parts.splice(i,0,fnMake(sep, payloadNew));
        } else 
          parts.splice(i,0,sep);
      }
      if(fnMake)
        parts[parts.length-1] = fnMake(parts[parts.length-1], payloadOld);
      return parts;
    }
  },

  BinarySearch1D : function(a, value, dir, closest, len) {
    
    var lo = 0, hi = (len||a.length-1), mid;

    if(!dir) {
      while(lo <= hi) {
        mid = Math.floor((lo+hi)/2);
        if(a[mid] > value)
          hi = mid - 1;
        else if(a[mid] < value)
          lo = mid + 1;
        else
          return mid;
      }
    } else {
      while(lo <= hi) {
        mid = Math.floor((lo+hi)/2);
        if(a[mid] < value)
          hi = mid - 1;
        else if(a[mid] > value)
          lo = mid + 1;
        else
          return mid;
      }
    }

    if(a.length) {
      if(a[0] == value)
        return 0;
      else if(a[(len||a.length-1)] == value)
        return (len||a.length-1);
    }
    return closest ? mid : -1;

  },


  BinarySearch : function(a, key, value, dir, len) {
    
    var lo = 0, hi = (len||a.length-1), mid;

    if(!dir) {
      while(lo <= hi) {
        mid = Math.floor((lo+hi)/2);
        if(a[mid][key] > value)
          hi = mid - 1;
        else if(a[mid][key] < value)
          lo = mid + 1;
        else
          return mid;
      }
    } else {
      while(lo <= hi) {
        mid = Math.floor((lo+hi)/2);
        if(a[mid][key] < value)
          hi = mid - 1;
        else if(a[mid][key] > value)
          lo = mid + 1;
        else
          return mid;
      }
    }

    if(a.length) {
      if(a[0][key] == value)
        return 0;
      else if(a[(len||a.length-1)][key] == value)
        return (len||a.length-1);
    }
    return -1;

  },

  BestStartingPoint : function(arr, key, value, dir) {
   
   var max = arr.length / 250;

   if(max < 2)
     return [0,1]
   /*
   if(arr.length < max*10)
     return [0,1]
   */
   var s = Math.floor(arr.length/max);

   if(typeof value == "string") {
     value = value.charCodeAt(0);
     var isString = true;
   } else {
     var isString = false;
   }
  
   var i = 0, r, rdiff=null, diff;
   for(i = 0; i < max; i++) {
     if(!isString) {
       diff = dir ? arr[i*s][key] - value : value - arr[i*s][key];
     } else {
       diff = arr[i*s][key].charCodeAt(0) - value;
     }
     if(rdiff === null) {
       rdiff = diff;
       r = i*s;
     } else if(Math.abs(diff) < Math.abs(rdiff)) {
       rdiff = diff;
       r = i*s;
     }
   }

   return [r,rdiff];
  },

  /**
   * Find if an input element (eg. input, select, textarea) currently
   * has focus.
   *
   * @method UserIsEditing
   * @returns {null|HTMLNode} null if user is not currently editing any form fields, otherwise returns the form field
   */

  UserIsEditing : function() {
    var node = document.activeElement;
    if(!node)
      return null;
    if(this.InArray(node.nodeName.toLowerCase(), ["input","select","textarea"]) > -1)
      return node;
    return null;
  },

  /**
   * Extend an object
   *     
   *     MyNewWindowClass = TwentyC.util.Extend(
   *       TwentyC.widget.BaswWindow,
   *       "MyNewWindowClass",
   *       {
   *         OnBuild : function() { ... }
   *       }
   *     );
   *
   *     var win = new MyNewWindowClass();
   *
   * @method Extend
   * @param {Function} c contructor of object to be extended
   * @param {String} name name of the new class 
   * @param {Object} proto functions and properties to add to the new prototype.
   * @param {Function} [ctor] ctor function for the new object
   */

  Extend : function(c, name, proto, ctor) {
    if(!ctor)
      var ctor = function() {};

    ctor.prototype = new c();

    var i;
    for(i in proto) {
      ctor.prototype[i] = ctor.prototype[name+"_"+i] = proto[i];
    }

    return ctor;

  },

 /**
  * Removes specified string from an array
  * @method RemoveFromArray 
  * @param {Array} arr
  * @param {String} str
  * @returns {Array} array containing the removed elements.
  */
  RemoveFromArray : function (arr) {
    var what, a = arguments, L = a.length, ax;
    while (L > 1 && arr.length) {
      what = a[--L];
      while ((ax = arr.indexOf(what)) !== -1) {
        arr.splice(ax, 1);
      }
    }
    return arr;
  },

  UniqueID : function() {
    return 'yxxyxxyxx'.replace(/[xy]/g, function(c) {
      var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
      return v.toString(16);
    });
  },

  timezone : function() {
    return this.UserTimezone();
  },

  AdjustTimezone : function(dt) {
    var diff = this.UserTimezone() - this.timezone();
    dt.setTime(
      dt.getTime() - (diff * 3600000)
    )
    return dt;
  },

  /**
   * Return the user's timezone in hours
   * @method UserTimezone
   */

  UserTimezone : function(dst) {
    var dt = new Date()
    if(dst)
      return -dt.getTimezonesOffset()/60
    else
      return (-dt.getTimezoneOffset() - (dt.dst()?60:0)) / 60
  },

  /**
   * Check whether an object has a property or not
   * @method HasKey
   * @param {Object} obj
   * @param {String} key
   * @returns {Boolean} exists
   */

  HasKey : function(obj, key) {
    return (typeof obj[key] != "undefined")
  },

  /**
   * Stable array sorting
   * @method MergeSort
   * @param {Array} arr array to sort
   * @param {Function} comparison  sort comp function as you would pass it to sort
   */

  MergeSort : function(arr,comparison) {
    if(arr.length < 2)
      return arr;
    var middle = Math.ceil(arr.length/2);
    return this.Merge(
      this.MergeSort(arr.slice(0,middle),comparison),
      this.MergeSort(arr.slice(middle),comparison),
      comparison
    );
  },

  Merge : function(left, right, comparison) {
    var result = new Array();
    while((left.length > 0) && (right.length > 0)) {
      if(comparison(left[0],right[0]) <= 0)
        result.push(left.shift());
      else
        result.push(right.shift());
    }
    while(left.length > 0)
      result.push(left.shift());
    while(right.length > 0)
      result.push(right.shift());
    return result;
  },


  ColorPosNeg : function(el, value, colors, prop) {
    if(!prop)
      var prop = "color";

    if(value > 0)
      el.style[prop] = colors.positive
    else if(value < 0)
      el.style[prop] = colors.negative
    else
      el.style[prop] = ""
  },

  /**
   * Sort items in a YUIMenu instance alphabetically
   * @method SortMenuItems
   * @param {YUIMenu} menu
   */

  SortMenuItems : function(menu) {
    var items = menu.getItems();

    items.sort(function(a,b) {
      var txtA = a.cfg.getProperty("text");
      var txtB = b.cfg.getProperty("text");
      if(txtA < txtB)
        return -1;
      if(txtA > txtB)
        return 1;
      return 0;
    });

    var i, item, submenu;
    for(i = 0; i < items.length; i++) {
      item = items[i].element;
      if(submenu = items[i]._oSubmenu) {
        TwentyC.util.SortMenuItems(submenu);
      }
      item.parentNode.appendChild(item);
    }
  },

  /**
   * Manually dispatch a html event for an element
   * @method DispatchEvent
   * @param {HTMLNode} element
   * @param {String} name event name eg. "click" or "change"
   */

  DispatchEvent : function(element, name) {
    var evt = document.createEvent("HTMLEvents");
    evt.initEvent(name, false, true);
    element.dispatchEvent(evt);
  },

  /**
   * Present prompt to copy a text to clipbard. Best solution without having to
   * resort to using flash.
   * @method CopyToClipboard
   * @param {String} text
   */

  CopyToClipboard : function(text) {
    prompt(L.info.copy_to_clipboard, text);
  },

  /**
   * Increase or decrease brigthness of a color
   * @method ColorAdjustBrightness
   * @param {Mixed} color can be hex string or rgb array
   * @param {Number} steps
   * @returns {String} color hex color string
   */

  ColorAdjustBrightness : function(color, steps) {
    var rgb,m;
    if(typeof(color) == "string") {
      if(color.charAt(0) == '#') {
        rgb = TwentyC.cla.Color.hex2rgb(color.substr(1,color.length));
      } else if((m = color.match(/rgba\((\d+),(\d+),(\d+),/))) {
        rgb = m;
        rgb.shift();
      }
    } else if(typeof(color) == 'object' && color.push) {
      rgb = color;
    }


    if(!rgb)
      return color;

    var r = parseInt(rgb[0]),
        g = parseInt(rgb[1]),
        b = parseInt(rgb[2]);

    var max = Math.max, min = Math.min;
    r = max(0,min(255, r + steps))
    g = max(0,min(255, g + steps))
    b = max(0,min(255, b + steps))

    return "#"+TwentyC.cla.Color.rgb2hex(r,g,b);
  },

  /**
   * Escape regexp characters
   * @method ReEscape
   * @param {String} text text to escape
   * @returns {String} escaped text
   */

  ReEscape : function(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
  },

  //###########################################################################

  /**
   * Strip html tags from text string
   * @method StripTags
   * @param {String} txt
   * @returns {String} cleaned string
   */

  StripTags : function(txt, convertLB) {
    if(txt && txt.replace) {
      var r = txt.replace(/</g,"&lt;").replace(/>/g, "&gt;");
      if(convertLB) {
        r = r.replace(/\n/g, "<br />");
      }
      return r;
    } else
      return txt;
  }, 

  //###########################################################################
  
  /**
   * Cancel propagation for multiple events on a node
   * @method EventCancelPropagation
   * @param {HTMLNode} element
   * @param {Array} eventNames 
   */

  EventCancelPropagation : function(element, eventNames) {
    
    var e;
    for(e in eventNames) {
      TwentyC.cla.Event.addListener(element, eventNames[e], function(ev) {
        TwentyC.cla.Event.stopPropagation(ev);
      });
    }
  
  },

  //###########################################################################

  /**
   * Get initial line number from error object
   * @method ErrorLineNumber
   * @param {Error Object} err
   * @returns {Number} line number
   */

  ErrorLineNumber : function(err) {
    var s = err.stack;
    var p = s.match(/:(\d+):(\d+)/);
    if(p)
      return p[1];
    else
      return 0;
  },

  //###########################################################################
  
  /**
   * Turn an object into url parameters
   * @method UrlParameters
   * @param {object} args
   * @returns {String} url parameters string, without the starting "?"
   */

  UrlParameters : function(obj, keys) {
    var i, a = [];
    for(i in obj) {
      a.push(encodeURIComponent(keys[i]||i)+"="+encodeURIComponent(obj[i]))
    }
    return a.join("&");
  },

  //###########################################################################
  
  /**
   * Return a clone of an existing object
   * @method Clone
   * @param {Object} obj
   * @returns {Object} clone of the object
   */

  Clone : function(obj) {
    if(obj && typeof obj.push == "function")
      var r = [];
    else
      var r = {};

    var i,v;
    for(i in obj) {
      v = obj[i];
      if(typeof v == "object")
        r[i] = this.Clone(v);
      else
        r[i] = v;
    }

    return r;
  },

  //###########################################################################

  /**
   * Compare values of two arrays, returns false if any values are mimatched
   * true if all are a match
   * @method CompareArrays
   * @param {Array} arr1 first array to compare
   * @param {Array} arr2 second array to compare
   * @param {Function} fn OPTIONAL, if set will be used to prepare the values before they are being compared
   */

  CompareArrays : function(arr1, arr2, fn) {
    var i;
    if(arr1.length != arr2.length)
      return false;
    
    if(!fn) {
      for(i in arr1) {
        if(arr1[i] != arr2[i])
          return false;
      }
    } else {
      for(i in arr1) {
        if(fn(arr1[i]) != fn(arr2[i]))
          return false;
      }
    }

    return true
  },

  //###########################################################################

  /**
   * Return the color value at a specific point in a color gradient
   * colors needs to be an array holding the various color steps, eg.
   * colors = [ [255,0,0], [0,255,0], [0,0,255] ] for three colors
   * red - green - blue
   * grades needs to be an array holding the points at which gradient
   * switches occur eg. where red - green swiches to green - blue
   * grades = [0, 1/3, 1] for an even 3 colored gradient
   * p needs to be the point you want to read from the gradient, its a percentage
   * 0 - 1, 1 being 100% - it can be a float, eg 0.5 for 50%
   * @method ColorFadeValue
   * @returns {Array} [r, g, b]
   */

  ColorFadeValue : function(colors, grades, p) {

    var i = 1;
    while(p > grades[i])
      i++;

    var from = colors[i-1],
        to = colors[i],
        min = grades[i-1],
        max = grades[i],
        r = (p-min)/((max-min)/100)

    var dr = (to[0] - from[0]) / 100;
    var dg = (to[1] - from[1]) / 100;
    var db = (to[2] - from[2]) / 100;
    
    var red = Math.round(from[0] + dr * r);
    var green = Math.round(from[1] + dg * r);
    var blue = Math.round(from[2] + db * r);

    return [
        red, green, blue
    ];
  },

  //###########################################################################
  
  /**
   * Update the property of an object with the values of another 
   * object.
   * @method UpdateConfig
   * @param {Object} target this object will be updated
   * @param {Object} source this object will be read for properties
   * @param {Boolean} addNew if true allow adding of properties to target if they dont exist yet, otherwise these properties will be ignored
   */

  UpdateConfig : function(target, uobj, addNew) {

  if(!uobj||!target)
    return;

  if(target.moduleName) {
    if(!TwentyC.ModuleOriginalConfig[target.moduleName]) {
      TwentyC.ModuleOriginalConfig[target.moduleName] = TwentyC.util.Clone(target);
    }
  }

  var i;
  for(i in uobj) {
    if(typeof target[i] == 'undefined') {
      if(!addNew)
        continue;
      else if(uobj[i] && typeof uobj[i] == 'object' && !uobj[i].nodeType && !uobj[i].splice) {
        target[i] = {}
        this.UpdateConfig(target[i], uobj[i], addNew);
        continue;
      } else {
        target[i] = uobj[i]
      }
    }

    if(uobj[i] && typeof uobj[i] == 'object' && !uobj[i].nodeType && !uobj[i].splice) {
      this.UpdateConfig(target[i], uobj[i], addNew);
    } else {
      target[i] = uobj[i];
    }
  }
  },

  //###########################################################################
  
  /**
   * Check if a coordinate falls inside a bbox object. A bbox object should
   * be a simple object with x,y,h and w properties set.
   * @method InBBox
   * @param {Number} x
   * @param {Number} y
   * @param {Object} bbox
   * @returns {Boolean} true if coordinate falls into bbox region, false if not
   */

  InBBox : function(x, y, bbox) {
    if(x >= bbox.x && x <= bbox.x + bbox.w) {
      if(y >= bbox.y && y <= bbox.y + bbox.h) {
        return true;
      }
    }
    return false;
  },

  //###########################################################################

  /**
   * See if a value exists inside an array, return index of first match or -1
   * if no match
   * @method InArray
   * @param {Mixed} value value to look for
   * @param {Array} arr array to search in
   * @param {String} [key] if specified will check for value in key 
   * @returns {Number} position of the first match, -1 if no match
   */

  InArray : function(value, arr, key) {
    
    var idx = -1,n;

    for(n in arr) {
      if((!key ? arr[n] : arr[n][key]) == value) {
        idx = n;
        break;
      }
    }

    return parseInt(idx);
  },

  //###########################################################################
  
  /**
   * Move a html element to the specified coordinates using style position,
   * left and top properties
   * @method Move
   * @param {HTMLNode} el
   * @param {Number} x x position in pixels
   * @param {Number} y y position in pixels
   */
  
  Move : function(el, x, y) {
    el.style.left = (x||0)+"px";
    el.style.top = (y||0)+"px";
  },

  /**
   * Resize a html element
   * @method Resize
   * @param {HTMLNode} el
   * @param {Number} w width in pixels
   * @param {Number} h height in pixels
   */

  Resize : function(el, w, h) {
    if(!isNaN(w))
      el.style.width = w+"px";
    if(!isNaN(h))
      el.style.height = h+"px";
  },

  /****************************************************************************
   * return YUI menu object for a subment inside another YUI menu, if
   * subment doesnt exist create it.
   * @method SubMenu
   * @param {YUI Menu} root root menu
   * @param {String} key submenu id 
   * @param {String} label submenu label
   * @returns {YUI Menu}
   */

  SubMenu : function(root, key, label, id) {
    var menus, menu, i;

    // if submenu exists already return it
    menus = root.getSubmenus();
    for(i in menus) {
      if(menus[i].id == key)
        return menus[i]
    }

    // does not exist, create it

    root.addItems([  
      { 
        text : label, 
        id : key+"-menu-parent",
        submenu : {
          id : key,
          zindex : 50000,
          itemdata : []
        }
      }
    ]);
    root.render();

    menus = root.getSubmenus();
    for(i in menus) {
      if(menus[i].id == key)
        return menus[i];
    }

    return null;
  },

  /****************************************************************************
   * Return RGB string (or array) for a css color rule
   * @method RGBFromCss
   * @param {String} classes css classes to apply (separate individual classes by space)
   * @param {String} prop css property to check, defaults to "background-color"
   * @param {Number} brighten OPTIONAL if > 0 brighten each color by the specified amount (multiplied)
   * @param {String} nodeName OPTIONAL defaults to 'div'
   * @param {Boolean} asObject OPTIONAL if true returns array instead of string
   * @returns {Mixed} rgb string "r,g,b" or if asObject is true rgb array [r,g,b]
   */

  RGBFromCSS : function(classes, prop, brighten, nodeName, asObject) {

    var el = document.createElement(nodeName || "div");
    TwentyC.cla.Dom.addClass(el, classes);
    document.body.appendChild(el);
    var rgbStr = TwentyC.cla.Dom.getStyle(el, prop || "background-color");
    if(window.DBG)
      alert(rgbStr + " " + prop);
    document.body.removeChild(el);
    rgb = rgbStr.match(/rgb\(([\d]+), ([\d]+), ([\d]+)\)/);
    if(rgb) {
      rgb.shift();
      if(brighten) {
        var i;
        for(i in rgb) {
          rgb[i] *= brighten;
        }
      }
      if(!asObject) {
        return rgb.join(",");
      } else {
        return rgb;
      }
    } 
  },

  /****************************************************************************
   * Calculate change between two values and return a difference perecentage
   * @method ChangePercentage
   * @param {Number} original original number
   * @param {Number} recent updated Number
   * @returns {Number} change percentage
   */

  ChangePercentage : function(original, recent) {
    var p = -TwentyC.util.SetPrecision((original-recent)/(original / 100),2);
    if(isNaN(p) || !original) {
      p = 0;
    }
    return p;
  },
   
  SetTimeOut : function(fn, interval, obj) {
    setTimeout(function() { fn(obj); }, interval);
  },
    
  //##########################################################################//

  ToList : function(obj, idxKey, valueKey) {
    var i;
    var r = {};
    for(i in obj) {
      r[(idxKey ? obj[i][idxKey] || i : i)] = (valueKey ? obj[i][valueKey] : i);
    }
    return r;
  },

  //##########################################################################//

  AlertRedirect : function(msg, url) {
    var i = confirm(msg);
    if(i) {
      window.document.location = url;
    }
  },

  //##########################################################################//
  
  /**
   * Replace compressed json keys with their real names
   * @method JSONKeys
   * @param {Object} data object to be parsed
   */

  JSONKeys : function(data) {
    var U = TwentyC.RPC_JSON_KEYS, i;
    var a = {}
    for(i in data) {
      if(typeof data[i] == 'object') {
        if(data.name == "account_perms" || i == "dd" || data.uncompressed)
          continue;

        a = { compress : true }
        TwentyC.onJSONCompress.fire({
          rv : a,
          name : data.name,
          k : i
        })

        if(!a.compress)
          continue;

        this.JSONKeys(data[i]);
      }
      if(U[i] && !data.push) {
        data[U[i]] = data[i];
        delete data[i];
      }
    }
  },
  
  //##########################################################################//
  
  /**
   * Parse a json string and return a json decoded object
   * @method JSONParse
   * @param {String} str valid json string
   * @returns {Object} obj
   */

  JSONParse : function(str) {
    var obj;
    try {
      obj = JSON.parse(str);
      TwentyC.util.JSONKeys(obj);
    } catch(err) {
      return {}
    }
    return obj;
  },
  
  //##########################################################################//
  
  /**
   * Create an url query string from an object using it's keys and values
   * @method ToQuery
   * @param {Object} obj 
   * @returns {String} url rquery string (without starting ?)
   */

  ToQuery : function(obj) {
    var k, query="";
    for(k in obj) {
      query += encodeURIComponent(k)+"="+encodeURIComponent(obj[k])+"&"
    }
    if(query.length) {
      return query.substr(0, query.length-1);
    } else
      return query;
  }, 
  
  //##########################################################################//
  
  /**
   * Check if an element is currently visible. Checks different style properties
   * to obtain this information. Not reliable in all cases.
   * @method IsDisplayed
   * @param {HTMLNode} ele
   * @returns {Boolean} true if element is visible, false if not
   */

  IsDisplayed : function(ele) {
    var D = TwentyC.cla.Dom;
    if(!ele)
      return false;
    var d = D.getStyle(ele, 'display');

    if(d == 'none')
      return false;
    
    e = ele.parentNode;
    while(e && d != 'none') {
      if(!e.style)
        return true;
      d = D.getStyle(e, 'display');
      e = e.parentNode;
    }
    return (d == 'none' ? false : true);
  },

  ElementIsRelated : function(ele, value) {
    var prev;
    while(ele && ele.getAttribute) {
      if(ele.getAttribute("rel") == value)
        return [ele, prev]
      prev = ele;
      ele = ele.parentNode;
    }
    return false;
  },
  
  ElementIsChild : function(ele, parent) {
    while(ele) {
      if(ele == parent)
        return true;
      ele = ele.parentNode
    }
    return false;
  },

  /****************************************************************************
   * pad a number with zeros. Returns string.
   * @method ZeroPad
   * @param {Number} n 
   * @param {Number} width
   * @param {Number} side 0 = left, 1 = right
   * @returns {String} zero padded number 
   */

  ZeroPad: function(n, width, side) {
    var rv = n.toString();


    for(i=rv.length; i<width; ++i) {
      if(!side)
        rv = "0" + rv;
      else
        rv += "0";
    }
    return(rv);
  },

  /****************************************************************************
   * Format a number
   * @method FormatNumber
   * @param {Number} n 
   * @param {Number} prec precision for floats
   * @param {String} negpre OPTIONAL prefix for negative numbers, defaults to "-"
   * @param {String} negpost OPTIONAL postfix for negative numbers, default to ""
   * @param {Boolean} addGrouping if true, numbers will be grouped by the thousands separator
   * @returns {String} formatted number
   */

  FormatNumber: function(n, prec, negpre, negpost, addGrouping, roundFloat) {
    negpre = negpre || "-";
    negpost = negpost || "";

    var locale = TwentyC.locale || {
      decimal : ".",
      group : ","
    }

    // round
    
    if(roundFloat)
      var n = parseFloat(parseFloat(n).toFixed(prec));
    else
      var n = Math.floor(n * Math.pow(10,prec)) / Math.pow(10, prec);

    var ar = String(Math.abs(n)).split(".");
    var rv = ar[0];
    
    // add grouping

    if(addGrouping) {
      rv = TwentyC.cla.Number.format(
        parseFloat(rv), { thousandsSeparator : locale.group }
      );
    }


    var frac= ar[1] || "";

    if(prec)
      {
      rv += locale.decimal;
      if(prec > frac.length)
        frac += this.ZeroPad(0, prec - frac.length);
      else if(prec < frac.length)
        frac = frac.substr(0, prec);
      rv += frac;
      }

    if(n < 0)
      rv = negpre+new String(rv).replace(/-/g,"")+negpost;

    return rv;
  },
  
  //##########################################################################//
  
  /**
   * Format date from ms ts.
   * Format options: %Y = year, %d = day, %m = month, %h : hour, %i = minute, %s = second, %u = usec
   * @method FormatDate
   * @param {Number} tsms timestamp (ms)
   * @param {String} format defaults to "%Y/%m/%d %h:%i"
   * @returns {String} formatted date string 
   */

  FormatDate : function(tsms, format) {
    var d = new Date(tsms);
    
    TwentyC.util.AdjustTimezone(d);

    var day = this.ZeroPad(d.getDate().toString(), 2),
        mon = this.ZeroPad((d.getMonth()+1).toString(), 2),
        year = d.getFullYear(),
        hour = this.ZeroPad(d.getHours().toString(), 2),
        min = this.ZeroPad(d.getMinutes().toString(), 2),
        sec = this.ZeroPad(d.getSeconds().toString(), 2),
        usec = this.ZeroPad(d.getMilliseconds().toString(), 3)

    if(!format)
      return year+"/"+mon+"/"+day+" "+hour+":"+min;

    return format.replace(
      "%Y", year
      ).replace(
      "%m", mon
      ).replace(
      "%d", day
      ).replace(
      "%h", hour
      ).replace(
      "%i", min
      ).replace(
      "%s", sec
      ).replace(
      "%u", usec
      )

  },

  //##########################################################################//

  /**
   * Create a date object from a timestamp
   * @method ParseTimestamp
   * @param {Mixed} ts timestamp, can be an object with sec and usec keys or a float with seconds.milliseconds
   * @returns {Date} date object
   */

  ParseTimestamp: function(ts) {
    if(!ts)
      return new Date();
    
    var rv = new Date();

    if(typeof ts.sec != 'undefined') { 
      rv.setTime(parseFloat(ts.sec+'.'+ts.usec)*1000)
      rv._orig_usec = ts.usec;
    } else {
      if(ts.match)
        ts = parseFloat(ts)
      rv.setTime(ts * 1000)
    }
    return(rv);
  },

  //##########################################################################//
  
  /**
   * Return formatted time string from timestamp
   * @method FormatTimestamp
   * @param {Mixed} ts timestamp, can be a date object, an object with sec and usec keys or a float with seconds.milliseconds
   * @returns {String} formatted time string
   */
 
  FormatTimestamp : function(ts, precUsecs) {
    if(typeof ts.getHours == 'undefined')
      var i = TwentyC.util.StrTimestamp(TwentyC.util.ParseTimestamp(ts), precUsecs);
    else
      var i = TwentyC.util.StrTimestamp(ts, precUsecs);  
    return i
  },
 
  //##########################################################################//
  
  /**
   * Create a time string "h:m:s.u" from timestamp
   * @method StrTimestamp
   * @param {Mixed} ts timestamp, can be an object with sec and usec keys or a float with seconds.milliseconds
   * @returns {String} time string
   */

  StrTimestamp: function(ts, precUsecs) {
    if(!ts || typeof ts.getHours == 'undefined' || isNaN(ts.getHours()))
      return '';

    TwentyC.util.AdjustTimezone(ts);

    var h = ts.getHours();
    var m = this.ZeroPad(ts.getMinutes(), 2);
    var s = this.ZeroPad(ts.getSeconds(), 2);
    if(!precUsecs || !ts._orig_usec)
      var u = this.ZeroPad(ts.getMilliseconds(), 3);
    else {
      var u = ""+ts._orig_usec;
      if(precUsecs > u.length) {
        u = u.substr(0,precUsecs);
      }
      u = this.ZeroPad(u, precUsecs, 1);
    }
    return(h+":"+m+":"+s+"."+u);
  },

  //##########################################################################//
  
  /**
   * Remove dollar sign and make float
   * @method ParseNumberFromCurrency
   * @param {String} sString currency string eg "$1234.56"
   * @returns {Number} float
   */

  ParseNumberFromCurrency : function(sString) {
    if(!sString || typeof sString.substring == 'undefined')
      return 0;
    return parseFloat(sString.substring(1));
  },

  /****************************************************************************
   * Return time diff (calculated to days, hours, minutes and seconds)
   * in a human readable format
   * @method TimeDiffFormat
   * @param {Number} ts timestamp in ms
   * @returns {String} 
   */

  TimeDiffFormat : function(ts, format) {
    var i, d,h,u,m,s,f=Math.floor,z=this.ZeroPad;
    if(!format)
      var format = "%d days, %h:%i:%s.%u";

    s = f(ts / 1000);
    ts -= s * 1000;

    m = f(s / 60); 
    s -= m * 60; 

    h = f(m / 60); 
    m -= h * 60; 

    d = f(h / 24); 
    h -= d * 24;  

    return format.replace(
      /%h/g, z(h,2)
    ).replace(
      /%i/g, z(m,2)
    ).replace(
      /%s/g, z(s,2)
    ).replace(
      /%u/g, z(ts,3)
    ).replace(
      /%d/g, d
    )
    //return d+" days, "+z(h,2)+":"+z(m,2)+":"+z(s,2)+"."+z(ts,3);
  },

  /*****************************************************************************
   * Format a number to currency string
   * @method FormatCurrency
   * @param {Number} n
   * @returns {String} formatted number
   */

  FormatCurrency : function(n) {
    n /= Math.pow(10, 8)
    return TwentyC.util.FormatNumber(n, 2, "(", ")", true, true);
  },

  //##########################################################################//

  /**
   * Take all the properties of an object and push them onto an array. 
   * @method ToArray
   * @param {Object} obj
   * @returns {Array} array holding the properties of obj
   */

  ToArray : function(Obj) {
    var i,a=[];
    for(i in Obj) {
      a.push(Obj[i]);
    }
    return a;
  },

  ToObject : function(arr, keyName) {
    if(arr && typeof arr.push == "function") {
      var i, rv = {};
      for(i = 0; i < arr.length; i++) {
        rv[arr[i][keyName]] = arr[i];
      }
      return rv;
    } else
      return arr;
  },

  /**
   * Return all property names of an object literal
   * @method ObjectKeys
   * @param {Object} obj
   * @returns {Array}
   */

  ObjectKeys : function(obj) {
    var i, r = [];
    for(i in obj) {
      r.push(i);
    }
    return r;
  },

  //##########################################################################//
  // Removes objects from an array if the specified key doesnt match the
  // specified value
  
  FilterData : function(a, config) {
    var i;
    for(i in a) {
      switch(config.type) {
        case 'string':
          if(a[i][config.key] != config.value)
            a.splice(i);
        break;
      }
    }
  },

  //##########################################################################//
  
  /**
   * Select an option in a select element by its value
   * @method FormSelectOpt
   * @param {HTMLNode} element select element
   * @param {Mixed} value value of the option to be selected
   */

  FormSelectOpt : function(element, value) {
    var i, D = TwentyC.cla.Dom, n; 
    for(i in element.childNodes) {
      if(element.childNodes[i].value == value) {
        element.childNodes[i].selected = true;
        break;
      }
    }
  },

  //##########################################################################//
  // Fills a <select> element with data from the specified db
  
  /**
   * Fill a select element with data fro mthe specified db in TwentyC.DB or an arbitrary list
   * @method FormFillSelect
   * @param {HTMLNode} element select element
   * @param {Mixed} dbName if string try to read data from TwentyC.DB.dbName else assume dbName is an array or an object and directly use that
   * @param {String|Function} key Use this key to set option label from data row. Can also be a function that is passed a data element, in which case the returned value is used as the item's option label
   * @param {Mixed} selectValue if set select the option with the matching value
   * @param {String} valueKey Use this key to set option value from data row
   * @param {Boolean} addNull if true add "0" value option to the top 
   * @param {Boolean} append if true append options to the select element, otherwise existing options are truncated first
   * @param {Boolean} keyIsValue if true use specified key as both label and value key
   */

  FormFillSelect : function(element, dbName, key, selectValue, valueKey, addNull, append, keyIsValue) {
    
    var i, opt, db;
    
    if(typeof dbName == 'string')
      db = TwentyC.DB[dbName];
    else
      db = dbName;
     
    if(!db)
      return;
    
    // clear list
    element.options.length = 0

/*
    for(i = 0; i < element.length; i++) {
      element.remove(i);
    }

*/
    // if addNull is specified add null entry
    
    if(addNull) {
      opt = document.createElement('option');
      opt.text = addNull;
      opt.value = null;
      try {
        element.add(opt, null);
      } catch(ex) {
        element.add(opt);
      }
    }
    // add new options

    for(i in db) {

      opt = document.createElement('option');

      if(typeof key == "function")
        opt.text = key(db[i])
      else if(key)
        opt.text = db[i][key];
      else
        opt.text = db[i];

      if(key || valueKey)
        opt.value = db[i][valueKey || key];
      else if(db.push && keyIsValue)
        opt.value = db[i];
      else
        opt.value = i;

      if(selectValue == opt.value){
        opt.selected = true;
      }
      
      try {
        element.add(opt, null);
      } catch(ex) {
        element.add(opt);
      }

    }

    if(append) {
      for(i in append) {
        opt = document.createElement('option');
        opt.text = i;
        opt.value = append[i];
        try {
          element.add(opt, null);
        } catch(ex) {
          element.add(opt);
        }
      }
    }

  },
  
  /****************************************************************************
   * Set the precision of a float
   * @method SetPrecision
   * @param {Number} n
   * @param {Number} c precision
   * @return {Number}
   */

  SetPrecision : function(n, c) {
    c = Math.pow(10,c);
    return Math.round(n*c) / c;
  },

  /****************************************************************************
   * Validate that a string only has numeric characters
   * @method ValidateNumber
   * @param {String} str
   * @returns {Boolean} result
   */

  ValidateNumber : function(a) {
    return(a.match(/[^\d\.\,\-\+]/) ? false : true);
  },

  /****************************************************************************
   * Validate an instrument price against instrument tick size. Price will
   * be rounded to the nearest tick.
   * @method ValidatePrice
   * @param {Number} price (inted)
   * @param {Number} tickSize (inted)
   * @param {Number} precision DEPRECATED, ignore
   * @param {Boolean} up if true number will be rounded up, other it will be rounded down
   * @returns {Number} validated price
   */

  ValidatePrice : function(price, tickSize, precision,up) {
    var price = parseInt(price);
  
    if(!(price % tickSize))
      return price;
  
    var c = (price % tickSize);
 
    return !up ? price-c : price+(tickSize-c);
    
  },

  /****************************************************************************
   * Format an instrument to a user readable price string
   * @method FormatPrice
   * @param {Object} instrument instrument object as found in TwentyC.DB.instruments
   * @param {Number} price inted price
   * @param {Number} addPrecision OPTIONAL if > 0 precision will be added
   * @param {Boolean} useDecimal OPTIONAL if true force decimal price format regardless of the instruments price format
   */
  
  FormatPrice : function(inst, price, addPrecision, useDecimal, keepPrecision) {
    
    if(!inst.price_format || useDecimal) { 
      
      // format decimal price
      
      if(addPrecision) {
        price = price / (Math.pow(10, inst.precision+addPrecision));
        return TwentyC.util.FormatNumber(price, inst.precision+addPrecision,null,null,null,keepPrecision?false:true);
      } else {
        price = price / (Math.pow(10, inst.precision));
        return TwentyC.util.FormatNumber(price, inst.precision,null,null,null,keepPrecision?false:true);
      }
    } else {

      // format other (bonds)

      price = price / (Math.pow(10, inst.precision));
      var denominator = inst.price_format & 0xffff;
      var numerator = (inst.price_format & 0xff0000) >> 16;
      var width = (inst.price_format & 0xf000000) >> 24;

      var b = parseInt(price);
      var i = numerator / denominator;
      var n = (price - b) / i;

      var ticks = TwentyC.util.ZeroPad(parseInt(Math.abs(n)), width);

      if(price >= 0)
        return Math.abs(b)+"'"+ticks;
      else
        return '-'+Math.abs(b)+"'"+ticks;
    }
  },

  //###########################################################################//
  
  /**
   * Round a float to the specified amount of Decimal places
   * @method Round
   * @param {Number} Number
   * @param {Number} DecimalPlaces
   * @returns {Number}
   */

  Round : function(Number, DecimalPlaces) {
   return Math.round(parseFloat(Number) * Math.pow(10, DecimalPlaces)) / Math.pow(10, DecimalPlaces);
  },

  /****************************************************************************
   * Return inted price for formatted price string. Basically a reverse
   * FormatPrice
   * @method IntPrice
   * @param {Object} inst instrument object as found in TwentyC.DB.instruments
   * @param {String} price formatted price string
   * @param {Number} addedPrecision set if price was formatted with added precision
   * @returns {Number} inted price
   */

  IntPrice : function(inst, price, addedPrecision) {
    
    if(!inst.price_format) {
      if(!addedPrecision) {
        price = parseFloat(price.replace(',','.')) * (Math.pow(10, inst.precision))
        return parseInt(this.Round(price, inst.precision));
      } else {
        price = parseFloat(price.replace(',','.')) * (Math.pow(10, inst.precision+addedPrecision))
        return parseInt(this.Round(price, inst.precision+addedPrecision));
      }
    } else {
      
      var k = price.split("'")
      var n = parseInt(k[0])
      var ticks = parseInt(k[1].replace(/^0+/,'')||0)

      var denominator = inst.price_format & 0xffff;
      var numerator = (inst.price_format & 0xff0000) >> 16;
      var i = (numerator / denominator);
      
      var f = ticks * i;
      var price = n + f;

      price = (price * (Math.pow(10, inst.precision)))
      return parseInt(this.Round(price, inst.precision))
    }

  },

  //##########################################################################//

  FormatColorStatus : function(elCell, value, type, posSign) {
    if(parseFloat(value) > 0) {
      TwentyC.cla.Dom.removeClass(elCell, 'negative');
      TwentyC.cla.Dom.addClass(elCell, 'positive'+(type || ''));
      if(posSign)
        TwentyC.cla.Dom.addClass(elCell, 'positive-signed');
    } else if(parseFloat(value) < 0) {
      TwentyC.cla.Dom.removeClass(elCell, 'positive'+(type || ''));
      TwentyC.cla.Dom.addClass(elCell, 'negative');
      TwentyC.cla.Dom.removeClass(elCell, 'positive-signed');
    }

  },

  /****************************************************************************
   * Create a HTML element according to specs and return it
   * @method HTMLElement
   * @param {String} elementName valid HTML node name eg. 'div', 'input' ..
   * @param {Object} specs can have any html node attributes
   * @return {HTMLNode} input input element
   */

  HTMLElement : function(elementName, specs) {
    var element = document.createElement(elementName);
    var i;
    for(i in specs) {
      specs.setAttribute(i, specs[i]);
    }
    return element
  }

};

/**
 * Array holding abbreviated month names referenced by their numeric
 * representation (0 = jan)
 * @property MonthXL
 * @type {Array}
 */

TwentyC.util.MonthXL = [
  "Jan", "Feb", "Mar", "Apr", "May",
  "Jun", "Jul", "Aug", "Sep", "Oct",
  "Nov", "Dec"
];

/**
 * Toggle default select / drag functionality of browser
 * @method ToggleGlobalSelect
 * @param {Boolean} b on or off
 */
TwentyC.util.fnStopGlobalSelect = function(e) {
    TwentyC.cla.Event.stopEvent(e);
};

TwentyC.util.ToggleGlobalSelect = function(b) {
    if(!b) {
      TwentyC.cla.Event.addListener(document, "selectstart", this.fnStopGlobalSelect);  
      TwentyC.cla.Event.addListener(document, "dragstart", this.fnStopGlobalSelect);  
      TwentyC.cla.Event.addListener(document, "select", this.fnStopGlobalSelect);
    } else {
      TwentyC.cla.Event.removeListener(document.body, "selectstart", this.fnStopGlobalSelect);
      TwentyC.cla.Event.removeListener(document.body, "dragstart", this.fnStopGlobalSelect);
      TwentyC.cla.Event.removeListener(document.body, "select", this.fnStopGlobalSelect); 
    }
};

/**
 * Update an object with the data from another object, existing keys
 * will be overwritten and new keys will be added
 * @method UpdateObject
 * @param {Object} dest destination object
 * @param {Object} src source object
 * @param {Function} on_change fired everytime a new or updated value is set on dest
 * @returns {Object} destination object
 */

TwentyC.util.UpdateObject = function(dest, src, on_change, prefix) {

  var i, name;

  if(!prefix)
    var prefix = "";

  for(i in src) {
    
    if(prefix)
      name = prefix+"."+i;
    else
      name = i;

    if(typeof src[i] == "object") {
      if(src[i].shift) {
        
        if(on_change && src[i] != dest[i])
          on_change(name, dest[i], src[i]);
  
        dest[i] = src[i];
      } else {
        if(typeof dest[i] != "object") {
  
          if(on_change)
            on_change(name, dest[i], src[i]);
     
          dest[i] = {};
        }
        this.UpdateObject(dest[i], src[i], on_change, name);
      }
    } else {
      if(on_change) {
        if(typeof src[i] != typeof dest[i]||src[i] != dest[i])
          on_change(name, dest[i], src[i]);
      }
      dest[i] = src[i];
    }
  }


  return dest;
};

/**
 * Round a number
 * @method qr
 * @param {Number} n
 * @returns {Number} rounded number
 */

TwentyC.util.qr = function(n) {
  return ~~ (n + (n > 0 ? .5 : -.5));
};

/**
 * Check if coordinates are left or right half of shape
 * @method InsideHorizHalf
 * @param {Number} x
 * @param {Number} y
 * @param {Object} box object with coordinates and proportions stored in x,y,w,h
 * @returns {Number} r 0 = not inside, 1 = left, 2 = right
 */

TwentyC.util.InsideHorizHalf = function(x, y, box) {
  if(!this.Inside(x,y,box))
    return 0;

  var mid = box.x + (box.w/2);
  
  return (x < mid ? 1 : 2);
}

/**
 * Check if coordinates are top or bottom half of shape
 * @method InsideVertHalf
 * @param {Number} x
 * @param {Number} y
 * @param {Object} box object with coordinates and proportions stored in x,y,w,h
 * @returns {Number} r 0 = not inside, 1 = top, 2 = bottom
 */

TwentyC.util.InsideVertHalf = function(x, y, box) {
  if(!this.Inside(x,y,box))
    return 0;

  var mid = box.y + (box.h/2);
  
  return (y < mid ? 1 : 2);
}


/**
 * Check if x,y falls into a set of coordinates and proportions {x,y,w,h}
 * @method Inside
 * @param {Number} x
 * @param {Number} y
 * @param {Object} box object with coordinates and proportions stored in x,y,w,h
 * @returns {Boolean} true if x,y is within box, false if not
 */

TwentyC.util.Inside = function(x, y, box) {
  //alert([box.x, box.y, box.w, box.h, x, y]);
  if(!box)
    return false;
  if(x >= box.x && x <= box.x+(box.width||box.w)) {
    if(y >= box.y && y <= box.y+(box.height||box.h))
      return true;
  }
  return false;
};

/******************************************************************************
 * Create a loading gif icon
 * @method LoadingGif
 * @returns {HTMLNode Image} img loading gif icon
 */

/**
 * TwentyC error logger
 */

TwentyCError = {
  errors : [],
  Log : function(err, toConsole) {
    var E;
    if(typeof err == "string") 
      this.errors.push(E={ msg : err, stack : "unknown" });
    else if(typeof err == "object") {
      this.errors.push(E={
        msg : err.toString(),
        stack : err.stack
      });
    }

    while(this.errors.length > 10)
      this.errors.shift();

    if(toConsole && typeof window.console != "undefined")
      console.error(E.msg, E.stack);
  }
}

window.onerror = function(msg, file, line) {
  TwentyCError.Log({
    toString : function() { return msg },
    stack : file+":"+line
  })
}

/******************************************************************************
 * Message bus. Allows ui components to communicate and enhance each other
 * @class Message
 * @static
 * @namespace TwentyC
 */

TwentyC.Message = {

  /**
   * Holds topic listeners indexed by id
   * @property topics
   * @type Object
   * @private
   */

  topics : {},

  /**
   * Add a callback to a topic. Callback will fire whenever the topic
   * receives a message
   * @method Listen
   * @param {String} topic topic name
   * @param {Function} callback
   */

  Listen : function(topic, callback) {
    var tpc = this.AddTopic(topic)
    tpc.subscribe(callback);
  },

  /**
   * Remove callback from a topic.
   * @method RemoveListener
   * @param {String} topic topic name
   * @param {Function} callback
   */

  RemoveListener : function(topic, callback) {
    var tpc = this.AddTopic(topic);
    tpc.unsubscribe(callback);
  },

  /**
   * Send message to a topic
   * @method Send
   * @param {String} topic topic name
   * @param {Object} message
   */

  Send : function(topic, message) {
    var tpc = this.AddTopic(topic)
    tpc.fire(message);
  },

  /**
   */

  AddTopic : function(topic) {
    if(!this.topics[topic]) {
      this.topics[topic] = new TwentyC.cla.EventHandler(topic);
    }
    return this.topics[topic];
  }
}


})();
