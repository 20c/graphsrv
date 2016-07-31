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

TwentyC.widget.Canvas.prototype.Path = function(color, coords, fncName, opType) {
  var ctx = this.GetContext();
  
  if(!ctx)
    return;

  if(!opType || opType == 1) {
    ctx.beginPath();
  }
  ctx.moveTo(coords[0][0], coords[0][1]);
  var i,c;
  for(i = 1; i < coords.length; i++) {
    c = coords[i];
    if(c.length > 2)
      ctx.bezierCurveTo(c[0],c[1],c[2],c[3],c[4],c[5]);
    else
      ctx.lineTo(c[0], c[1]);
  }
  if(!opType || opType == 2) {
    ctx.closePath();
    this.SetState("fillStyle", color);
    ctx[fncName || "fill"]();
  }
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


