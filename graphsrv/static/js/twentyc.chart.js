//#############################################################################
// 20c Chart, chart widget using HTML canvas
// For plotting market data

(function() {

Y = YAHOO;

//#############################################################################
// Set up namespaces

/**
 * Namespace
 * @class TwentyC.widget.Chart
 * @static
 */

TwentyC.widget.Chart = {

  collisionColor : 10711680,

  refCnt : 0,
  
  // utility functions
  util : {},

  // widgets
  widget : {},

  // indicator storage
  indicators : {},

  // drawing tools
  drawingTools : {},

  // hotkey elements - note that drawing tools will automatically
  // add their own hotkey element
  hotkeys : {},

  menu_items : [],

  onChartCreate : new Y.util.CustomEvent("onChartCreate"),

  /**
   * locale messages, like button titles
   * @propery locale
   * @type Object
   */

  locale : {
    assign_hotkey : "Assign Hotkey",
    end_edit_mode : "Exit Layout Editor",
    show_labels : "Show Labels",
    edit_layout : "Toggle Layout Editor",
    indicators : "Add Indicator",
    edit_indicators : "Edit Indicator",
    remove_indicators : "Remove Indicator",
    stop_drawing : "Stop Drawing",
    drawing_tools : "Draw",
    no_data : "No Data"
  },

  /**
   * Cache for image objects, indexed by src
   * @property images
   * @type Object
   */
  images : {},

  /**
   * Date format strings for the various time axis
   * labels, indexed by type (str). Valid types:
   *
   * 1. full
   * 2. year
   * 3. month
   * 4. day
   * 5. hour
   * 6. minute
   * 7. second
   * @property date_tmpl
   * @type Object
   */
  date_tmpl : {
    "full" : "%m %d %h:%i:%s",
    "year" : "%m %d, %Y",
    "month" : "%m %d",
    "day" : "%m %d %h:%i:%s",
    "hour" : "%h:%i:%s",
    "minute" : "%h:%i:%s",
    "second" : "%h:%i:%s"
  }
 

};

var TOOLBAR_HEIGHT = 25;
var XAXIS_HEIGHT = 1;

/**
 * wrap console.log, will do nothing if console.log is not a valid
 * function call
 * @function log
 * @param {String} msg message
 */

function log(msg) {
  if(typeof window.console != "undefined")
    console.log(msg)
}

TwentyC.widget.Chart.log = log;

/**
 * path to image files
 * @property pathImg
 * @type String
 */

TwentyC.widget.Chart.pathImg = "/";

//#############################################################################

/**
 * Extend the context menu
 *
 *     TwentyC.widget.Chart.ExtendMenu("test", function(e, ev, chart) { ... });
 *
 * @method ExtendMenu
 * @param {String} text item label
 * @param {Function} [onclick] callback for onclick
 * @param {Function} [submenu] function that returns submenu instance (gets passed chart as argument) 
 */

TwentyC.widget.Chart.ExtendMenu = function(text, onclick,submenu) {
  this.menu_items.push({
    text: text,
    onclick : onclick,
    submenu : submenu
  });
}

//#############################################################################

/** 
 * Drawing tool storage
 * @class drawingTools
 * @static
 * @namespace TwentyC.widget.Chart
 */

/**
 * dict of drawing tools indexed by unique id
 * @property dict
 * @type Object
 */

TwentyC.widget.Chart.drawingTools.dict = {}

/**
 * list of drawing tool names, sorted alphabetically
 * @property list
 * @type Array
 */

TwentyC.widget.Chart.drawingTools.list = [];

/**
 * Register a drawing tool, making it ready for use within the chart
 * @method Register
 * @param {TwentyC.widget.Chart.widget.DrawingTool} tool drawing tool class (or extension) - not instance
 */

TwentyC.widget.Chart.drawingTools.Register =function(tool) {
  var id = tool.prototype.id;
  if(this.dict[id])
    return;
  this.dict[id] = tool;
  this.list.push(id);
  this.list.sort(function(a,b) {
    var toolA = TwentyC.widget.Chart.drawingTools.dict[a];
    var toolB = TwentyC.widget.Chart.drawingTools.dict[b];
    return toolA.prototype.name>toolB.prototype.name?1:0;
  });

  TwentyC.widget.Chart.hotkeys.Register("draw_"+id, {
    name : "Draw: "+tool.prototype.name,
    icon : tool.prototype.icon, 
    state : function(chart) {
      return chart.drawingTool && chart.drawingTool.name == tool.prototype.name;
    },
    fn : function(chart) {
      
      var instance = chart.drawingTool = new tool().Init();
      instance.onDone.subscribe(function() {
        chart.EndDrawing(true);
      });

      chart.RenderData();
 
    }
  })
}

/**
 * Hotky storage
 * @class hotkeys
 * @static
 * @namespace TwentyC.widget.Chart
 */

/**
 * dict of hotkeys indexed by unique id
 * @property dict
 * @type Object
 */

TwentyC.widget.Chart.hotkeys.dict = {}

/**
 * list of hotkey names, sorted alphabetically
 * @property list
 * @type Array
 */

TwentyC.widget.Chart.hotkeys.list = [];

/**
 * Register a hotkey, making it ready for use within the chart
 * @method Register
 * @param {Mixed} id unique id for the hotkey
 * @param {Object} hotkey object literal describing the hotkey
 */

TwentyC.widget.Chart.hotkeys.Register =function(id, hotkey) {
  if(this.dict[id])
    return;
  hotkey.id = id;
  this.dict[id] = hotkey;
  this.list.push(id);
  this.list.sort(function(a,b) {
    var hotkeyA = TwentyC.widget.Chart.hotkeys.dict[a];
    var hotkeyB = TwentyC.widget.Chart.hotkeys.dict[b];
    return hotkeyA.name>hotkeyB.name?1:0;
  });
}

//#############################################################################
// Core hotkeys

// Toggle edit layout 

TwentyC.widget.Chart.hotkeys.Register("tgl_edit_layout", {
  name : TwentyC.widget.Chart.locale.edit_layout,
  icon : function() { return TwentyC.widget.Chart.pathImg+"/ico-tgl-editor.png" },
  state : function(chart) {
    return chart.editMode;
  },
  fn : function(chart) {
    return chart.TglEditMode(chart.editMode?0:1);
  }
});


// Add Indicator

TwentyC.widget.Chart.hotkeys.Register("add_indicator", {
  name : TwentyC.widget.Chart.locale.indicators,
  icon : function() { return TwentyC.widget.Chart.pathImg+"/ico-add-indicator.png" },
  fn : function(chart) {
    return chart.indicatorMenu.menu;
  }
});

// Crosshair

TwentyC.widget.Chart.hotkeys.Register("crosshair", {
  name : TwentyC.widget.Chart.locale.stop_drawing,
  icon : function() { return TwentyC.widget.Chart.pathImg+"/ico-crosshair.png" },
  state : function(chart) { return chart.drawingTool ? false : true },
  fn : function(chart) {
    return chart.EndDrawing();
  }
});



//#############################################################################

/**
 * Indicator storage
 * @class indicators
 * @namespace TwentyC.widget.Chart
 * @static
 */

/**
 * dict of indicators indexed by unique id
 * @property dict
 * @type {Object}
 */

TwentyC.widget.Chart.indicators.dict  = {};

/**
 * list of indicator ids, sorted alphabetically
 * @property list
 * @type {Array}
 */

TwentyC.widget.Chart.indicators.list = [];

/**
 * Register an indicator, making it ready for use within the chart
 * @method Register
 * @param {String} id unique id
 * @param {TwentyC.widget.Chart.widget.Graph} graph indicator graph class (not instance)
 */

TwentyC.widget.Chart.indicators.Register = function(id, graph) {
  if(this.dict[id])
    return;
  graph.prototype.id = id;
  this.dict[id] = graph;
  this.list.push(id);
  this.list.sort(function(a,b) {
    var graphA = TwentyC.widget.Chart.indicators.dict[a];
    var graphB = TwentyC.widget.Chart.indicators.dict[b];
    return graphA.prototype.title>graphB.prototype.title?1:0;
  });
};

//#############################################################################


/**
 * Utility functions
 * @class util
 * @namespace TwentyC
 * @static
 */

/**
 * Create an image node and set source on it
 * @method Img
 * @param {String} source
 * @param {String} altText 
 * @param {Boolean} independentPath if true TwentyC.widget.Chart.pathImg will NOT be prepended to source
 * @returns {HTMLImg Element} the image element that was created
 */

TwentyC.util.Img = function(source, altText, independentPath) {
  var img = document.createElement('img');
  if(!independentPath)
    source = TwentyC.widget.Chart.pathImg + "/" + source;
  img.src= source;
  img.alt = altText;
  img.title = altText;
  return img;
};

//#############################################################################

/**
 * Canvas abstraction
 * @class Canvas
 * @namespace TwentyC.widget.Chart.widget
 * @constructor
 */


//#############################################################################

/**
 * Graph object that handles graphing calculations, Indicator objects
 * should extend this
 * @class Graph
 * @namespace TwentyC.widget.Chart.widget
 * @constructor
 */

var Graph = TwentyC.widget.Chart.widget.Graph = function() {};

/** 
 * Initialize the graph object, creating properties
 * and event handlers, this function is also mapped to Init(), if you're
 * extending this object, you should override Init and call InitGraph() from
 * within your new init function
 * @method InitGraph()
 * @param {Object} config
 * @returns {TwentyC.widget.Chart.widget.Graph} self
 */

Graph.prototype.Init = 
Graph.prototype.InitGraph = function(config) {

  this.type = "graph";

  /**
   * Allows you to set custom limit adjusters that can manipulate min/max limit
   * values during SetLimit()
   *
   *     this.limit_adjusters.my_adjuster = function(graph) {
   *       graph.maxY = 999999;
   *     }
   *
   * @property limit_adjusters
   * @type Object
   */

  this.limit_adjusters = {};

  /**
   * Force bottom Y axis limit
   * @property forceMinY
   * @type Number
   * @default undefined
   */

  /** 
   * Force top Y axis limit
   * @property forceMaxY
   * @type Number
   * @default undefined
   */

  /**
   * Set default height for graph when not overlayed onto another graph, in pixels
   * @property defaultHeight
   * @type Number
   * @default undefined
   */

  /**
   * Holds the collision color of this graph as a decimal value
   * Automatically assigned during ctor and unique to this graph.
   * @property collisionColor
   * @type String
   */

  this.collisionColor = "#"+(TwentyC.widget.Chart.collisionColor++).toString(16);

  /**
   * Set to true if graph's x axis is independent of the chart's time
   * scale.
   * @property custom_x_axis
   * @type Boolean
   * @default false
   */

  this.custom_x_axis = false;
 
  /**
   * Stores the plot data inside this graph
   * @property data
   * @type Array
   */

  this.data = [];
  
  /**
   * Holds all the graphs that are overlayed onto this graph. 
   *
   * Storage structure is as follows
   *
   *     [
   *       [graph, graph.id],
   *       ...
   *     ]
   *
   * @property overlayed
   * @type Array
   */
  
  this.overlayed = [];
  
  /**
   * Holds all the drawings on this graph
   *
   * @property drawings
   * @type Array
   */
  
  this.drawings = [];

  /**
   * Defines the precision of y axis values
   * @property precision
   * @type Number
   * @default 0
   */

  this.precision = 0;

  /**
   * If y axis value is a 20c valid price you can
   * store it's price_format value in here
   * @property price_format
   * @type Number
   * @default null
   */

  this.price_format = null;
  
  /**
   * Tick size for y axis values
   * @property tick_size
   * @type Number
   * @default 1
   */
  
  this.tick_size = 1;

  /**
   * If true and data_type matches with parent's data_type then this graph's y scale
   * will be synced tothe parent graph
   * @property sync_scale
   * @type Boolean
   * @default true
   */

  this.sync_scale = true;

  /**
   * If true parent's scale will not be synced to this graph's y scale
   * should it fall out of the parent's scale
   * @property dont_sync_parent_scale
   * @type Boolean
   * @default false
   */

  this.dont_sync_parent_scale = false;
  
  /**
   * Zoom level of the y axis. Means graph view will be zoomed out n ticks
   * on the y axis both above and below the current y axis value.
   * @property y_zoom
   * @type Number
   * @default 10
   */
  
  this.y_zoom = 10;

  /**
   * Max value for the y axis (y axis top value). Will be automatically calculated.
   * @property maxY
   * @type Number
   */

  this.maxY = 0;

  /**
   * Min value for the y axis (y axis bottom value). Will be automatically calculated.
   * @property minY
   * @type Number
   */
  
  this.minY = 99999999999999;
  
  /**
   * Max value for the x axis (x axis right value). Will be automatically calculated
   * @property maxX
   * @type Number
   */
  
  this.maxX = 0;
  
  /**
   * Min value for the x axis (x axis left value). Will be automatically calculated
   * @property minX
   * @type Number
   */
  
  this.minX = null;

  /**
   * Amount of plot points accross the x axis
   * Only set after graph has been added to a chart 
   * @property plotPointsX
   * @type Number
   */

  this.plotPointsX = 0;
    
   /**
   * Amount of plot points across the y axis
   * Only set after graph has been added to a chart 
   * @property plotPointsY
   * @type Number
   */
    
  this.plotPointsY = 0;

  /**
   * plot point width , note that this is not bar width, for bar width check this.barW
   * Only set after graph has been added to a chart 
   * @property plotPointW
   * @type Number
   */

  this.plotPointW = 0;
    
  /**
   * plot point height
   * Only set after graph has been added to a chart 
   * @property plotPointH
   * @type Number
   */
  
  this.plotPointH = 0;
    
  /**
   * bar width - 75% of this.plotPointW
   * Only set after graph has been added to a chart 
   * @property barW
   * @type Number
   */

  this.barW = 0;

  /**
   * graph width in pixels
   * Only set after graph has been added to a chart 
   * @property width
   * @type Number
   */

  this.width = 0;
  
  /**
   * graph height in pixels
   * Only set after graph has been added to a chart 
   * @property height
   * @type Number
   */

  this.height = 0;

  /**
   * graph x offset in pixels (absolute to chart container)
   * Only set after graph has been added to a chart 
   * @property x
   * @type Number
   */

  this.x = 0;

  /**
   * graph y offset in pixels (absolute to chart container)
   * Only set after graph has been added to a chart 
   * @property y
   * @type Number
   */

  this.y = 0;
  
  /**
   * graph x offset + width in pixels (absolute to chart container)
   * Only set after graph has been added to a chart 
   * @property r
   * @type Number
   */

  this.r = 0;

  /**
   * graph y offset + height in pixels (absolute to chart container)
   * Only set after graph has been added to a chart 
   * @property b
   * @type Number
   */

  this.b = 0;

  /**
   * Fires during the call of the render function. Allows you to make changes to what
   * colors are being rendered before the rendering takes place.
   * @event onRenderPlot
   * @param {Chart} chart
   * @param {Graph} graph
   * @param {String} plot_name name of the plot being rendered
   * @param {Number} line_thickness
   * @param {Object} colors the colors currently set buy the render call. make changes in here if needed.
   * @param {Object} current plot data being rendered with this called
   * @param {Object|null} prev plot data that was rendered before the current one
   */

  this.onRenderPlot = new Y.util.CustomEvent("onRenderPlot");

  /**
   * Fires when all of the graph's current visible plot points have been rendered
   * @event onRenderPlots
   */

  this.onRenderPlots = new Y.util.CustomEvent("onRenderPlots");

  /*
   * Fires before calculations take place
   * @event beforeCalculate
   */

  this.beforeCalculate = new Y.util.CustomEvent("beforeCalculate");

  /**
   * Fires when the current plot point (eg. in most cases the one at the right end of the chart) is drawn.
   * @event onDrawCurrent
   */

  this.onDrawCurrent = new Y.util.CustomEvent("onDrawCurrent");

  /**
   * Fires when the graph is being added to a chart
   * @event onAddToChart
   * @param {Chart} chart
   * @param {Graph} graph
   */

  this.onAddToChart = new Y.util.CustomEvent("onAddToChart");

  /**
   * Fires when the graph is being removed from a chart
   * @event onRemoveFromChart
   * @param {Chart} chart
   * @param {Graph} graph
   */
  
  this.onRemoveFromChart = new Y.util.CustomEvent("onRemoveFromChart");

 
  /**
   * Overrideable draw function. Will be called for each plot point to be drawn.
   * You only need to override this if you dont want to make use of the default
   * drawing functions TwentyC.widget.Chart offers (such as candle sticks, lines and columns).
   * @method draw
   * @param {TwentyC.widget.Chart.Chart} chart reference to the chart object this graph belongs to
   * @param {TwentyC.widget.Chart.Graph) graph reference to self
   * @param {Object} plot object literal of plot point to be drawn
   * @param {Object} prev object literal of previous plot point (if it exists)
   * @param {String} plotName name of the plot that is being drawn (eg. sma)
   * @param {Number} plotIndex index of plot object in graph.data
   * @param {Number} startIndex index of the first plot point
   * @param {Number} endIndex index of the last plot point
   */
  
  this.draw = function(chart, graph, plot, prev, plotName, plotIndex, start, end) {
    var renderFncName = graph.config.plots[plotName].renderFncName;
    if(chart[renderFncName])
      chart[renderFncName](graph, plot, prev, plotName, plotIndex, start, end);
    else if(graph[renderFncName]) {
      graph[renderFncName](graph, plot, prev, plotName, plotIndex, start, end); 
    } else {
      console.log("Unknown graph render function: ", renderFncName);
    }
  };

  /**
   * Object liteal holding config properties. See attributes on more information on config.
   * @property config
   * @type Object
   */

  this.config = {
    
    /**
     * Defines the opacity value of the graph.
     * @config opacity
     * @type Number
     * @default 1
     */

    opacity : 1,

    /**
     * Defines whether graph information is shown in the upper left corner
     * or not
     * @config show_info_labels
     * @type Boolean
     * @default True
     */

    show_info_labels : true,
    
    /**
     * Holds the config for each plot, indexed by plot name
     * @config plots
     * @type Object
     */
    
    plots : {
      
      /**
       * Holds the config for the main plot. This is nested in the plots object literal.
       * @config plots.main
       * @type Object
       */
      
      main : {
        
        /**
         * Set to false if you want to show a marker for this plot on the y axis
         * @config plots.main.mark_disabled
         * @type Boolean
         * @default True
         */

        mark_disabled : true,

        /**
         * If mark is enabled (see mark_disabled config) this allows you to specify
         * a prefix text for the marker.
         * @config plots.main.mark_prefix
         * @type Text
         * @default undefined
         */
        
        /**
         * Color config for the main plot. This is nested in plots.main. Note that these colors are only relevant as long as you
         * do not override the graph's draw() function to substitute it with your own. Of course you can always make your individual draw
         * function read these config properties anyways.
         * @config plots.main.colors
         * @type Object
         */

        /**
         * Toggles borders on or off for the main plot
         * @config plots.main.borders
         * @type Boolean
         * @default false
         */

        borders: false,

        /**
         * Toggles whether shapes should be filled or not for the main plot
         * @config plots.main.fill
         * @type Boolean
         * @default true
         */

        fill : true,
 
        
        colors : {
          
          /**
           * Main plot color for negative representation. Can be any valid HTML color string.
           * @config plots.main.colors.negative
           * @type String
           * @default 'red'
           */
          
          negative : "red",
          
          /**
           * Main plot color for positive representation. Can be any valid HTML color string.
           * @config plots.main.colors.positive
           * @type String
           * @default 'lime'
           */
          
          positive : "lime",
          
          /**
           * Main plot color for negative representation of borders. Can be any valid HTML color string.
           * @config plots.main.colors.border_negative
           * @type String
           * @default '#FF8361'
           */
 
          border_negative : "#FF8361",
          
          /**
           * Main plot color for positive representation of borders. Can be any valid HTML color string.
           * @config plots.main.colors.border_positive
           * @type String
           * @default '#E9FF59'
           */
 
          border_positive : "#E9FF59",

          /**
           * Main plot color for neutral representation of borders. Can be any valid HTML color string.
           * @config plots.main.colors.border_positive
           * @type String
           * @default '#FFF'
           */
 
          border_neutral : "#FFF",

         
          /**
           * Main plot color for neutral representation. Can be any valid HTML color string
           * @config plots.main.colors.neutral
           * @type String
           * @default 'white'
           */
          
          neutral : "white",
          
          /**
           * Main plot background color for y axis marker. Can be any valid HTML color string
           * @config plots.main.colors.mark_bgc
           * @type String
           * @default '#999999'
           */
          
          mark_bgc : "#999",
          
          /**
           * Main plot font color for the y axis marker. Can be any valid HTML color string
           * @config plots.main.colors.mark_fc
           * @type String
           * @default "#000"
           */
          
          mark_fc : "#000"
        },
        
        /**
         * Specify off of which property to read the value for the main plot's plot points.
         * @config plots.main.plotValue
         * @type String
         * @default "price"
         */

        plotValue : "price",
        
        /**
         * The render function name to use for the main plot. Note that this is only relevant as long as you do not
         * override the graph's draw() functionto substitute with your own.
         * 
         * Default valid render functions:
         *
         * 1. RenderLine
         * 2. RenderCandlestick
         * 3. RenderColumn
         *
         * Render functions need to be defined either on the chart class or the graph itself
         *
         * @config plots.main.renderFncname
         * @type String
         * @default "RenderLine"
         */
        
        renderFncName : "RenderLine",
          
        /**
         * Main plot line thickness (for rendering options where it applies)
         * @config plots.main.line_thickness
         * @type Number
         * @default 1
         */

        line_thickness : 1
 
      }
    } 
  };

  /**
   * Specify which render styles are valid for this indicator. They will be selectable
   * by the user in the indicator preferences.
   *
   * Each item in the list should be an array holding a user friendly label as the first
   * element and the targeted render function name as the second argument
   *
   *     renderStyles = [
   *       ["Line", "RenderLine"],
   *       ["Columns", "RenderColumn"]
   *     ]
   *
   * @property renderStyles
   * @type Array
   */

  this.renderStyles = [
    ["Line", "RenderLine"],
    ["Columns", "RenderColumn"]
  ];

  this.lineThickness = [
    ["1px", 1],
    ["2px", 2],
    ["3px", 3],
    ["5px", 5],
    ["8px", 8],
  ];

  /**
   * Holds graph label setup. (Labels that are displayed in the upper left corner of the graph)
   *
   * Labels should be indexed by the property name they are targeting. That means for a marketdata graph
   * that tracks price, high, low, open and close we could set up something like this.
   *
   *     this.labels = {
   *       
   *       // price label
   *       price : {
   *         // specify how to color the label, use the predefined PosOrNeg function 
   *         // that colors positive or negative numbers accordingly
   *         fnColor : this.PosOrNeg,
   *
   *         // specify how the value is supposed to be calculated.
   *         // use the predefined Diff function to calculate the difference to the previous price
   *         fnCalc : this.Diff,
   *
   *         // since this is the main value were plotting we want an empty label for it
   *         title : " "
   *
   *       },
   *
   *       // close label
   *       close : {
   *         fnColor : this.PosOrNeg
   *         title : "C"
   *       },
   *
   *       ...
   *     }
   *
   * @property labels
   * @type Object
   */

  this.labels = {
    high : {
      fnColor : this.PosOrNeg,
      title : "H"
    },
    low : {
      fnColor : this.PosOrNeg,
      title : "L"
    },
    open : {
      fnColor : this.PosOrNeg,
      title : "O"
    },
    close : {
      fnColor : this.PosOrNeg,
      title : "C"
    },
    price : {
      fnColor : this.PosOrNeg,
      fnCalc : this.Diff,
      title : " "
    }
  }

  TwentyC.util.UpdateObject(this.config, config);

  var graph = this;

  /**
   * Define the preferences UI for this graph. Note that it's trivial to setup a new plot, including plot
   * preferences using the NewPlot method. But for a deeper understanding on how the plot preference ui is
   * defined, read on.
   *
   * Since a graph can have multiple plots, we need to index a pref definition object literal for each plot name.
   *
   *     this.prefs.plots.main = { ... }
   *
   * Within the plot definition we can then setup manipulator object for all the config properties we want
   * to target.
   *
   * Each manipulator object literal should have a get and a set function, a label and a type. The get function
   * allows reading of the config value into the prefs ui. The set function allows commiting the changes made in
   * the prefs ui back to config.
   *
   * The label property allows to specifiy a user-friendly label for the manipulator (option).
   *
   * And finally the type specifies the user input type use for manipulating
   *
   *     this.prefs.plots.main.color_neutral = {
   *       get : function(plot) { return graph.config.plots[plot].colors.neutral },
   *       set : function(plot, v) { graph.config.plots[plot].colors.neutral = v },
   *       label : "Neutral Color",
   *       type : "color"
   *     }
   *
   * or
   *
   *    display : {
   *      get : function(plot) { return graph.config.plots[plot].renderFncName },
   *      set : function(plot, v) { graph.config.plots[plot].renderFncName = v },
   *      label : "Display",
   *      type : "list",
   *      items : function(plot) {
   *        return graph.RenderStyles(plot);
   *      }
   *    }
   *
   * Valid input types:
   *
   * 1. text - plain text input
   * 2. list - list input (needs items property, see example above)
   * 3. color - color input
   *
   * @property prefs
   * @type Object
   */

  this.prefs = {
    plots : {
      _title : "Plots",
      _sectionSelect : true,
    main : {
    display : {
      get : function(plot) { return graph.config.plots[plot].renderFncName },
      set : function(plot, v) { graph.config.plots[plot].renderFncName = v },
      label : "Display",
      type : "list",
      items : function(plot) {
        return graph.RenderStyles(plot);
      }
    },

    toggle_fill : {
      get : function(plot) { return graph.config.plots[plot].fill },
      set : function(plot,v) { graph.config.plots[plot].fill = v?true:false},
      label : "Fill Shapes",
      type : "checkbox"
    },
    color_neutral : {
      get : function(plot) { return graph.config.plots[plot].colors.neutral },
      set : function(plot, v) { graph.config.plots[plot].colors.neutral = v },
      label : "Neutral Color",
      type : "color"
    },
    color_negative : {
      get : function(plot) { return graph.config.plots[plot].colors.negative },
      set : function(plot,v) { graph.config.plots[plot].colors.negative = v },
      label : "Negative Color",
      type : "color"
    },
    color_positive : {
      get : function(plot) { return graph.config.plots[plot].colors.positive },
      set : function(plot,v) { graph.config.plots[plot].colors.positive = v },
      label : "Positive Color",
      type : "color"
    },
    mark_disabled : {
      get : function(plot) { return graph.config.plots[plot].mark_disabled ? false : true },
      set : function(plot, v) { graph.config.plots[plot].mark_disabled = v ? false : true },
      label : "Y Axis Marker",
      type : "checkbox"
    },
    color_mark_bgc : {
      get : function(plot) { return graph.config.plots[plot].colors.mark_bgc },
      set : function(plot,v) { graph.config.plots[plot].colors.mark_bgc = v },
      label : "Marker Color",
      type : "color"
    },
    color_mark_fc : {
      get : function(plot) { return graph.config.plots[plot].colors.mark_fc },
      set : function(plot,v) { graph.config.plots[plot].colors.mark_fc = v },
      label : "Marker Font Color",
      type : "color"
    },
    toggle_borders : {
      get : function(plot) { return graph.config.plots[plot].borders },
      set : function(plot,v) { graph.config.plots[plot].borders = v?true:false},
      label : "Enable Outlines",
      type : "checkbox"
    },
    color_border_negative : {
      get : function(plot) { return graph.config.plots[plot].colors.border_negative },
      set : function(plot,v) { graph.config.plots[plot].colors.border_negative = v },
      label : "Negative Outline",
      type : "color"
    },
    color_border_positive : {
      get : function(plot) { return graph.config.plots[plot].colors.border_positive },
      set : function(plot,v) { graph.config.plots[plot].colors.border_positive = v },
      label : "Positive Outline",
      type : "color"
    },
    color_border_neutral : {
      get : function(plot) { return graph.config.plots[plot].colors.border_neutral },
      set : function(plot,v) { graph.config.plots[plot].colors.border_neutral = v },
      label : "Neutral Outline",
      type : "color"
    },
    line_thickness : {
      get : function(plot) { return graph.config.plots[plot].line_thickness },
      set : function(plot, v) { graph.config.plots[plot].line_thickness = parseInt(v) },
      label : "Line Thickness",
      type : "list",
      items : function(plot) {
        return graph.lineThickness
      }
    }
 
    }
    },
    show_info_labels : {
      get : function() { return graph.config.show_info_labels },
      set : function(ignore,v) { 
        graph.config.show_info_labels = v ? true : false;
      },
      label : TwentyC.widget.Chart.locale.show_labels,
      type : "checkbox"
    },
    opacity : {
      get : function() { return graph.config.opacity },
      set : function(ignore,v) { 
        v = parseFloat(v);
        if(v > 1)
          v = 1;
        else if(v < 0)
          v = 0;
        graph.config.opacity = v
      },
      label : "Opacity",
      type : "text"
    }
  }

  /**
   * holds plot id to user readable name translations
   * @property plotName
   * @type {Object}
   */
  
  this.plotName = {};

  /*
   * Handle drawing of the y axis marker of a plot - if its enabled
   */
  
  this.onDrawCurrent.subscribe(function(e,d) {
    var chart = d[0].chart;
    var plot = d[0].plot;
    var graph = d[0].graph;
    var plotName = d[0].plotName;
    var cfg = graph.config.plots[plotName]
    
    /*if y axis marker is disabled via config, bail */
   
    if(cfg.mark_disabled)
      return;

    // Format the label for the marker
    var label = graph.FormatTickValue(plot[cfg.plotValue], cfg.unvalidated);

    // apply label prefix
    if(cfg.mark_prefix)
      label = cfg.mark_prefix+label;

    // render marker
    chart.RenderPriceMark(
      graph,
      plot[cfg.plotValue], 
      label,
      cfg.colors.mark_bgc,
      cfg.colors.mark_fc
    ); 
  });


  return this;
};

/******************************************************************************
 * Return whether the mouse pointer is currently touching this graph's resize
 * panes for height resize.
 *
 * @method ResizePaneTouched
 * @returns Number status 1 = top, 2 = bottom, 0 = not touched
 */

Graph.prototype.ResizePaneTouched = function() {

  var C = this.chart;
  var ins = TwentyC.util.Inside;

  if(this.name == "main") 
    return 0;
  
  if(ins(C.mouseX, C.mouseY, {
    x : this.x,
    y : this.y,
    width : this.width,
    height : 10
  })) {
    return 1;
  }

  if(ins(C.mouseX, C.mouseY, {
     x : this.x,
     y : this.b-10,
     width : this.width,
     height: 10
  })) {
    return 2;
  }

  return 0;
 
}

/******************************************************************************
 * Return field name of field that is plotted to x axis - when
 * custom_x_axis is not defined this will return "time" as default otherwise
 * it will return what ever is stored in custom_x_axis.field
 * @method XAxisField
 * @returns {String}
 */

Graph.prototype.XAxisField = function() {
  if(this.custom_x_axis) {
    return this.custom_x_axis.field || "time";
  }
  return "time";
};

/******************************************************************************
 * Return the value of a specified plot value at the specific index
 * @method GetValueForPlotName
 * @param {Number} index
 * @param {String} name plot name as specified in NewPlot
 * @param {String} field field name
 */

Graph.prototype.GetValueForPlotName = function(index, name, field) {
  if(this.data[index]) {
    return this.data[index].plots[name][field];
  }
  return null;
};

/******************************************************************************
 * Return plot data in array form for the specified plot
 * @method GetDataForPlotName
 * @param {String} name plot Name as specified in NewPlot
 * @returns {Array} array of plot points
 */

Graph.prototype.GetDataForPlotName = function(name) {
  var rv = [], i;
  for(i = 0; i < this.data.length; i++) {
    rv.push(this.data[i].plots[name]);
  }
  return rv;
};

/******************************************************************************
 * Set up a new plot. Use this if you want to do a multi plot graph or just 
 * dont want to use the default main plot
 * @method NewPlot
 * @param {String} id unique (to this graph) plot id
 * @param {String} name user friendly name for this plot
 * @param {String} plotValue specify which value from the data row you want to use for plotting (eg. "price")
 * @param {String} [cloneFrom=main] specify which plot setup you want to clone (clones config and preferenc ui definition)
 */

Graph.prototype.NewPlot = function(id, name, plotValue, cloneFrom) {
  if(!cloneFrom)
    var cloneFrom = "main";
 
  var plot = {};
  TwentyC.util.UpdateObject(plot, this.config.plots[cloneFrom]);
  plot.plotValue = plotValue;
  this.prefs.plots[id] = this.prefs.plots[cloneFrom];
  this.config.plots[id] = plot;
  this.plotName[id] = name;
};

/******************************************************************************
 * Add a new color to preferences of this graph
 * @method PrefsAddColor
 */

Graph.prototype.PrefsColorAdd = function(plot, id, label) {
  this.prefs["color_"+id] = {
    get : function(plot) { return graph.config.plots[plot].colors[id] },
    set : function(plot,v) { graph.config.plots[plot].colors[id] = v },
    label : label,
    type : "color"
  }
}

/******************************************************************************
 * Return an array holding valid Render styles and their respective render
 * functions for the specified plot
 * 
 *     var styles = graph.RenderStyles("main")
 *
 *     [
 *       ["Line", "RendeLine"],
 *       ["Columns", "RenderColumn"],
 *       ["Candlestick", "RenderCandlestick"]
 *     ]
 *
 * @method RenderStyles
 * @param {String} plot plot id
 * @returns {Array} render styles 
 */

Graph.prototype.RenderStyles = function(plot) {
  var d = this.data[this.data.length-1];

  if(d) {
    d = d.plots[plot];
  }

  var lst = this.renderStyles, i;

  if(d.high && d.low && d.open && d.close) {
    for(i in lst) {
      if(lst[i][1] == "RenderCandlestick")
        return lst;
    }
    lst.push(["Candlestick", "RenderCandlestick"]);
  };
  return lst;
};

/******************************************************************************
 * Returns the label positional order for the graph relative to it's overlay
 * siblings and it's parent according to their position in graphsOrder
 * @method LabelPosition
 * @returns Number
 */

Graph.prototype.LabelPosition = function() {
  var k, i, j, o = this.chart.graphsOrder;
  for(k = 0, i = 0; k < o.length; k++) {
    if(o[k] == this)
      return i;
    if(this.par) {
      if(this.par == o[k]) {
        i++;
        continue;
      }
      for(j = 0; j < this.par.overlayed.length; j++) {
        if(this.par.overlayed[j][1] == o[k]) {
          i++;
          break;
        }
      }
    } else if(this.overlayed) {
      for(j = 0; j < this.overlayed.length; j++) {
        if(this.overlayed[j][1] == o[k]) {
          i++;
          break;
        }
      }
    }
  }
  return -1;
};

/******************************************************************************
 * If graph is overlayed onto another graph return the graph's overlay index.
 * Return -1 if not overlayed.
 * @method ParentIndex
 * @returns Number overlay index
 */

Graph.prototype.ParentIndex = function() {
  if(this.par) {
    var i, k;
    for(k = 0; k < this.chart.graphsOrder.length; k++) {
      for(i  = 0; i < this.par.overlayed.length; i++) {
        if(this.par.overlayed[i][1] == this && this.chart.graphsOrder[k] == this)
          return k-1;
      }
    }
    return -1;
  };
};

/******************************************************************************
 * Return if this graph has other graphs overlayed or not
 * @method HasOverlay
 * @returns Boolean 
 */

Graph.prototype.HasOverlay = function(graph) {
  var i;
  for(i in this.overlayed) {
    if(this.overlayed[i][0] == graph.Id())
      return true;
  }
  return false;
};

/******************************************************************************
 * Remove a drawing from the graph.
 * @method RemoveDrawing
 * @param {TwentyC.widget.Chart.widget.DrawingTool} drawing drawing to remove 
 */

Graph.prototype.RemoveDrawing = function(drawing) {
  var idx = TwentyC.util.InArray(drawing, this.drawings);
  if(idx > -1) {
    this.drawings.splice(idx, 1);
    this.chart.RenderData();
  }
};

/******************************************************************************
 * Overlay this graph onto another graph
 * @method SetParent
 * @param {TwentyC.widget.Chart.widget.Graph} par parent graph
 */

Graph.prototype.SetParent = function(par) {
  if(!par)
    return;
   
  // check if graph type already exists as overlay
  // for parent, bail if so

  if(par.HasOverlay(this)) {
    this.overlay = null;
    return;
  }

  // remove graph from old parent, if exists
  if(this.par) {
    var idx = this.ParentIndex();
    if(idx > -1) {
      this.par.overlayed.splice(idx,1);
    }
    this.par = null;
  };

  this.par = par;
  par.overlayed.push([this.Id(), this]);
  this.overlay = par.name;


};

/******************************************************************************
 * Returns the user friendly title for this graph. You may want to override
 * this when making your own graph. By default it will return whatever is
 * stored in this.title or this.name, which priority given to this title.
 * @method Title
 * @returns {String} title
 */

Graph.prototype.Title = function() {
  return this.title||this.name;
};

/******************************************************************************
 * Returns the graph's id
 * @method Id
 * @returns {String} id
 */

Graph.prototype.Id = function() {
  return this.id;
};

/******************************************************************************
 * Re-calculate the graph's plot points. 
 * @method RedoCalc
 */

Graph.prototype.RedoCalc = function() {
  var chart = this.chart;
  var n, source = chart.source;
  this.data = [];
  this.error = null;
  if(!source)
    return;
  for(n = 0; n < source.length; n++) {
    this.NewBar(chart, source, n);
  }

}

/******************************************************************************
 * Push a new data point onto the graph data
 * @method Update
 * @param {Number} i index of the data point in the data set
 * @param {Object} plot object literal of data point
 */

Graph.prototype.Update = function(i, plot, fireEvents) {
  //this.SetLimits(plot);
  if(!this.custom_x_axis) {
    if(i >= this.data.length) {
      this.data.push(plot);
    
      if(fireEvents) {
        
        this.chart.onBarOpen.fire({
          chart : this.chart,
          graph : this,
          bar : this.data[this.data.length-1]
        });
        
        if(this.data.length > 1) {
          this.chart.onBarClose.fire({
            chart : this.chart,
            graph : this,
            bar : this.data[this.data.length-2]
          });
        }

      }
    
    } else {
      this.data[i] = plot;
    }
  } else {
    if(!this.custom_x_axis.calc_mode) {
      var k,r;
      for(k in plot) {
        r = parseInt(k);
        this.data[r] = plot[k];
      }
    } else if(this.custom_x_axis.calc_mode == "replace") {
      this.data = plot;
    }
  }
};

/******************************************************************************
 * Handle errors that happen in graph calculations. These errors will
 * be handled gracefully and will not stop the entire javascript execution
 * @method HandleError
 * @param {Error} err
 * @private
 */


Graph.prototype.HandleError = function(err) {
  if(!this.error) {
    this.error = err;
    if(typeof window.console != "undefined") {
      console.log("Error in graph "+this.Title()+", error object follows on next line");
      console.log(err.message)
      console.log("line "+err.lineNumber)
      console.trace(err)
    }
  }
};

/******************************************************************************
 * For marketdata graphs. Opens a new bar (plot point).
 * @method NewBar
 * @private
 * @param {TwentyC.widget.Chart.widget.Chart} chart chart this graph belongs to
 * @param {Object|Array} source object literal or array of market data bars
 * @param {Number} i index of bar within source
 */

Graph.prototype.NewBar = function(chart, source, i, fireEvents) {
  if(this.error) {
    return;
  }

  try {
    
    if(this.on_open) {
      this.Update(
        i,
        this.on_open(chart, i, i>0 ? source[i-1] : null, source[i], i>0 ? this.data[i-1] : null),
        fireEvents
      )
    } 
    if(this.on_close && i > 0) {
      this.Update(
        i,
        this.on_close(chart, i-1, i>1 ? source[i-2] : null, source[i-1], i>0 ? this.data[i-2] : null),
        fireEvents
      )

    }

  } catch(err) {
    this.HandleError(err);
  }
};

/******************************************************************************
 * For marketdata graphs. Update an existing bar (plot point)
 * @method UpdateBar
 * @private
 * @param {TwentyC.widget.Chart.widget.Chart} chart chart this graph belongs to
 * @param {Object|Array} source object literal or array of market data bars
 * @param {Number} i index of bar within source
 */

Graph.prototype.UpdateBar = function(chart, source, i) {
  if(this.error)
    return;

  try {
  if(this.data[i]) {
    if(this.on_change) {
      this.Update(
        i,
        this.on_change(chart, i, i>0 ? source[i-1] : null, source[i], i>0 ? this.data[i-1] : null)
      );
    }
  }
  } catch(err) {
    this.HandleError(err);
  }

};

/******************************************************************************
 * Set the limits for the graph's axes using a data point.
 * @method SetLimits
 * @private
 * @param {Object} data object literal of data point (eg. a bar for marketdata graphs)
 */

Graph.prototype.SetLimits = function(data) {
  var r, i, plot, k;
  if(!data)
    return;

  for(i in data.plots) {
    plot = data.plots[i];
    k = this.config.plots[i].plotValue;
    if(!plot[k]&&!plot.high)
      continue;

    this.maxX = Math.max(this.maxX, plot[this.XAxisField()]);
    this.minX = this.minX === null ? plot[this.XAxisField()] : Math.min(this.minX, plot[this.XAxisField()]);

    if(typeof this.forceMaxY != "undefined")
      this.maxY = this.forceMaxY;
    else
      this.maxY = Math.ceil(Math.max(this.maxY, plot.high||plot[k]));
    if(typeof this.forceMinY != "undefined")
      this.minY = this.forceMinY;
    else
      this.minY = Math.floor(Math.min(this.minY, plot.low||plot[k]));
  }

};

Graph.prototype.SetLimitsViaAdjusters = function() {
  for(i in this.limit_adjusters) {
    this.limit_adjusters[i](this);
  }
}

Graph.prototype.Draw = function() {};
Graph.prototype.Calc = function() {};


/******************************************************************************
 * Format a value on the x axis. This function is only relevant with 
 * custom_x_axis enabled and will not be used otherwise. Override this to
 * do your formatting when you enable custom_x_axis
 * enabled
 * @method FormatTickValueX
 * @param {Number} m value (eg. time)
 * @param {Boolean} noValidate if true value wont be validated to the nearest tick
 * @returns {String} formatted number
 */

Graph.prototype.FormatTickValueX = function(n, noValidate) {
  return n;
};

/******************************************************************************
 * Format the values on the y axis. By default this function assumes the
 * graph is plotting prices on the y axis. You will want to override this function
 * if your graph is plotting something else.
 * @method FormatTickValue
 * @param {Number} n value (eg. price), unformatted (int)
 * @param {Boolean} noValidate if true value wont be validated to the nearest tick
 * @returns {String} formatted number / price
 */

Graph.prototype.FormatTickValue = function(n, noValidate) {
  if(!noValidate)
    var price = TwentyC.util.ValidatePrice(n, this.tick_size, this.precision);
  else
    var price = n;
  price = price / (Math.pow(10, this.precision));
  return TwentyC.util.FormatNumber(price, this.precision);
};

Graph.prototype.Validate = function(n) {
  return TwentyC.util.ValidatePrice(n, this.tick_size, this.precision)
}

/******************************************************************************
 * Format a number to have the plus sign if it's positive. This can be used
 * when setting up graph labels
 * @method FormatSign
 * @returns {String} number with plus sign attached if it's positive
 */

Graph.prototype.FormatSign = function(a) {
  if(a > 0)
    return "+" + a;
  else
    return a;
};

/*****************************************************************************
 * Returns whetever a difference between two number is positive or negative.
 * With a being treated as the previous value and b as the current value.
 * This can be used when setting up coloring for graph labels.
 * @method PosOrNeg
 * @param {Number} a previous number
 * @param {Number} b current number
 * @returns {String} "positive", "negative" or "neutral" (no diff)
 */

Graph.prototype.PosOrNeg = function(a, b) {
  if(a < b)
    return "positive";
  else if(a > b)
    return "negative";
  else
    return "neutral";
};

/******************************************************************************
 * Returns the difference between to numbers. With a being treated as the 
 * previous number and be being treated as the current number. This can be
 * used when setting up graph labels.
 * @method Diff
 * @param {Number} a previous number
 * @param {Number} b current number
 * @returns {Number} difference between b and a
 */

Graph.prototype.Diff = function(a, b) {
  return b-a;
}

Graph.prototype.RenderLabel = function(C, x, y) {

  if(this.chart && this.chart.config.disable_labels)
    return;

  if(!this.config.show_info_labels)
    return;

  var w, gd, gdp, prev, gdx, color, g_colors, colors = this.chart.config.colors;
  var i, a, b, lbl;

  C.Rect(
    x, 
    y, 
    this.chart.layout.graphLabel.w, 
    this.chart.layout.graphLabel.h, 
    colors.bgc_graph_label
  );
 
  w = C.Text(
    this.Title()+" ", 
    colors.f_graph_label, 
    x, 
    y, 
    "bold 12px arial", 
    "left", 
    null, 
    true
  );
  x+=w.width;
  // render values for each plot
  
  if(this.custom_x_axis) {
    var idx = Math.floor(this.start + (
      (this.chart.mouseX - this.x) /
      this.plotPointW
    ));
  } else 
    var idx = this.chart.SelectedBar();


  this.selectedBar = idx;
  gd = this.data[idx]
  prev = idx > 1 ? this.data[idx-1] : null;

  if(!gd || !this.chart.source.length)
    return;
    
  for(r in gd.plots) {
    gdp = gd.plots[r];
    gdx = (prev ? prev.plots[r] : {}) || {};


    // only print plot name if its not the main plot
    if(r != "main") {
      w = C.Text(this.plotName[r]||r, colors.f_graph_label, x, y, "bold 12px arial", "left", null, true);
      x += w.width;
    }

    g_colors = this.config.plots[r].colors;


    // if high, low, open and close are defined show those
    for(i in this.labels) {
      if(typeof gdp[i] != "undefined" || this.labels[i].fnCreate) {
        
        if(this.labels[i].fnCreate) {
          b = this.labels[i].fnCreate(gdp, gdx, this)
          a = 0;
        } else {
          if(this.labels[i].fnCalc) {
            b = this.labels[i].fnCalc(a, b, gdx, gdp, this);
            a = 0;
          } else {
            a = gdx[i];
            b = gdp[i];
          }
        }
        
        if(this.labels[i].fnColor)
          color = this.labels[i].fnColor(a, b, gdx, gdp, this);
        else
          color = "neutral";

        b = this.FormatTickValue(
          b, 
          (this.labels[i].unvalidated || this.config.plots[r].unvalidated),
          true
        );


        lbl = this.labels[i].fnFormat ? this.labels[i].fnFormat(b) : b;

        w = C.Text(
          this.labels[i].title+lbl, 
          g_colors[color], 
          x, 
          y+2, 
          "bold 10px arial", 
          "left", 
          null,
          true
        );
        x += w.width;
      }
    }



  }

 
}

//#############################################################################
/**
 * Gerneric market data graph
 * @class MarketDataGraph
 * @constructor
 * @namespace TwentyC.widget.Chart.widget
 * @extends TwentyC.widget.Chart.widget.Graph
 */

var MarketDataPlot = TwentyC.widget.Chart.widget.MarketDataGraph = function(){
};
MarketDataPlot.prototype = new TwentyC.widget.Chart.widget.Graph();
MarketDataPlot.prototype.title = "Marketdata";
MarketDataPlot.prototype.Init =
MarketDataPlot.prototype.InitMDPlot = function(title) {
  this.title = "Market Data";
  if(title)
    this.title = title;
  this.InitGraph();
  this.config.plots.main.renderFncName = "RenderCandlestick";
  this.config.plots.main.plotValue = "close";
  this.adjust_price = true;
  this.data_type = "market";
  this.tick_size = 25;
  this.sync_scale = true;
  this.precision = 2;
  this.config.plots.main.mark_disabled = true;
  return this;
};


MarketDataPlot.prototype.calc = function(chart, i, prev, data) {
  return {
    plots : {
      main : {
        low : data.low,
        time : data.time,
        close : data.close,
        high : data.high,
        open : data.open,
        price : data[this.plotValue]
      }
    }
  }
};
MarketDataPlot.prototype.on_open = function(chart, index, prevBar, bar, prev) {
  return this.calc(chart,index,prevBar,bar,prev);
};
MarketDataPlot.prototype.on_change = function(chart, index, prevBar, bar, prev) {
  return this.calc(chart,index,prevBar,bar,prev);
};
TwentyC.widget.Chart.indicators.Register("MarketDataPlot", MarketDataPlot);

TwentyC.widget.Chart.NewIndicator = function(ctor) {
  var Indicator = function() {};
  Indicator.prototype = ctor ? new ctor() : new TwentyC.widget.Chart.widget.MarketDataGraph();
  return Indicator;
};

//#############################################################################

/**
 * Graph to plot volume changes
 * @class VolumeGraph
 * @constructor
 * @namespace TwentyC.widget.Chart.widget
 */

var Volume = TwentyC.widget.Chart.widget.VolumeGraph = function(){};
Volume.prototype = new TwentyC.widget.Chart.widget.Graph();
Volume.prototype.title = "Volume";

/**
 * Initialize volume graph. This function is also mapped to Init()
 * @method InitVolume
 * @param {Object} config
 * @returns {TwentyC.widget.Chart.widget.VolumeGraph} self
 */

Volume.prototype.Init =
Volume.prototype.InitVolume = function(config) {
  this.InitGraph(config);
  this.data_type = "market_volume";
  this.tick_size = 1;
  this.precision = 0;
  this.forceMinY = 0;
  this.scale = 25;
  this.y_zoom = 0;
  this.title = "Volume";
  this.overlay = "main";
  
  this.config.color_style = "diff";

  this.config.opacity = 0.3;
  this.config.plots.main.colors.negative = "orange";
  this.config.plots.main.colors.positive = "lightblue";
  this.config.plots.main.colors.mark_bgc = "lightblue";
  this.config.plots.main.renderFncName = "RenderColumn";
  this.config.plots.main.colors.border_positive = "#fff";
  this.config.plots.main.colors.border_negative = "#fff";
  this.config.plots.main.colors.border_neutral = "#fff";
  this.config.plots.main.borders = false;
  this.config.plots.main.mark_disabled = false;
  this.config.plots.main.mark_prefix = "Vol. ";

  this.color_styles = [
    ["Volume Change", "diff"],
    ["Market Direction", "market"]
  ]

  var graph = this;

  this.prefs.color_style = {
    get : function(plot) { return graph.config.color_style },
    set : function(plot, v) { graph.config.color_style = v },
    label : "Color By",
    type : "list",
    items : function(plot) {
      return graph.color_styles
    }
  };
 

  this.labels = {
    price : {
      title : "",
      fnColor : this.PosOrNeg
    },
    change : {
      title : "chg. ",
      fnCreate : function(plot, prev) {
        return (plot.price - prev.price)||0
      },
      fnColor : this.PosOrNeg,
      fnFormat : this.FormatSign
    }
  }

  this.onRenderPlot.subscribe(function(e, d, graph) {
    var payload = d[0];
    var colors = payload.colors;
    var prev = payload.prev;
    var current = payload.current;
    var cfg = graph.config.plots[payload.plot_name];

    if(graph.config.color_style == "market") {
      if(current.open < current.close) {
        colors.primary = cfg.colors.positive;
        colors.secondary = cfg.colors.border_positive;
      } else if(current.open > current.close) {
        colors.primary = cfg.colors.negative;
        colors.secondary = cfg.colors.border_negative;
      } else { 
        colors.primary = cfg.colors.neutral;
        colors.secondary = cfg.colors.border_neutral;
      }
    }
    
  }, this);
  
  return this;
};

Volume.prototype.calc = function(chart, i, prev, data) {
  return {
    plots : {
      main : {
        close : data.close,
        open : data.open,
        time : data.time, 
        price : data.volume
      }
    }
  };
};
Volume.prototype.on_open = Volume.prototype.calc;
Volume.prototype.on_change = Volume.prototype.calc;

TwentyC.widget.Chart.indicators.Register("Volume", Volume);

//#############################################################################

/**
 * Drawing tool. Has functionality to draw objects onto graphs (from
 * basic shapes to more complex shapes). All drawing tools should
 * extend this object
 * @class DrawingTool
 * @constructor
 * @namespace TwentyC.widget.Chart.widget
 */

var DTool = TwentyC.widget.Chart.widget.DrawingTool = function() {};


/**
 * Drawing tool name
 * @property name
 * @type {String}
 */

DTool.prototype.name = "Drawing Tool"

/**
 * Drawing tool id, needs to be unique to the class
 * @property id
 * @type {String}
 */

DTool.prototype.id = "DrawingTool";

/**
 * Initialize the drawing tool. This function is also mapped to Init(), when
 * you extend this class make sure to override Init() to go to your new
 * init function
 * @method InitDrawingTool
 * @param {Object} config config object
 * @returns {TwentyC.widget.Chart.widget.DrawingTool} self
 */

DTool.prototype.Init =
DTool.prototype.InitDrawingTool = function(config) {

  this.type = "drawing";

  this.collisionColor = "#"+(TwentyC.widget.Chart.collisionColor++).toString(16);
  
  /**
   * captured mouse coordinates (eg. user clicks)
   * everytime a user clicks a coordinate is added
   * to this array. Until the desired length (captureLength)
   * is reached
   * @property capture
   * @type {Array}
   */

  this.capture = [];

  /**
   * captures needed until the drawing process is finished
   * @property captureLength
   * @type {Number}
   */

  this.captureLength = 1;

  /**
   * Current location in the capture / drawing process
   * @property progress
   * @type {Number}
   */

  this.progress = 0;

  this.pickedUpPoint = null;

  /**
   * config object
   * @property config
   * @type {Object}
   */

  this.config = {
    
    /**
     * opacity level (float), 0 = none, 1 = full
     * @config opacity
     * @type {Number}
     */

    opacity : 1,

    /**
     * color config, all colors should be valid html color strings
     * @config colors
     * @type {Object}
     */

    colors : {
      
      /**
       * mark font color
       * @config colors.mark_f
       */

      mark_f : "#000",

      /**
       * mark background color
       * @config colors.mark_bgc
       */

      mark_bgc:"#fff",

      /**
       * main color
       * @config colors.main
       */

      main : "white"
    },

    /**
     * line width (px)
     * @config line_with
     * @type {Number}
     */

    line_width : 1
  }

  /**
   * Preference object
   * @property prefs
   * @type {Object}
   */

  var tool = this;
  this.prefs = {
    color : {
      get : function(plot) { return tool.config.colors.main },
      set : function(plot, v) { tool.config.colors.main = v },
      label : "Color",
      type : "color"
    },
    color_mark_bg : {
      get : function(plot) { return tool.config.colors.mark_bgc },
      set : function(plot, v) { tool.config.colors.mark_bgc = v },
      label : "Mark",
      type : "color"
    },
    color_mark_f : {
      get : function(plot) { return tool.config.colors.mark_f },
      set : function(plot, v) { tool.config.colors.mark_f = v },
      label : "Mark Font Color",
      type : "color"
    },
    line_width : {
      set : function(sec, v) { tool.config.line_width = Math.max(1,parseInt(v)); },
      get : function(sec) { return tool.config.line_width },
      label : "Line Width",
      type : "list",
      items : [["1px",1], ["2px", 2], ["3px", 3], ["4px", 4], ["5px", 5]]
    }
  }

  this.progressLength = 2;

  this.onDone = new Y.util.CustomEvent("onDone");
  this.onCancel = new Y.util.CustomEvent("onCancel");
  TwentyC.util.UpdateObject(this.config, config);
  return this;
};

/**
 * The drawing logic, dummy function, should be overwritten by
 * the object that extends this 
 * @method Draw
 * @param {TwentyC.widget.Canvas} canvas 
 * @param {Array} coord set of coordinates, eg [[0,1],[1,2],...]
 */

DTool.prototype.Draw = function(canvas) {
  return;
};

/**
 * Add a coordinate to the capture stack. Eg. everytime a user
 * clicks
 * @method Capture
 * @param {Number} x x value (chart value)
 * @param {Number} y y value (chart value)
 * @param {Boolean} update if true the last coordinate will be updated instead of a new one being added
 */

DTool.prototype.Capture = function(x, y, update) {
  var c = this.capture;
  if(!update && c.length < this.captureLength) {
    c.push([x,y]);
  } else {
    c[c.length-1]=[x,y];
  }

  this.SetLimits();
};

/**
 * Return distance between two capture coordiantes
 * @method Distance
 * @param {Number} a index in this.capture of starting point
 * @param {Number} b index in this.capture of ending point
 */

DTool.prototype.Distance = function(a,b) {
  var graph = this.graph;
  var chart = graph.chart;
 
  var start = this.capture[a];
  var end = this.capture[b];

  var x = chart.ValueToX(graph, start[0],2);
  var r = chart.ValueToX(graph, end[0],2);
  var y = chart.ValueToY(graph, start[1]);
  var b = chart.ValueToY(graph, end[1]);

  return Math.sqrt(Math.pow(r-x, 2)+Math.pow(b-y, 2));
}

/**
 * Return a point acroos a line between two capture coordinates
 * @method LinePoint
 * @param {Number} n index in this.capture of starting point
 * @param {Number} distance distance along the line (px)
 */

DTool.prototype.LinePoint = function(n, distance) {
  if(!this.graph)
    return { x: 0, y : 0};
  
  var graph = this.graph;
  var chart = graph.chart;
 
  var start = this.capture[n];
  var end = this.capture[n+1];

  var x = chart.ValueToX(graph, start[0],2);
  var r = chart.ValueToX(graph, end[0],2);
  var y = chart.ValueToY(graph, start[1]);
  var b = chart.ValueToY(graph, end[1]);


  var len = this.Distance(n,n+1);

  return {
    x : x + ((r-x) * (distance / len)),
    y : y + ((b-y) * (distance / len))
  }
}

/**
 * Determine border values for y and x axis. They will be stored in maxY, maxX, minY and minX
 * @method SetLimits
 */

DTool.prototype.SetLimits = function() {
  // determine border values
  var i, c = this.capture;
  this.maxY = 0;
  this.minY = null;
  this.maxX = 0;
  this.maxY = null;
  for(i in c) {
    this.maxY = Math.max(c[i][1], this.maxY);
    this.maxX = Math.max(c[i][0], this.maxX);
    this.minY = this.minY === null ? c[i][1] : Math.min(c[i][1], this.minY);
    this.minX = this.minX === null ? c[i][0] : Math.min(c[i][0], this.minX);
  }
  this.dataMaxY = this.maxY;
  this.dataMinY = this.minY;
  this.dataMaxX = this.maxX;
  this.dataMinX = this.minX;
};

/**
 * Move the drawing tool to a new location. This will adjust all capture points accordingly.
 * This is a dummy function, override when extending.
 * @method Move
 * @param {Number} x x value (chart value)
 * @param {Number} y y value (chart value)
 */

DTool.prototype.Move = function(x,y,mouseX,mouseY) {
  var i, a, c = this.capture, point = this.pickedUpPoint;
  var chart = this.graph.chart,g;
  var graph = this.graph;
  var cx = graph.custom_x_axis;
  
  if(point === null && c.length) {
    var mX, dX = (c[0][0]-x), dY = c[0][1];

    var diff = chart.ValueToX(graph, c[0][0]) - chart.ValueToX(graph, x);
    var g,k = Math.round(diff / chart.plotPointW);

    for(i = 1; i <c.length; i++) {
      a = c[i];

      if(k) {
        if(!cx) {
          g = TwentyC.util.Find(chart.source, a[0], true, "time");
        } else {
          g = TwentyC.util.Find(
            graph.data, a[0], 
            true, 
            null, 
            function(d) { 
              return d.plots[cx.plot][cx.field];
            } 
          );
        }

        if((g-k) < 0) {
          a[0] = cx ? 
                 graph.GetValueForPlotName(0,cx.plot,cx.field) : 
                 chart.source[0].time;
        } else if((g-k) > chart.source.length-1) {
          a[0] = cx ? 
                 graph.GetValueForPlotName(graph.data.length-1, cx.plot, cx.field) : 
                 chart.source[chart.source.length-1].time;
        } else {
          a[0] = cx ?
                 graph.GetValueForPlotName(g-k, cx.plot, cx.field) :
                 chart.source[g-k].time;
        }
      }

      a[1] -= dY - y;
    }

    c[0][0] = x;
    c[0][1] = y;
  } else {
    c[point][0] = x;
    c[point][1] = y;
  }

  this.SetLimits();
  return;
};

/**
 * Set the graph for this drawing tool
 * @method SetGraph
 * @param {TwentyC.widget.Chart.widget.Graph} Graph object
 */

DTool.prototype.SetGraph = function(graph) {
 if(!this.graph)
   this.graph = graph;
}

/**
 * Increase drawing progress by one.
 * @method Progress
 */

DTool.prototype.Progress = function() {
  this.progress++;
  if(this.progress >= this.progressLength) {
    this.done = true;
    this.onDone.fire();
  }
};

/**
 * Checks if any of the drawings drawing points fall into the specified
 * area
 * @method InArea
 * @param {Number} x left side of area (needs to be a chart value, not pixels)
 * @param {Number} y top side of area (needs to be a chart value, not pixels)
 * @param {Number} r right side of area (needs to be a chart value, not pixels)
 * @param {Number} b bottom side of area (needs to be a chart value, not pixels)
 * @returns {Boolean} true if drawing is in area, false if not
 */

TwentyC.util.Intersect = function(x1,y1,x2,y2,x3,y3,x4,y4) {


  var q = (y1 - y2) * (x4 - x3) - (x1 - x3) * (y4 - y3);
  var d = (x2 - x1) * (y4 - y3) - (y2 - y1) * (x4 - x3);

        if( d == 0 )
        {
            return false;
        }

        var r = q / d;

        q = (y1 - y3) * (x2 - x1) - (x1 - x3) * (y2 - y1);
        var s = q / d;

        if( r < 0 || r > 1 || s < 0 || s > 1 )
        {
            return false;
        }

        return true;
  
};


DTool.prototype.InArea = function(x, y, r, b) {
  var i, a, j, c = this.capture, L = this.graph, w = this.graph.chart.layout.chartInner.w;

  var chart = L.chart;
  
  // cycle through all coordinates
  for(i in c) {
    a = c[i];
    j = c[parseInt(i)+1];
    // check x axis
    if((a[0] >= x && a[0] <= r) || this.xAbsolute) {
      // check y axis
      if((a[1] >= y && a[1] <= b) || this.yAbsolute) {
        return true;
      }
    }

    if(j && chart) {
      var lX = chart.ValueToX(L, a[0]);
      var lY = chart.ValueToY(L, a[1]);
      var lR = chart.ValueToX(L, j[0]);
      var lB = chart.ValueToY(L, j[1]);

      if(TwentyC.util.Intersect(lX,lY,lR,lB,L.x,L.y,L.r,L.y))
        return true;
      if(TwentyC.util.Intersect(lX,lY,lR,lB,L.r,L.y,L.r,L.b))
        return true;
      if(TwentyC.util.Intersect(lX,lY,lR,lB,L.r,L.b,L.x,L.b))
        return true;
      if(TwentyC.util.Intersect(lX,lY,lR,lB,L.x,L.b,L.x,L.y))
        return true;
    }

  }

  return false;
};

/**
 * Return object with eraser button coordinates for the drawing made
 * with this tool. Dummy function, override when extending.
 * @method EraserCoords
 * @param {Number} w button width (px)
 * @param {Number} h button height (px)
 * @returns {Object} object holding x and y coordinates for the eraser button location
 */

DTool.prototype.EraserCoords = function(w, h) {
  if(!this.done)
    return;

  var len = this.Distance(0,1);
  var d = (len / 2)-15;

  var coord = this.LinePoint(0, d);

  return {
    x : coord.x - (w/2),
    y : coord.y - (h/2)
  };
};


/**
 * Return object with movement button coordinates for the drawing made
 * with this tool. Dummy function, override when extending.
 * @method MoverCoords
 * @param {Number} w button width (px)
 * @param {Number} h button height (px)
 * @returns {Object} holding x and y coordinates for the movement button location
 */

DTool.prototype.MoverCoords = function(w, h) {
  if(!this.done)
    return;

  var len = this.Distance(0,1);
  var d = (len / 2);

  var coord = this.LinePoint(0, d);

  return {
    x : coord.x - (w/2),
    y : coord.y - (h/2)
  };
}

/**
 * Return object with editor button corrdinates for the drawing made with
 * this tool.
 * @method EditorCoords
 * @param {Number} w button width (px)
 * @param {Number} h button height (px)
 * @returns {Object} holding x and y coordinates for the editor button location
 */

DTool.prototype.EditorCoords = function(w, h) {
  if(!this.done)
    return;

  var len = this.Distance(0,1);
  var d = (len / 2) + 15;

  var coord = this.LinePoint(0, d);

  return {
    x : coord.x - (w/2),
    y : coord.y - (h/2)
  };
}

/**
 * Return object with changer button coordinates for the drawing made with 
 * this tool.
 * @method ChangerCoords
 * @param {Number} w button width (px)
 * @param {Number} h button height (px)
 * @returns {Array} array of x,y,n coordinates for changer locations [[x,y,n],[x,y,n],...] , with n being the drawing point index the changer is connected to
 */


DTool.prototype.ChangerCoords = function(w, h) {
  var i, c = this.capture;
  var r = [];
  if(c.length < 2)
    return r;
  var graph = this.graph;
  var chart = this.graph.chart;
  for(i in c) {
    r.push([
      chart.ValueToX(graph, c[i][0], 2)- (w/2),
      chart.ValueToY(graph, c[i][1]) - (h/2),
      i
    ]);
  }
  return r;
};

/**
 * Destroy drawing. Removes the drawing. Mapped to Destroy()
 * @method DestroyDrawing
 */

DTool.prototype.Destroy =
DTool.prototype.DestroyDrawing = function() {
  if(this.done && this.graph) {
    this.graph.RemoveDrawing(this);
  }
};

/**
 * Open preferences window for this drawing
 * @method OpenPrefs
 */

DTool.prototype.OpenPrefs = function() {
  if(this.done && this.graph) {
    this.graph.chart.PrefsBuild(
      this, this.prefs, this.name, true
    );
  }
};

/**
 * Pickup the drawing for moving
 * @method Pickup
 */

DTool.prototype.Pickup = function() {
  if(this.done && this.graph) {
    this.pickedUp = true;
    this.moveX = null;
    this.graph.chart.PickupDrawing(this);
  }
};

/**
 * Pickup a point of the drawing for moving
 * @method PickupPoint
 */

DTool.prototype.PickupPoint = function(point) {
  if(this.done && this.graph) {
    this.pickedUpPoint = point;
    this.Pickup();
  }
};

/**
 * Drop the drawing tool after Pickup()
 * @method Drop
 */

DTool.prototype.Drop = function() {
  this.pickedUp = false;
  this.pickedUpPoint = null;
  this.moveX = null;
  if(this.done && this.graph)
    this.graph.chart.DropDrawing(this);
};

//#############################################################################

/**
 * Drawing Tool: Horizontal line
 * Draws a line horizontally on the specified point on the y axis
 * @class DrawingToolHorizontalLine
 * @constructor
 * @namespace TwentyC.widget.Chart.widget
 * @extends TwentyC.widget.Chart.widget.DrawingTool
 */

var HLine = TwentyC.widget.Chart.widget.DrawingToolHorizontalLine = function() {};
HLine.prototype = new TwentyC.widget.Chart.widget.DrawingTool();

HLine.prototype.name = "Horizontal Line";
HLine.prototype.id = "DrawingToolHorizontalLine";
HLine.prototype.icon = function(){return TwentyC.widget.Chart.pathImg+"/ico-horizontal-line.png";};

/**
 * Initialize, also mapped to Init()
 * @method InitHLine
 * @param {Object} config config object
 * @returns {DrawingToolHorizontalLine} self
 */

HLine.prototype.Init =
HLine.prototype.InitHLine = function(config) {
  var cnf = {
  }
  TwentyC.util.UpdateObject(cnf, config);
  this.InitDrawingTool(cnf);

  this.xAbsolute = true;
  this.captureLength = 1;
  return this;
}

/**
 * Drawing logic
 * @method Draw
 * @param {TwentyC.widget.Canvas} canvas
 * @param {Array} drawing coordinates, expecting two coordinates, eg. [[5,15], [20,15]]
 */

HLine.prototype.Draw = function(canvas, y) {
  var graph = this.graph;

  if(!graph||!y||!y[0])
    return;

  var y = y[0][1];

  canvas.Line(
    graph.chart.layout.chart.x+1,
    graph.chart.ValueToY(graph, y),
    graph.chart.layout.chart.r-2,
    graph.chart.ValueToY(graph, y),
    this.config.line_width,
    this.config.colors.main,
    { updateCollisionMap : this.collisionColor }
  )

  if(this.done && !this.pickedUp) {
    graph.chart.RenderPriceMark(graph, y, null, this.config.colors.mark_bgc, this.config.colors.mark_f);
  }
};

HLine.prototype.MoverCoords = function(w, h) {
  if(!this.done)
    return;

  var y = this.capture[0][1];
  y = this.graph.chart.ValueToY(this.graph, y);
  var L = this.graph.chart.layout.chart;
  return {
    x : L.x + (L.w / 2) - (w / 2),
    y : y-(h/2)
  }
};

HLine.prototype.EditorCoords = function(w, h) {
  if(!this.done)
    return;
  var y = this.capture[0][1];
  y = this.graph.chart.ValueToY(this.graph, y);
  return {
    x : this.graph.chart.layout.chart.r-15,
    y : y-(w/2)
  }
}


HLine.prototype.EraserCoords = function(w, h) {
  if(!this.done)
    return;
  var y = this.capture[0][1];
  y = this.graph.chart.ValueToY(this.graph, y);
  return {
    x : this.graph.chart.layout.chart.x+5,
    y : y-(w/2)
  }
}

TwentyC.widget.Chart.drawingTools.Register(HLine);

//#############################################################################

/**
 * Drawing tool to draw a verical line
 * @class DrawingToolVericalLine
 * @constructor
 * @namespace TwentyC.widget.Chart.widget
 * @extends TwentyC.widget.Chart.widget.DrawingTool
 */

var VLine = TwentyC.widget.Chart.widget.DrawingToolVerticalLine = function() {}
VLine.prototype = new TwentyC.widget.Chart.widget.DrawingTool;
VLine.prototype.name = "Vertical Line";
VLine.prototype.id = "DrawingToolVerticalLine";
VLine.prototype.icon = function(){return TwentyC.widget.Chart.pathImg+"/ico-vertical-line.png";};

VLine.prototype.Init = 
VLine.prototype.InitVLine = function(config) {
  var cnf = {
  }
  TwentyC.util.UpdateObject(cnf, config);
  this.InitDrawingTool(cnf);

  this.yAbsolute = true;
  this.noClip = true;
  
  this.captureLength = 1;
  return this;

};

VLine.prototype.Draw = function(canvas, x) {
  var graph = this.graph;

  if(!graph||!x||!x[0])
    return;
  var x = x[0][0];

  canvas.Line(
    graph.chart.ValueToX(graph, x, 2),
    graph.y+1,
    graph.chart.ValueToX(graph, x, 2),
    graph.b-2,
    this.config.line_width,
    this.config.colors.main,
    { updateCollisionMap : this.collisionColor }
  )

  if(this.done && !this.pickedUp) {
    graph.chart.RenderTimeMark(graph, x, null, this.config.colors.mark_bgc, this.config.colors.mark_f);
  }
};

VLine.prototype.EditorCoords = function(w, h) {
  if(!this.done)
    return;
  var x = this.capture[0][0];
  x = this.graph.chart.ValueToX(this.graph, x, 2);
  return {
    y : this.graph.b-15,
    x : x-(h/2)
  }
};

VLine.prototype.EraserCoords = function(w, h) {
  if(!this.done)
    return;
  var x = this.capture[0][0];
  x = this.graph.chart.ValueToX(this.graph, x, 2);
  return {
    y : this.graph.y+5,
    x : x-(h/2)
  }
}

VLine.prototype.MoverCoords = function(w, h) {
  if(!this.done)
    return;

  var x = this.capture[0][0];
  x = this.graph.chart.ValueToX(this.graph, x, 2);
  var L = this.graph;
  return {
    x : x-(w/2),
    y : L.y + (L.height / 2) - (h / 2)
  }
};



TwentyC.widget.Chart.drawingTools.Register(VLine);

//#############################################################################

/**
 * Trendline Drawingtool, draw aline between two coordinates
 * @class DrawingToolTrendLine
 * @constructor
 * @namespace TwentyC.widget.Chart.widget
 * @extends TwentyC.widget.Chart.widget.DrawingTool
 */

var TLine = TwentyC.widget.Chart.widget.DrawingToolTrendLine = function() {}
TLine.prototype = new TwentyC.widget.Chart.widget.DrawingTool;
TLine.prototype.name = "Trend Line";
TLine.prototype.id = "DrawingToolTrendLine";
TLine.prototype.icon = function(){return TwentyC.widget.Chart.pathImg+"/ico-trend-line.png";};

TLine.prototype.Init = 
TLine.prototype.InitTLine = function(config) {
  var cnf = {
    line_width : 3,
    colors : {
      main : "yellow"
    }
  }
  TwentyC.util.UpdateObject(cnf, config);
  this.InitDrawingTool(cnf);
  this.captureLength = 2;

  delete this.prefs.color_mark_bg;
  delete this.prefs.color_mark_f;
  return this;
};


TLine.prototype.Draw = function(canvas, coords) {
  if(!this.graph)
    return;

  var i, graph = this.graph, chart = this.graph.chart;

  if(coords.length >= 2) {
    canvas.Line(
      chart.ValueToX(graph, coords[0][0], 2),
      chart.ValueToY(graph, coords[0][1]),
      chart.ValueToX(graph, coords[1][0], 2),
      chart.ValueToY(graph, coords[1][1]),
      this.config.line_width,
      this.config.colors.main,
      { updateCollisionMap : this.collisionColor }
    );
  }

};



TwentyC.widget.Chart.drawingTools.Register(TLine);

//#############################################################################

/**
 * Basic chart class, all charts should extend this class, has all the
 * core funcionality for managing and rendering (plotting) chart data
 * @class Chart 
 * @namespace TwentyC.widget.Chart.widget
 * @constructor
 */

var Chart = TwentyC.widget.Chart.widget.Chart = function() {};

/**
 * Initialize the chart object, building all required html elements needed
 * and setting them up according to config, alias: this.Init
 * @method InitChart
 * @param {Object} config config object holding config key, value pairs
 */

Chart.prototype.Init = 
Chart.prototype.InitChart = function(config) {

  /**
   * If true RenderPlot() will not be processed. Use this to free up
   * cpu when the chart is hidden from view or currently does not
   * need to update.
   * @property inactive
   * @type Boolean
   * @default false
   */

  this.inactive = false;
  
  /**
   * Holds various click and mouse over zone coordinates
   */

  this.EventZones = {
    ui : [],
    drawings : []
  }

  this.id = TwentyC.widget.Chart.refCnt++;

  /**
   * config object
   * @property config
   * @type {Object}
   */
  this.config = {};

  /**
   * Holds hotkey buttons currently in this chart
   * @property hotkeys
   * @type {Array}
   */

  this.hotkeys = {};
  
  /**
   * html elements created by this.Build() are
   * stored in this object by their name
   * @property elements
   * @type {Object}
   */
  this.elements = {};

  /**
   * graphs created by this.AddGraph() are 
   * stored in this array in their render order (top down) 
   * @property graphsOrder
   * @type {Array}
   */
  this.graphsOrder = [];

  /**
   * graphs created by this.AddGraph() are 
   * stored in this object referenced by their name
   * @property graphs
   * @type {Object}
   */
  this.graphs = {};

  var dfltConfig = {

    /**
     * Mousehweel action
     *
     * Possible values
     *
     *     "scroll-x" : scroll x axis
     *     "resize-x" : resize x axis
     *     "resize-y" : resize y axis
     *
     * @config mwheel_action
     * @type String
     * @default "resize-x"
     */

    mwheel_action : "resize-x",

    /**
     * Default hotkeys to add when the chart is first loaded
     * @config hotkeys
     * @type Array
     */
    hotkeys : [
      "add_indicator", 
      "tgl_edit_layout", 
      "crosshair",
      "draw_DrawingToolHorizontalLine",
      "draw_DrawingToolVerticalLine",
      "draw_DrawingToolTrendLine"
    ],
    
    /**
     * Time tick size, the length of one tick on the time
     * axis (bar duration) in ms
     * @config time_tick_size
     * @type {Number}
     */

    time_tick_size : 1000,

    /**
     * Width of the chart in pixels
     * @config width
     * @type {Number}
     */

    width : 500,

    /**
     * Height of the chart in pixels
     * @config height
     * @type {Number}
     */

    height : 300,

    /**
     * Disable indicator labels
     * @config disable_labels
     * @type Boolean
     * @default false
     */

    disable_labels : false,

    /**
     * Chart region settings, positions the chart within the container
     * @config chart_region
     * @type {Object}
     */

    chart_region : {
      
      /**
       * left position of the chart in pixels
       * @config chart_region.x
       * @type {Number}
       */

      x : 5,

      /**
       * top position of the chart in pixels
       * @config chart_region.y
       * @type {Number}
       */

      y : 5,

      /** 
       * right position of the chart in pixels
       * @config chart_region.r
       * @type {Number}
       */

      r : 65,

      /**
       * bottom position of the chart in pixels
       * @config chart_region.b
       * @type {Number}
       */

      b : 20 
    },

    /**
     * Instrument (symbol) config
     * @config instrument
     * @type {Object}
     */

    instrument : {
      
      /**
       * Define instrument tick size
       * @config instrument.tick_size
       * @type {Number}
       */

      tick_size : 25,

      /**
       * Instrument price precision
       * @config instrument.precision
       * @type {Number}
       */

      precision : 1,

      /**
       * Symbol
       * @config instrument.symbol
       * @type {String}
       */

      symbol : "UNKNOWN"


    },

    /**
     * Grid config, define vertical and horizontal spaces and default
     * plot count per space
     * @config grid
     * @type {Object}
     */

    grid : {
      
      /**
       * Toggle grid visibility over the chart background
       * @config grid.visible
       * @type {Boolean}
       */

      visible : true,


      x_count : 8,
      y_count : 10,

      /**
       * Grid line width in pixels
       * @config grid.width
       * @type {Number}
       */

      width : 1,

      /**
       * Width between grid lines on x axis (in pixels), note that this is a guideline
       * setting, but gaps in the timeline can cause differences in width between
       * grid lines.
       * @config grid.x_width
       * @type {Number}
       */

      x_width : 70,

      /**
       * Height between grid lines on the y axis (in pixels)
       * @config grid.y_height
       * @type {Number}
       */

      y_height : 30,

      /**
       * Vertical plot points per grid section
       * @config grid.vertical
       * @type {Number}
       */

      vertical : 5,

      /**
       * Horizontal plot points per grid section
       * @config grid.horizontal
       * @type {Number}
       */

      horizontal : 10,

      /**
       * Pad grid and chart data on the left side (pixels)
       * @config grid.pad_x
       * @type {Number}
       */

      pad_x : 5,

      /**
       * Pad grid and chart data on the right side (pixels)
       * @config grid.pad_r
       * @type {Number}
       */

      pad_r : 5,

      /**
       * Pad grid and chart data on the top side (pixels)
       * @config grid.pad_y
       * @type {Number}
       */

      pad_y : 5,

      /**
       * Pad grid and chart data on the bottom side (pixels)
       * @config grid.pad_b
       * @type {Number}
       */

      pad_b : 5,

      /**
       * x axis height in pixels
       * @config grid.x_axis_height
       * @type Number
       * @default 15
       */

      x_axis_height : 18

    },

    /**
     * Scrollbar config
     * @config scrollbar
     */

    scrollbar : {

      /**
       * Enable scrollbar
       * @config scrollbar.enabled
       * @type {Boolean}
       */

      enabled : true,

      /**
       * Scrollbar height in pixels
       * @config scrollbar.height
       * @type {Number}
       */

      height : 15,

      /**
       * Scrollbar position x offset in pixels
       * @config scrollbar.x_offset
       * @type {Number}
       */

      x_offset : 0,

      /**
       * Scrollbar position y offset in puxels
       * @config scrollbar.y_offset
       * @type {Number}
       */

      y_offset : 5
    },

    /**
     * Color settings, all color values should be strings. Valid formats are
     * "#000000", "#000", "black", "rgba(0,0,0,0)"
     * @config colors
     * @type {Object}
     */

    colors : {
      
      /**
       * Background color of the container holding the chart
       * @config colors.bgc_container
       * @type {String}
       */

      bgc_container : "#000",

      /**
       * Background color of the chart itself
       * @config colors.bgc_chart
       * @type {String}
       */
      
      bgc_chart : "#333",

      /**
       * Border color of the chart 
       * @config colors.bdc_chart
       * @type {String}
       */
      
      bdc_chart : "#999",

      /**
       * Grid color
       * @config colors.grid
       * @type {String}
       */
      
      grid : "#555",

      /**
       * Crosshair color
       * @config colors.crosshair
       * @type {String}
       */

      crosshair : "#999",

      /**
       * Crosshair font color
       * @config colors.crosshair_f
       * @type {String}
       */
      
      crosshair_f : "#000",

      /**
       * Background color for graph info box
       * @config colors.bgc_graph_label
       * @type {String}
       */

      bgc_graph_label : "rgba(0,0,0,0.25)",

      /** 
       * Font color for graph info box
       * @config colors.f_graph_label
       * @type {String}
       */

      f_graph_label : "#fff",

      /**
       * Drag and drop indicator, normal color
       * @config colors.dnd_normal
       * @type {String}
       */

      dnd_normal : "orange",

      /**
       * Drag and drop indicator, highlight color
       * @config colors.dnd_highlight
       * @type {String}
       */

      dnd_highlight : "yellow",

      /**
       * Background color of highlighted bar
       * @config colors.bar_highlight
       * @type {String}
       */

      bar_highlight : "rgba(255,255,255,0.05)",

      /**
       * Font color for "empty data" message
       * @config colors.empty_msg
       * @type {String}
       */

      empty_msg : "rgba(255,255,255,0.75)"
    },

    /**
     * Toggle rendering of crosshair lines to chart border on or off
     * @config crosshair_lines
     * @type {Boolean}
     */

    crosshair_lines : false,

    /**
     * Toolbar config, allows you to disable / enable toolbar options
     * @config toolbar
     * @type {Object}
     */

    toolbar : {

      /**
       * Disable the toolbar entirely
       * @config toolbar.disabled
       * @type Boolean
       * @default false
       */

      disabled : false,
      
      /**
       * Enable indicator menu
       * @config toolbar.indicators
       * @type {Boolean}
       */

      indicators : true,

      /**
       * Enable edit mode toggle
       * @config toolbar.edit_mode
       * @type {Boolean}
       */

      edit_mode : true,
 
      /**
       * Enable drawing tools
       * @config toolbar.drawing_tools
       * @type {Boollean}
       */

      drawing_tools : true

    }
  };

  /*
   * custom events
   */

  /**
   * Fires when the mouse button is clicked onto the chart
   * @event onMouseDown
   * @param {Event} e
   * @param {Number} x mouse x (px) relative to the chart offset
   * @param {Number} y mouse y (px) relative to the chart offset
   */

  this.onMouseDown = new Y.util.CustomEvent("onMouseDown");
  
  /**
   * Fires when the mouse button is released from the chart
   * @event onMouseUp
   * @param {Event} e
   * @param {Number} x mouse x (px) relative to the chart offset
   * @param {Number} y mouse y (px) relative to the chart offset
   */

  this.onMouseUp = new Y.util.CustomEvent("onMouseUp");
  
  /**
   * Fires when the mouse pointer is moved over the chart
   * @event onMouseMove
   * @param {Event} e
   * @param {Number} x mouse x (px) relative to the chart offset
   * @param {Number} y mouse y (px) relative to the chart offset
   */

  this.onMouseMove = new Y.util.CustomEvent("onMouseMove");

  /**
   * Fires when a bar opens on any graph 
   * @event onBarOpen
   * @param {Chart} chart
   * @param {Graph} graph
   * @param {Object} bar object literal of bar data
   */

  this.onBarOpen = new Y.util.CustomEvent("onBarOpen");
  
  /**
   * Fires when a bar closes on any graph 
   * @event onBarClose
   * @param {Chart} chart
   * @param {Graph} graph
   * @param {Object} bar object literal of bar data
   */

  this.onBarClose = new Y.util.CustomEvent("onBarClose");

  this.onEditMode = new Y.util.CustomEvent("onEditMode");

  /**
   * Fires after chart data has been plotted / rendered
   * @event onRenderData
   */

  this.onRenderData = new Y.util.CustomEvent("onRenderData");

  /**
   * Fires after markers have been rendered
   * @event onRenderMarkers
   * @param {Chart} chart self
   */

  this.onRenderMarkers = new Y.util.CustomEvent("onRenderMarkers");

  this.onRenderUI = new Y.util.CustomEvent("onRenderUI");
  this.onRenderBase = new Y.util.CustomEvent("onRenderBase");

  /**
   * Fires when preferences are submitted
   * @event onPrefsSubmit
   */

  this.onPrefsSubmit = new Y.util.CustomEvent("onPrefsSubmit");
  
  /**
   * Fires when an imput field is created for preferences
   * @event onPrefsCreateInput
   * @param {String} name input title / name
   * @param {String} type input type
   * @param {Element} input input element
   */
  
  this.onPrefsCreateInput = new Y.util.CustomEvent("onPrefsCreateInput");

  /**
   * Fires when a graph is being added to the chart
   * @event onAddGraph
   * @param {Chart} chart self
   * @param {Graph} graph graph being added
   */

  this.onAddGraph = new Y.util.CustomEvent("onAddGraph");

  /**
   * Fires when a graph is being removed from the chart
   * @event onRemoveGraph
   * @param {Chart} chart self
   * @param {Graph} graph graph being removed
   */

  this.onRemoveGraph = new Y.util.CustomEvent("onRemoveGraph");
  this.onDraw = new Y.util.CustomEvent("onDraw");

  /**
   * Fires when a hotkey is added
   * @event onAddHotkey
   * @param {Chart} chart
   * @param {String} hotkey hotkey id
   */

  this.onAddHotkey = new Y.util.CustomEvent("onAddHotkey");

  /**
   * Fires when a hotkey is removed
   * @event onRemoveHotkey
   * @param {Chart} chart
   * @param {String} hotkey hotkey id
   */

  this.onRemoveHotkey = new Y.util.CustomEvent("onRemoveHotkey");
 
  
  this.requireRender = 3;
  this.graphNum = 0;

  this.Build();
  TwentyC.util.UpdateObject(dfltConfig, config);
  this.SetConfig(dfltConfig);

  /*
   * add main graph
   */
 
  this.AddGraph("main", new TwentyC.widget.Chart.widget.MarketDataGraph().Init(this.config.instrument.symbol));
  this.AddGraph("volume", new TwentyC.widget.Chart.widget.VolumeGraph().Init());

  /*
   * set up messaging for bar open and close
   */

  this.onBarOpen.subscribe(function(e,d) {
    var payload = d[0];
    var inst = payload.chart.config.instrument;

    TwentyC.Message.Send(
      "indicator:"+inst.symbol+":"+payload.graph.Title()+":"+payload.chart.config.time_tick_size+":plot_open",
      {
        source : payload.chart,
        graph : payload.graph,
        plot : payload.bar.plots
      }
    );
  });
  this.onBarClose.subscribe(function(e,d) {
    var payload = d[0];
    var inst = payload.chart.config.instrument;

    TwentyC.Message.Send(
      "indicator:"+inst.symbol+":"+payload.graph.Title()+":"+payload.chart.config.time_tick_size+":plot_close",
      {
        source : payload.chart,
        graph : payload.graph,
        plot : payload.bar.plots
      }
    );
  });


  /*
   * add default hotkeys
   */

  var i;
  for(i in this.config.hotkeys) {
    this.ToolbarAddHotkey(this.config.hotkeys[i]);
  }

};


/**
 * Build the html elements needed for the chart, alias: Build
 * @method BuildChart
 */

Chart.prototype.Build =
Chart.prototype.BuildChart = function() {
  if(this.element)
    return;

  var el = this.elements, c, C;
  
  this.canvasDict = {};

  el.container = document.createElement("div");
  this.canvasDict.bg = new TwentyC.widget.Canvas().Init(300, 200);
  this.canvasDict.plot = new TwentyC.widget.Canvas().Init(300, 200);
  this.canvasDict.mark = new TwentyC.widget.Canvas().Init(300, 200);
  this.canvasDict.draw = new TwentyC.widget.Canvas().Init(300, 200);
  this.canvasDict.ui = new TwentyC.widget.Canvas().Init(300, 200);

  this.canvasDict.plot.InitCollisionMap();

  el.shim = document.createElement("div");
  el.shim.className = "twentychart-shim";

  el.container.style.position = "relative";

  el.container.className = "twentychart";
  
  var n = 0;
  for(c in this.canvasDict) {
    C = this.canvasDict[c];
    C.element.style.position = "absolute";
    C.element.style.zIndex = n++;
    C.element.style.left = "0px";
    C.element.style.top = "0px";
    el.container.appendChild(C.element);
    //var eventNode = C.element;
  }

  el.container.appendChild(el.shim);

  this.element = el.container;
  var eventNode = el.shim;
  this.eventElement = eventNode;

  var C = this;

  // build toolbar
  
  el.toolbar = document.createElement('div');
  el.toolbar.className = "toolbar";
  this.element.appendChild(el.toolbar);

  el.toolbar_hotkeys = document.createElement("span");
  el.toolbar_hotkeys.className = "toolbar-hotkeys";
  el.toolbar_addons = document.createElement("span");
  el.toolbar_addons.className = "toolbar-addons";
  el.toolbar_blank_hotkey = document.createElement("img");
  el.toolbar_blank_hotkey.src = TwentyC.widget.Chart.pathImg+"/toolbar-slot.png";

  el.toolbar.appendChild(el.toolbar_addons);
  el.toolbar.appendChild(el.toolbar_hotkeys);
  el.toolbar_hotkeys.appendChild(el.toolbar_blank_hotkey);

  Y.util.Event.addListener(el.toolbar_blank_hotkey, "click", function(e, icon) {
    C.hotkeyMenu.menu.cfg.setProperty("context", [icon, "tl", "bl"]);
    C.hotkeyMenu.menu.show();
  }, el.toolbar_blank_hotkey);
  el.toolbar_blank_hotkey.title= TwentyC.widget.Chart.locale.assign_hotkey;

  // build prefs pane

  el.prefs = document.createElement('div');

  // make sure mouse events on the prefs pane dont get sent to the chart
 
  var cancelEvent = function(e) { 
    Y.util.Event.stopPropagation(e);
  }

  Y.util.Event.addListener(el.prefs, "mousedown", cancelEvent);
  Y.util.Event.addListener(el.prefs, "mouseup", cancelEvent);

  el.prefs.className = "twentychart-prefs";
  this.element.appendChild(el.prefs);

  // set up mouse events
  
  var ins = TwentyC.util.Inside;

  // various menus
  this.indicatorMenu = new TwentyC.widget.Chart.widget.IndicatorMenu(this);
  this.drawingToolsMenu = new TwentyC.widget.Chart.widget.DrawingToolMenu(this);
  this.contextMenu = new TwentyC.widget.Chart.widget.ChartContextMenu(this);
  this.hotkeyMenu = new TwentyC.widget.Chart.widget.HotkeyMenu(this, function(e, ev, id){
     C.ToolbarAddHotkey(id);
   
  });

  Y.util.Event.addListener(
    eventNode,
    "dblclick",
    function(e) {
      var R = C.GetRegion();
      var mouseX = Y.util.Event.getPageX(e)-R.x;
      var mouseY = Y.util.Event.getPageY(e)-R.y;
      var graph = C.TouchedGraph(mouseX, mouseY);
      var target = C.canvasDict.plot.GetCollisionColor(mouseX, mouseY, 4, C.graphs);
      if(!target)
        var target = C.canvasDict.plot.GetCollisionColor(mouseX, mouseY, 4, graph.drawings);
      
      if(target) {
        if(target.type == "graph") {
          C.PrefsBuild(target, target.prefs, target.Title(), true);
        } else if(target.type == "drawing") {
          if(C.drawingSelected == target) {
            C.drawingSelected = null;
            C.RenderData();
          } else {
            target.OpenPrefs();
            C.drawingSelected = target;
            C.RenderData();
          }
        }
      }
    }
  );

  Y.util.Event.addListener(
    eventNode,
    "mousewheel",
    function(e) {
      
      if(e.wheelDelta)
        var delta = e.wheelDelta / 120;
      else if(e.detail)
        var delta = -e.detail /3
      else
        return 

      if(TwentyC.widget.Chart.mousewheel && !TwentyC.widget.Chart.mousewheel.validate(e))
        return;

      switch(C.config.mwheel_action) {
        case "resize-x":
          if(delta < 0)
            C.SetConfig({grid:{horizontal:C.config.grid.horizontal+1}});
          else if(delta > 0)
            C.SetConfig({grid:{horizontal:Math.max(2,C.config.grid.horizontal-1)}});
        break;
        case "scroll-x":
          if(delta < 0)
            var idx = Math.max(C.plotPointsX, C.index-2);
          else if(delta > 0)
            var idx = Math.min(C.sourceLength, C.index+2);

          C.index = idx;
          C.RenderData();
        break;
        case "resize-y":
          var graph = C.TouchedGraph(C.mouseX, C.mouseY);
          
          if(!graph)
            return;

          if(delta < 0)
            var n = graph.y_zoom-2;
          else if(delta > 0)
            var n = graph.y_zoom+2;

          n = Math.max(2,n);
          graph.y_zoom = n;
          C.RenderData();
        break;
        default: return;
      }

      Y.util.Event.stopEvent(e);
    }
  );

  Y.util.Event.addListener(
    eventNode,
    "mousedown",
    function(e) {
      var R = C.GetRegion();
      var mouseX = Y.util.Event.getPageX(e)-R.x;
      var mouseY = Y.util.Event.getPageY(e)-R.y;
      var b = C.onMouseDown.fire({ 
        e : e, 
        x : mouseX,
        y : mouseY
      });

      TwentyC.util.ToggleGlobalSelect(false);

      if(e.button == 2) {
        C.drawingSelected = null;
        C.RenderData();
        return;
      }

      if(!b)
        return

      /*
       * check event zones
       */
      
      var i,z;
      for(i in C.EventZones.drawings) {
        z = C.EventZones.drawings[i];
        if(!z.click)
          continue;
        if(ins(mouseX, mouseY, z)) {
          z.click(mouseX, mouseY, z.data, z, C);
          C.preventDrawingOnMouseUp = true;
          return;
        }
      };
      for(i in C.EventZones.ui) {
        z = C.EventZones.ui[i];
        if(!z.click)
          continue;
        if(ins(mouseX, mouseY, z)) {
          z.click(mouseX, mouseY, z.data, z, C);
          return;
        }
      };

      C.preventDrawingOnMouseUp = false;



      /*
       * Handle drawing tool
       */

      if(C.drawingTool) {

        var graph = C.TouchedGraph(mouseX, mouseY);
        if(graph) {
          if(
            C.drawingTool.mouseX == mouseX &&
            C.drawingTool.mouseY == mouseY
          ) {
            return;
          }

          C.drawingTool.SetGraph(graph);
          if(!C.drawingTool.done) {
            C.drawingTool.Capture(C.XToValue(graph, mouseX-graph.x), C.YToValue(graph, mouseY-graph.y));
            C.drawingTool.Capture(C.XToValue(graph, mouseX-graph.x), C.YToValue(graph, mouseY-graph.y));
            C.drawingTool.Progress();
            if(C.drawingTool.quick_place)
              C.drawingTool.Progress();

            if(C.drawingTool.done)
              C.preventDrawingOnMouseUp = true;

          } else {
            C.drawingTool.Drop();
          }
          C.drawingTool.mouseX = mouseX;
          C.drawingTool.mouseY = mouseY;
          C.RenderDrawingProgress();

          return;
        }
      } else if(C.editMode) {
        
        /*
         * Graph resizing
         */

        var graph = C.TouchedGraph(mouseX, mouseY);
        if(graph && graph.ResizePaneTouched()) {
          C.TglResizeGraphDrag(e, graph, mouseY);
          return;
        }
      }

      /*
       * check chart behaviour
       */

      if(ins(mouseX, mouseY, C.layout.resizeZoneY))
        C.TglResizeDrag(e,"y",mouseY);
      else if(ins(mouseX, mouseY, C.layout.resizeZoneX))
        C.TglResizeDrag(e,"x",mouseX);
      else if(ins(mouseX, mouseY, C.layout.chart))
        C.TglScrollDrag(1,mouseX);

      C.RenderMarkers();
     
    }
  );

  Y.util.Event.addListener(
    document.body, 
    "mouseup",
    function(e) {
      var R = C.GetRegion();
      var mouseX = Y.util.Event.getPageX(e)-R.x;
      var mouseY = Y.util.Event.getPageY(e)-R.y;
      var b = C.onMouseUp.fire({ 
        e : e, 
        x : mouseX,
        y : mouseY
      });

      TwentyC.util.ToggleGlobalSelect(true);


      if(e.button == 2) {
        return;
      }

      if(!b)
        return;

      if(C.preventDrawingOnMouseUp) {
        C.preventDrawingOnMouseUp = false;
        return;
      }

      /*
       * Handle drawing tool
       */

      if(C.drawingTool) {

        var graph = C.TouchedGraph(mouseX, mouseY);
        if(graph) {
          if(
            C.drawingTool.mouseX == mouseX &&
            C.drawingTool.mouseY == mouseY
          ) {
            return;
          }

          C.drawingTool.SetGraph(graph);
          if(!C.drawingTool.done) {
            C.drawingTool.Capture(C.XToValue(graph, mouseX-graph.x), C.YToValue(graph, mouseY-graph.y));
            C.drawingTool.Capture(C.XToValue(graph, mouseX-graph.x), C.YToValue(graph, mouseY-graph.y));
            C.drawingTool.Progress();
            if(C.drawingTool.quick_place)
              C.drawingTool.Progress();
              
          } else {
            C.drawingTool.Drop();
          }
          C.drawingTool.mouseX = mouseX;
          C.drawingTool.mouseY = mouseY;
          C.RenderDrawingProgress();

          return;
        }
      } 


      C.GraphDnDDrop();
      C.TglScrollDrag(0,0);
      C.TglResizeDrag(e,0);
      C.TglResizeGraphDrag(0,0);
      
      C.RenderMarkers();
      C.ToolbarUpdateHotkeys();

    }
  );

  Y.util.Event.addListener(
    eventNode,
    "mouseout",
    function(e) {
      C.mouseX = -100;
      C.mouseY = -100;
      C.selectedBar = 0;
      C.RenderMarkers();
    }
  );

  Y.util.Event.addListener(
    eventNode,
    "mousemove",
    function(e) {
      var R = C.GetRegion();
      C.mouseX = Y.util.Event.getPageX(e)-R.x;
      C.mouseY = Y.util.Event.getPageY(e)-R.y;
      C.mouseMoved = true;

      var b = C.onMouseMove.fire({
        x : C.mouseX,
        y : C.mouseY,
        e : e
      });

      if(!b)
        return;


      if(C.graphDnD) {
        C.SetCursor(null);
        C.GraphDnDDrag();
        return;
      }

      var inChart = false;

      if(ins(C.mouseX, C.mouseY, C.layout.chart)) {
        inChart = true;

        C.SetCursor("crosshair");

        /*
         * drawing tool
         */

        if(C.drawingTool) {
          var graph = C.TouchedGraph(C.mouseX, C.mouseY);
          if(C.drawingTool.capture.length && graph == C.drawingTool.graph) {
            if(!C.drawingTool.done)
              C.drawingTool.Capture(C.XToValue(graph, C.mouseX-graph.x), C.YToValue(graph, C.mouseY-graph.y), true);
            else
              C.drawingTool.Move(C.XToValue(graph, C.mouseX-graph.x), C.YToValue(graph, C.mouseY-graph.y), C.mouseX, C.mouseY);
          }
          C.RenderDrawingProgress();
        } else {

          /*
           * Chart height resize
           */

          var graph = C.TouchedGraph(C.mouseX, C.mouseY);

          if(graph && C.editMode) {
            if(graph.ResizePaneTouched()) {
              C.SetCursor("row-resize");
            }
          }

        }

      } else if(ins(C.mouseX, C.mouseY, C.layout.resizeZoneX)) {
        C.SetCursor("col-resize");
      } else if(ins(C.mouseX, C.mouseY, C.layout.resizeZoneY)) {
        C.SetCursor("row-resize");
      } else {
        C.SetCursor(null);
      }

      if(!inChart)
        C.selectedBar = 0;
      else {
        var i;

        if(C.mouseInEventZone) {
          C.mouseInEventZone = null;
          C.element.style.cursor = "crosshair";
        }

        for(i in C.EventZones.ui) {
          z = C.EventZones.ui[i];
          if(!z.cursor && !z.move)
            continue;
          if(ins(C.mouseX, C.mouseY, z)) {
            if(z.cursor) {
              C.element.style.cursor = z.cursor;
            }
            C.mouseInEventZone = z;
            break;
          }
       };
      }

      if(C.scrollDragMode)
        C.ScrollDrag(e);
      else if(C.resizeDragMode) {
        C.ResizeDrag(e);
      } else if(C.resizeGraphDragMode) {
        C.ResizeGraphDrag(e);
      }

      C.RenderMarkers();
    }
  );

  TwentyC.widget.Chart.onChartCreate.fire({
    chart : this
  });
};

/**
 * Set mouse cursor style
 * @method SetCursor
 * @param {String} cursor valid css cursor value
 */

Chart.prototype.SetCursor = function(cursor) {
  if(this.cssCursor != cursor && cursor) {
    this.element.style.cursor = cursor;
  }
  this.cssCursor = cursor;
};

Chart.prototype.TglScrollDrag = function(b,x) {
  this.canvasDict.mark.Rect(0,0,this.config.width, this.config.height);
  this.scrollDragMode = b;
  this.scrollDragX = x;
};

Chart.prototype.ScrollDrag = function(e) {
  if(this.scrollDragMode) {
    var x = this.mouseX;
    if(this.scrollDragX) {
      var diffX = this.scrollDragX - x;
      if(Math.abs(diffX) > this.plotPointW) {
        this.scrollDragX = x;
        this.index += Math.round(diffX / this.plotPointW);
        this.RenderData();
      }
    };
  }
};

Chart.prototype.TglResizeDrag = function(e,b,t) {
  if(b == "x") {
    this.resizeDragMode = {
      axis : b,
      x : t
    }
  } else if(b == "y") {

   
    // figure out which graph is targeted for y zooming

    var i, graph;
    for(i in this.graphs) {
      if(this.graphs[i].y <= t && this.graphs[i].b >= t && !this.graphs[i].overlay) {
        graph = this.graphs[i];
        break;
      }
    }

    this.resizeDragMode = {
      axis : b,
      y : t,
      graph : graph
    }

  } else
    this.resizeDragMode = null;
};

Chart.prototype.TglResizeGraphDrag = function(e,graph,y) {
  if(graph) {

    this.resizeGraphDragMode = {
      y : y,
      graph : graph,
      height : graph.height,
      dir : graph.ResizePaneTouched()
    }

  } else
    this.resizeGraphDragMode = null;
};


Chart.prototype.ResizeDrag = function(e) {
  if(this.resizeDragMode) {
    var m = this.resizeDragMode;


    if(m.axis == "x") {
      var n = this.config.grid.horizontal,diff = this.mouseX - m.x;
      if(Math.abs(diff) > 10) {
        if(diff > 0)
          n -= 1
        else 
          n += 1

        this.SetConfig({
          grid : {
            horizontal : Math.max(n,2)
          }
        });
        m.x = this.mouseX;
      }
    } else if(m.axis == "y") {

      var graph = m.graph;

      var n = graph.y_zoom,diff = this.mouseY - m.y;
      if(Math.abs(diff) > 10) {
        if(diff > 0)
          n -= 5
        else 
          n += 5

        n = Math.max(2,n);
        graph.y_zoom = n;
        this.RenderData();
        m.y = this.mouseY;
      }
 

    }
  };
};

Chart.prototype.ResizeGraphDrag = function(e) {
  if(this.resizeGraphDragMode) {
    var m = this.resizeGraphDragMode;
    var graph = m.graph, i, u, b, sibling;
    var n = graph.height,diff = this.mouseY - m.y;
    if(Math.abs(diff) > 3) {
      if(diff > 0)
        n -= (m.dir == 1 ? 5 : -5)
      else 
        n += (m.dir == 1 ? 5 : -5)

      n = Math.max(35,n);

      var heightDiff = n -  graph.height;

      //console.log(graph.height, n, heightDiff, graph.y, graph.b, graph.b-graph.y);

      if(m.dir == 2) {
        sibling = graph.nextSibling;
        while(sibling) {
          if(sibling.defaultHeight) {
            sibling.defaultHeight -= heightDiff;
            break;
          }
          sibling = sibling.nextSibling;
        }
      } else if(m.dir == 1) {
        sibling = graph.prevSibling;
        while(sibling) {
          if(sibling.defaultHeight) {
            sibling.defaultHeight -= heightDiff;
            break;
          }
          sibling = sibling.prevSibling;
        }
      }


      //this.RenderData();
      graph.defaultHeight = graph.height = n;
      m.y = this.mouseY;
      this.ResetGraphLayout();
    }
  }
};


/**
 * Get chart element region object (YUI Dom Region)
 * @method GetRegion
 * @returns {Object} Region
 * @param {Boolean} force if true region will be updated no matter what
 */

Chart.prototype.GetRegion = function(force) {
  if(!this.region||force) {
    this.region = Y.util.Dom.getRegion(this.element);
  }
  return this.region;
};

/**
 * Update the config of this chart
 * @method SetConfig
 * @param {Object} config config object holding config key,value pairs
 */

Chart.prototype.SetConfig = function(config) {
  var instance = this;
  TwentyC.util.UpdateObject(this.config, config,
    function(name, oldValue, newValue) {
      instance.onConfigUpdate(name, oldValue, newValue);
    }
  );

  if(this.requireRender >= 3) {
    this.region = 0;
    var i, R = this.config.chart_region, G = this.config.grid;
    var width = this.config.width;// - (R.x+R.r);
    var height = this.config.height;// - (R.y+R.b);
    var qr = TwentyC.util.qr;

    this.chartWidth = width-(R.x+R.r);
    this.chartWidthInner = this.chartWidth - (G.pad_x+G.pad_r);
    this.chartHeight = height-(R.y+R.b)-XAXIS_HEIGHT;
    this.chartHeightInner = this.chartHeight - (G.pad_y+G.pad_b);

    G.x_count = qr(this.chartWidthInner / G.x_width);
    G.y_count = qr(this.chartHeightInner / G.y_height);

    /**
     * Amount of plot points accross the x axis
     * @property plotPointsX
     * @type Number
     */

    this.plotPointsX = G.x_count * G.horizontal;
    
    /**
     * Amount of plot points across the y axis
     * @property plotPointsY
     * @type Number
     */
    
    this.plotPointsY = G.y_count * G.vertical;

    /**
     * plot point width , note that this is not bar width, for bar width check this.barW
     * @property plotPointW
     * @type Number
     */

    this.plotPointW = this.chartWidthInner / this.plotPointsX;
    
    /**
     * plot point height
     * @property plotPointH
     * @type Number
     */
    
    this.plotPointH = this.chartHeightInner / this.plotPointsY;
    
    /**
     * bar width - 75% of this.plotPointW
     * @property barW
     * @type Number
     */

    this.barW = TwentyC.util.qr(this.plotPointW * 0.75);

    /**
     * holds information of layout proporitions, all values are numeric (pixels)
     *
     *     {
     *       chart : {
     *         x : left offset of chart region,
     *         y : top offset of chart region,
     *         w : total width of chart region,
     *         h : total height of chart region,
     *         r : right border of chart region,
     *         b : bottom border of chart region
     *       },
     *
     *       // the inner chart region refers to the actual space allocated
     *       // fot drawing plot data
     *
     *       chartInner : {
     *         x : left offset of inner chart region,
     *         y : top offset of inner chart region,
     *         w : total width of inner chart region,
     *         h : total height of inner chart region,
     *         r : right border of inner chart region,
     *         b : bottom border of inner chart region
     *       }
     *
     * @property layout
     * @type Object
     */
    
    this.layout = {
      chart : {
        x : R.x,
        y : R.y,
        w : this.chartWidth,
        h : this.chartHeight,
        r : R.x+this.chartWidth,
        b : R.y+this.chartHeight
      },
      chartInner : {
        x : R.x + G.pad_x,
        y : R.y + G.pad_y,
        w : this.chartWidthInner,
        h : this.chartHeightInner,
        r : R.x + G.pad_x + this.chartWidthInner,
        b : R.y + G.pad_y + this.chartHeightInner
      }
    };

    this.layout.graphLabel = {
      x : this.layout.chartInner.x,
      y : 2,
      w : 200,
      h : 15 
    };
    
    this.layout.resizeZoneX = {
      x : this.layout.chart.x,
      w : this.layout.chart.w,
      y : this.layout.chart.b,
      h : this.config.height - this.layout.chart.b
    };

    this.layout.resizeZoneY = {
      x : this.layout.chart.r,
      w : this.config.width - this.layout.chart.r,
      h : this.layout.chart.h,
      y : this.layout.chart.y
    };

    if(!this.config.toolbar.disabled) {
      
      var offset = TOOLBAR_HEIGHT;
      this.layout.chart.y += offset
      this.layout.chart.h -= offset;
      this.layout.chartInner.y += offset
      this.layout.chartInner.h -= offset;
      //this.layout.resizeZoneX.y -= offset;
      //this.layout.resizeZoneX.h = 15;
 
    }

    if(this.config.scrollbar.enabled) {
      // init scrollbar if not done yet
      var sb = this.config.scrollbar;
      if(!this.Scrollbar) {
        this.Scrollbar = new TwentyC.widget.Chart.widget.Scrollbar();
        this.Scrollbar.Init(sb);
        this.Scrollbar.SetChart(this);
      }

      // make room for scrollbar
      var offset = (sb.height+ sb.y_offset)
      this.layout.chart.h -= offset;
      this.layout.chart.b -= offset;
      this.layout.chartInner.h -= offset;
      this.layout.chartInner.b -= offset;

      //console.log(offset, sb);

      this.layout.resizeZoneX.y -= offset;
      this.layout.resizeZoneX.h = 15;
        
      this.Scrollbar.SetLayout(
        this.layout.chart.x + sb.x_offset,
        this.config.height - offset,
        this.layout.chart.w,
        sb.height
      );
 
    } else {
      
      var offset = 15;
      //this.layout.chart.h -= offset;
      //this.layout.chart.b -= offset;
      //this.layout.chartInner.h -= offset;
      //this.layout.chartInner.b -= offset;
      //this.layout.resizeZoneX.y -= offset;
      this.layout.resizeZoneX.h = 15;

 
    }

    for(i in this.canvasDict) {
      this.canvasDict[i].states = {};
      if(this.canvasDict[i].element.width != width || this.canvasDict[i].element.height != height) {
        this.canvasDict[i].Resize(width, height);
      }
      this.canvasDict[i].element.style.left = "0px";;
      this.canvasDict[i].element.style.top = "0px";;
    };
  }


  if(this.requireRender >= 2) {
    this.ResetGraphLayout();
    this.RenderUI();
    this.RenderBase();
  }
  if(this.requireRender >= 1) {
    this.RenderData();
    this.RenderMarkers();
  }

  this.requireRender = 0;
};

/**
 * Handle config updates, alias: this.onConfigUpdate. 
 * @method onConfigUpdateChart
 * @param {String} name name of the update config variable
 * @param {Mixed} oldValue old value
 * @param {Mixed} newValue new value
 */

Chart.prototype.onConfigUpdate =
Chart.prototype.onConfigUpdateChart = function(name, oldValue, newValue) {
  var i, r, c =this.config, render = false;
  switch(name) {
    case "width":
      this.element.style.width = newValue+"px";
      render = 3;
    break;
    case "height":
      this.element.style.height = newValue+"px";
      render = 3;
    break;

    case "instrument.symbol":
      var graph = this.graphs.main;
      this.selectedBar = null;
      if(graph) {
        graph.title = newValue;
        render = 3;
      }
    break;
    
    case "instrument.precision":
      var i, graph;
      for(i in this.graphs) {
        graph = this.graphs[i];
        if(graph.data_type == "market") {
          graph.precision = newValue;
          graph.RedoCalc();
        }
      }
      render = 1;
    break;
    
    case "instrument.price_format":
      var i, graph;
      for(i in this.graphs) {
        graph = this.graphs[i];
        if(graph.data_type == "market") {
          graph.price_format = newValue;
          graph.RedoCalc();
        }
      }
      render = 1;
    break;
 
 
    case "instrument.tick_size":
      var i, graph;
      for(i in this.graphs) {
        graph = this.graphs[i];
        if(graph.data_type == "market") {
          graph.tick_size = newValue;
          graph.RedoCalc();
        }
      }
      render = 1;
    break;
    
    case "chart_region.x":
    case "chart_region.y":
    case "chart_region.r":
    case "chart_region.b":
    case "grid.x_width":
    case "grid.y_height":
    case "grid.vertical":
    case "grid.horizontal":
    case "grid.pad_x":
    case "grid.pad_y":
    case "grid.pad_r":
    case "grid.pad_b":
      render = 3;
    break;

    case "toolbar.disabled":
      if(newValue) {
        this.elements.toolbar.style.display = "none";
        this.elements.prefs.style.top = "0px";
      } else {
        this.elements.toolbar.style.display = "block";
        this.elements.prefs.style.top = TOOLBAR_HEIGHT+"px";
      }
      render = 3;
    break;

    case "scrollbar.enabled":
      render = 3;
    break;

    case "colors.bgc_container":
      this.element.style.backgroundColor = newValue;
    break;
  }

  if(render > this.requireRender)
    this.requireRender = render;

  return;
};

/**
 * Set a new source and instrument for the chart
 * @method ChangeInstrument
 * @param {Object} config instrument config holding symbol, tick_size and precision
 * @param {Array} source data source
 */

Chart.prototype.ChangeInstrument = function(config, source) {
  this.SetConfig(config);
  this.SetSource(source);
};

/**
 * Append the chart to a html element
 * @method Dock
 * @param {HTML Element} element this element will be the new parentNode of the chart
 */

Chart.prototype.Dock = function(element) {
  element.appendChild(this.element);
};

/**
 * Remove graph area from chart
 * @method RemoveGraph
 * @param {TwentyC.widget.Chart.widget.Graph} graph graph object
 */

Chart.prototype.RemoveGraph = function(graph) {
  var idx = TwentyC.util.InArray(graph, this.graphsOrder)
  if(idx > -1) {
    this.graphsOrder.splice(idx, 1); 
  }
  if(graph.par) {
    graph.par.overlayed.splice(graph.ParentIndex(),1);
    graph.overlay = null;
    graph.par = null;
  } else {
    this.stackedGraphs--;
  }
  if(graph.overlayed.length) {
    var i, o = graph.overlayed;
    var first = o[0][1],G;
    graph.overlayed = [];
    first.overlay = null;
    first.par = null;
    for(i = 1; i< o.length; i++)  {
      G = o[i][1];
      G.SetParent(first);
    }
  }
  delete this.graphs[graph.name];

  this.ResetGraphLayout();
  this.onRemoveGraph.fire({
    chart : this,
    graph : graph
  });
  graph.onRemoveFromChart.fire({
    chart : this,
    graph : graph
  });


};

/**
 * Remove all drawings
 * @method ClearDrawings
 */

Chart.prototype.ClearDrawings = function() {
  var i;
  for(i in this.graphs) {
    this.graphs[i].drawings = [];
  }
  this.RenderData();
};

/**
 * Remove all graphs
 * @method ClearGraphs
 */

Chart.prototype.ClearGraphs = function() {
  var i;
  this.graphs = {};
  this.graphsOrder = [];
  this.RenderBase();
  this.RenderData();
};

/**
 * Add a graph area to the chart
 * @method AddGraph
 * @param {String} name unique name or id to reference the graph
 * @param {Object} graph graph object
 * @param {Number} position position, if omitted and graph is not overlayed graph will be added to bottom
 */

Chart.prototype.AddGraph = function(name, graph, position) {
  var i,l=0,g;
  this.graphs[name] = graph;
  graph.chart = this;

  if(graph.adjust_price) {
    graph.tick_size = this.config.instrument.tick_size
    graph.precision = this.config.instrument.precision
    graph.price_format = this.config.instrument.price_fomat
  }
  if(typeof position != "undefined")
    graph.overlay = null;

  if(typeof position != "number")
    this.graphsOrder.push(graph);
  else {
    if(position)
      this.graphsOrder.splice(position,0,graph);
    else
      this.graphsOrder.unshift(graph);
  }
 
  graph.name = name;

  if(graph.overlay && typeof position != "number") {

    // graph is set to be an overlay by default
    // check if targeted parent graph exists
    //
    // if not add graph as normal stacked graph
    
    if(this.graphs[graph.overlay]) {
      var par = this.graphs[graph.overlay];
      graph.SetParent(par);
    } else
      graph.overlay = null;
  }

  // if source exists, calculate graph

  if(this.source) {
    for(i = 0; i < this.source.length; i++) {
      graph.NewBar(
        this, this.source, i
      );
    }
  }

  this.ResetGraphLayout();

  this.onAddGraph.fire({
    chart : this,
    graph : graph
  });
  graph.onAddToChart.fire({
    chart : this,
    graph : graph
  });

  return graph


};

/**
 * Move graph to a new location, location can either be object or number. If 
 * it's a number move it to the specified point inthe graph order. If its 
 * an object, assume its another graph and overlay it
 * @method MoveGraph
 * @param {TwentyC.widget.Chart.widget.graph} graph instance
 * @param {Mixed} target can be number or graph instance
 */

Chart.prototype.MoveGraph = function(graph, target) {

  var oldIdx = TwentyC.util.InArray(graph, this.graphsOrder);

  if(typeof target == "number" || target === null) {
    
    // move graph to new position in order
    this.RemoveGraph(graph);

    if(target >= oldIdx && target)
      target--;

    this.AddGraph(graph.name, graph, target);

  } else if(typeof target == "object") {

    // assume target is another graph, overlay
    //
    // check that same graph doesnt exist already
    
    if(target.HasOverlay(graph))
      return;

    this.RemoveGraph(graph);
    graph.overlay = target.name;

    this.AddGraph(graph.name, graph);
  }
};

/**
 * Adjust graph height and positions to default
 * @method ResetGraphLayout
 */

Chart.prototype.ResetGraphLayout = function() {
  
  var i, l=0;

  // adjust height

  var totalHeight = this.layout.chart.h;
  var y = this.layout.chart.y, x = this.layout.chartInner.x;
  var n = 0, P, graph, j, k=0, b_graph;

  for(i in this.graphsOrder) {
    graph = this.graphsOrder[i];
    graph.renderXAxis = false;
    graph.renderXAxisToGraph = null;
    graph.xAxisBottomFor = null;
  }

  //for(i = 0; i <  this.graphsOrder; i++) {
  for(i in this.graphsOrder) {
    graph = this.graphsOrder[i];
    i = parseInt(i);
    if(graph.overlay) {
      continue;
    }
    
    graph.renderXAxis = (graph.custom_x_axis || (!i || i>k));

    if(graph.custom_x_axis) {
      graph.renderXAxisToGraph = graph;
      graph.xAxisBottomFor = graph;
    } else if(graph.renderXAxis) {
      graph.renderXAxisToGraph = graph;
      for(j = i+1; j < this.graphsOrder.length; j++) {
        b_graph = this.graphsOrder[j];
        //console.log("Checking ",graph.title,"against",b_graph.title,b_graph);
        if(!b_graph.overlay && !b_graph.custom_x_axis) {
          graph.renderXAxisToGraph = b_graph;
          k = j;
        } else if(!b_graph.overlay && b_graph.custom_x_axis)
          break;
      }
      graph.renderXAxisToGraph.xAxisBottomFor = graph;
    }

    
    if(l && graph.renderXAxis)
      totalHeight -= this.config.grid.x_axis_height
    l+=1;

    //console.log(graph.title, graph.renderXAxis, (graph.renderXAxisToGraph||{}).title, i, k);
      
  }

  // get height total of graphs with custom adjusted height
  var totalCustomHeight = 0, u = 0;

  for(i in this.graphsOrder) {
    graph = this.graphsOrder[i];
    if(graph.defaultHeight && !graph.overlay) {
      totalCustomHeight += graph.defaultHeight;
      u++;
      totalCustomHeight += 5;
    }
  }

  this.graphsWithCustomHeight = u;

  totalHeight -= totalCustomHeight;
  var adjust = 0, dh;

  if(totalHeight < 100) {
    adjust = 100 - totalHeight;
    totalHeight = 100;
  }
  totalCustomHeight -= adjust;
  adjust /= u;

  var height = (totalHeight / (l-u))-5;

  //console.log("tH", totalHeight, "h", height, "tCH", totalCustomHeight);

  var prev;

  for(i in this.graphsOrder) {
    graph = this.graphsOrder[i];
    if(graph.overlay) {
      continue;
    }

    if(graph.defaultHeight)
      graph.defaultHeight -= adjust;

    graph.nextSibling = null;
    graph.height = (graph.defaultHeight || height);
    graph.width = this.layout.chartInner.w;
    y+=5;
    graph.y = y;
    graph.x = x;
    graph.r = x+this.layout.chartInner.w;
    y += graph.height;
    graph.b = y;
    n++;

    if(graph.xAxisBottomFor && this.graphsOrder[parseInt(i)+1]) {
      y += this.config.grid.x_axis_height;
    }
   
    if(prev) {
      prev.nextSibling = graph;
    }
    graph.prevSibling = prev;

    prev = graph;
  }

  this.stackedGraphs = l;

  // handle graph overlay
  
  for(i in this.graphsOrder) {
    var graph = this.graphsOrder[i];
    if(graph.overlay) {
      P = this.graphs[graph.overlay];
      graph.height = P.height;
      graph.width = P.width;
      graph.y = P.y;
      graph.x = P.x;
      if(graph.scale) {
        graph.height = (P.height * (graph.scale / 100))
        graph.y = (P.y + P.height - graph.height);
      }
    }
  }
  this.RenderBase();
  this.RenderData();
  this.RenderUI();

};

/**
 * Set data source, Update() will then read data from the 
 * specified source. Source should be an array holding market
 * data. [{high,low,open,close,time,volume},..]
 * @method SetSource
 * @param {Array} source
 */

Chart.prototype.SetSource = function(source) {
  this.source = source;
  this.sourceLength = source.length;
  this.index = source.length;
  var n,i,k=0, graph, ts = this.config.time_tick_size;


  for(i in this.graphs) {
    this.graphs[i].data = [];
    this.graphs[i].drawings = [];
    graph = this.graphs[i];
    graph.maxY = 0;
    graph.maxX = 0;
    graph.minY = 999999999;
    graph.minX = null;

    for(n = 0; n < source.length; n++) {

      graph.NewBar(this, source, n);
    }
    k++;
  };

  var b = source[source.length-1];
  if(source.length) {
    this.startTime = source[0].time;
    this.startTime -= (this.startTime % this.config.time_tick_size);
    this.SetCurrentBar(b);
  } else
    this.startTime = 0;
  this.RenderData();
  this.RenderMarkers();
};

/**
 * Unset current chart source
 * @method RemoveSource
 */

Chart.prototype.RemoveSource = function() {
  this.source = [];
  var i;
  this.index = 0;
  this.start = null;
  for(i in this.graphs) {
    this.graphs[i].RedoCalc();
  }
  this.RenderBase();
  this.RenderData();
};


Chart.prototype.SetCurrentBar = function(b) {
  this.currentBar = {
    open : b.open,
    close : b.close,
    high : b.high,
    low : b.low,
    price : b.price,
    time : b.time
  }
};

/**
 * Sync chart to data source. After SetSource has been called you can
 * call Sync() to render any updates. If the current index (position on
 * the timeline) is at the most recent point it will be set to the new most
 * recent point
 * @method Sync
 * @param {Number} added amount of entries pushed to the source
 * @param {Number} removed amount of entries shifted from the source
 */

Chart.prototype.Sync = function(added, removed) {
  if(this.source) {
    var s = this.source;


    var ts = this.config.time_tick_size;
    if(this.sourceLength < s.length||added||removed) {
      if(this.index == this.sourceLength && !this.drawingTool) {
        this.index = s.length;
      } else {
        this.index = (this.index - removed);
      }
      if(this.selectedBar && removed)
        this.selectedBar -= removed;

      var i, n, p;
      if(removed) {
        for(i in this.graphs) {
//          console.log("Current Bars "+[this.index, s.length, added, removed, this.graphs[i].data.length]);
          for(p = 0; p < removed; p++) {
            this.graphs[i].data.shift();
          }
//          console.log("Removed Bars "+[this.index, s.length, added, removed, this.graphs[i].data.length]);
        }
      }


      for(n = added; n > 0; n--) {
        for(i in this.graphs) {
          this.graphs[i].NewBar(this, s, s.length-n, true);
        }
      }

      this.SetCurrentBar(s[s.length-1]);
      this.sourceLength = this.source.length;
      this.RenderData();
    } else if(this.index == this.source.length) {
      var bar = s[s.length-1];
      var cBar = this.currentBar,k,u=false;

      // check if current (most recent) bar has changed, and
      // render those changes
      for(k in bar) {
        if(cBar[k] != bar[k]) {
          u = true;
        }
      }

      if(u) {

        for(i in this.graphs) {
          this.graphs[i].UpdateBar(this, s, this.index-1);
        }
        this.SetCurrentBar(bar);
        this.RenderData();
      }
    } else {
      for(i in this.graphs) {
        this.graphs[i].UpdateBar(this, s, s.length-1);
      }
    }
  }
};

/**
 * Return graph under the mousepointer if any
 * @method TouchedGraph
 * @param {Number} x
 * @param {Number} y
 * @returns {TwentyC.widget.Chart.widget.Graph} 
 */

Chart.prototype.TouchedGraph = function(x, y) {
  var i,g,l=this.layout.chart;
  if(x >= l.x && x <= l.r) {
    for(i in this.graphs) {
      g = this.graphs[i];
      if(y >= g.y && y <= g.y+g.height) {
        return g;
      }
    }
  }

  return 0;
}

/**
 * Render markers and mouse cross hair
 * @method RenderMarkers
 */

Chart.prototype.RenderMarkers = function() {
  // clear
  var C = this.canvasDict.mark;
  C.Rect(0,0,this.config.width,this.config.height);
  
  if(!this.source||!this.source.length)
    return;


  this.onRenderMarkers.fire({
    chart : this.chart
  });

  var x, y, graph, i, idx=0;
  // render graph information
  if(!this.editMode) {
    for(i in this.graphs) { 
      graph = this.graphs[i];
      if(!graph.config.show_info_labels)
        continue;
      var label = this.layout.graphLabel;
      x = label.x;
      idx = graph.LabelPosition();

      if(!graph.overlay) {
        y = graph.y+label.y+((label.h+1)*(idx));
      } else {
        y = graph.par.y+label.y+((label.h+1)*(idx));
      }

      graph.RenderLabel(C, x, y);

    }
  }
  graph = null;

  // render selected bar 
  
  var bar = this.selectedBar;
  if(bar >= this.start && bar <= this.index && this.source && this.source[bar]) {
    C.Rect(
      this.ValueToX(graph, this.source[bar].time) + ((this.plotPointW / 2)-(this.barW / 2)),
      this.layout.chart.y,
      this.barW,
      this.layout.chart.h,
      this.config.colors.bar_highlight
    );
  } else
    bar = 0;

  // if drawing tool is selected, render drawing tool name near cursor

  if(this.drawingTool) {
    C.Text(
      this.drawingTool.name + (this.drawingTool.pickedUp ? " (Edit)" :""),
      "#fff",
      this.mouseX + 10,
      this.mouseY + 5,
      "9px Verdana, Arial, Helvetica",
      "left"
    );
  } else if(this.eraserTool) {
    C.Text(
      "Eraser",
      "#fff",
      this.mouseX + 10,
      this.mouseY + 5,
      "9px Verdana, Arial, Helvetica",
      "left"
    );
  }
 
 
 
  // find out which graph the mouse is hovering over,
  // if any

  if(!bar)
    x = this.mouseX;
  else
    x =this.ValueToX(graph, this.source[bar].time) + (this.plotPointW / 2);

  y = this.mouseY;

  var l = this.layout.chart;
  var colors = this.config.colors;
  var i, g, graph;
  var mt = 10;
  var mh = this.config.markHeight||14;
  var mw = this.config.width - (l.r);
  var my_x = (l.r-5);
  var my_y = (y-(mh/2));

  var vt = 14;
  var vh = 10;
  var vw = 100;
  var vy_x = (x-(vt/2));
  var vy_y = (l.b-5);

  if(x >= l.x && x <= l.r) {
    for(i in this.graphs) {
      g = this.graphs[i];
      if(y >= g.y && y <= g.y+g.height) {
        graph = g;
        break;
      }
    }
  }


  var renderCrossHair = true;
  if(this.graphDnD)
    renderCrossHair = false;
  if(this.scrollDragMode)
    renderCrossHair = false;

  // render crosshair
  if(graph && renderCrossHair) {
     

    if(this.config.crosshair_lines) {
      C.Line(
        l.x, y, l.r, y, 1, colors.crosshair
      );
      C.Line(
        x, l.y, x, l.b, 1, colors.crosshair
      );
    }


    C.Triangle(
      my_x, my_y, mt, mh, colors.crosshair, "l"
    );
    C.Rect(
      (my_x+mt), my_y, mw, mh, colors.crosshair
    );
    C.Text(
      graph.FormatTickValue(this.YToValue(graph, y-graph.y)), 
      colors.crosshair_f, 
      (my_x+mt), 
      my_y+2, 
      "10px Arial", 
      "left"
    );


    C.Triangle(
      vy_x, vy_y, vt, vh, colors.crosshair, "u"
    );

    if(!graph.custom_x_axis) { 
      var x_text = this.FormatTimeTick(
        this.XToValue(graph, x-this.layout.chartInner.x),
        this.XToValue(graph, x-this.layout.chartInner.x, true),
        true
      );
    } else {
      var x_text = graph.FormatTickValueX(
        this.XToValue(graph, x-this.layout.chartInner.x, false)
      );
    }

    C.SetState("font", "10px Arial");
    vw = C.Ctx().measureText(x_text).width+10;

    C.Rect(
      vy_x-(vw / 2)+(vt/2),
      l.b+3,
      vw,
      vt,
      colors.crosshair
    );
 

    C.Text(
      x_text, colors.crosshair_f, x+2, l.b+5, "10px Arial", "center"
    );
      

  }

};

/**
 * Create info object for marking of x axis ticks.
 * @method GridXInfo
 * @private
 * @param {Number} start start index of the rendered plot (when x axis is scrolled this would be > 0)
 * @param {Number} end end index of the rendered plot
 * @param {Array|Object} source iterable object holding tick data (can either be the chart main source, or a graph's plot data object)
 * @param {String} field field to plot - with market data this should be "time", but with graphs that have custom_x_axis setup this would change to whatever is specified in graph.custom_x_axis.plot
 * @param {Number} ts tick size, value of one tick
 * @param {Number} ts_d tick_size normalizer with market data this should be 1000, so ms can be normalized to seconds
 * @param {Number} start_value value of the first plot point in source 
 * @returns Object object holding location of x axis tick lines and labels
 */

Chart.prototype.GridXInfo = function(start, end, source, field, ts, ts_d, start_value, dbg) {
  var grid = this.config.grid;
  var u = (ts/ts_d) * grid.horizontal,e,r;
  var s = source;
  var diff, val, prev;
  var time_gridX = [],
      time_gridTicksX = 0,
      time_xc = 0,
      time_nextTickX = null;
  
  var start_value = source[0][field];
  var first_tick_at, next_tick_at;
  // sync first tick to 00:00 of current day (from graph data starting point)
  // FIXME: this may need to be adjusted for periods > 1 day ? need to test
  first_tick_at = start_value - (start_value % 86400000);

  diff = ((start_value - first_tick_at) / ts) / grid.horizontal;
  next_tick_at = Math.floor((Math.ceil(diff) - diff) * grid.horizontal)
  if(this.dbg)
    console.log(source[0][field], start_value, diff, next_tick_at);

  //var next_tick_at = tick_offset + grid.horizontal;

  for(r = 0; r < start; r++) {
    if(r == next_tick_at) {
      next_tick_at = r + grid.horizontal;
    }
  }

  for(r = start; r < end; r++) {
    if(r)
      prev = val;
    val = s[r][field];
    
    if(r == next_tick_at) {
      time_gridX.push(
        [
        val, 
        time_gridTicksX, 
        r>0 ? prev : val,
        r>0 ? val - prev : 0
        ]
      );
      next_tick_at = r + grid.horizontal;
    }

    time_gridTicksX++;
  }

  return {
    gridX : time_gridX,
    gridTicksX : time_gridTicksX,
    xc : time_xc,
    nextTickX : time_nextTickX
  }
}



/**
 * Render dynamic data (eg. plot market data, indicators, marks)
 * @method RenderData
 */

Chart.prototype.RenderData = function() {

  if(this.inactive)
    return;
  
  var z,i,f,n,x,y,r,j,diff,s = this.source,n;
  var C = this.canvasDict.plot;
  var colors = this.config.colors;
  var time = [], t1 = new Date().getTime(),t2;

  this.ToolbarUpdateHotkeys();

  if(!s)
    return;
   
  var graph, h = this.layout.chartInner.y, R = this.config.chart_region;
  var l = s.length, first = true, t = 0;
  var grid = this.config.grid;
  var layout = this.layout;
  var qr = TwentyC.util.qr;
  var indexDiff;


  this.EventZones.drawings = [];
  
  if(this.index < this.plotPointsX)
    this.index = this.plotPointsX;
  if(this.index > s.length)
    this.index = s.length;
  var end = this.index || s.length;
  var start = end - this.plotPointsX;
  if(start < 0)
    start = 0;

  this.start = start;
  
  var time_start = start;
  var time_end = end;

  var empty = s.length ? false : true;


  var clearAll = true;
  
  // clear old data
  if(clearAll) {
    C.Rect(
      0,
      0,
      this.config.width,
      this.config.height,
      null,
      { updateCollisionMap : "#000" }
    );
  }

  // if empty , display message stating so
  if(empty) {
    C.Text(
      TwentyC.widget.Chart.locale.no_data,
      colors.empty_msg,
      this.layout.chart.x + (this.layout.chart.w/2),
      this.layout.chart.y+25,
      "bold 16px Arial, Verdana",
      "center"
    );
    return;
  }

  var gridY = [], gridTicksY = 0;
  var gridX = [], gridTicksX = 0, xc = 0;
  var ts = this.config.time_tick_size;
  var o, ng;

  var nextTickX = null;
  
  var time_gridX = [],
      time_gridTicksX = 0,
      time_xc = 0,
      time_nextTickX = null;

  // calculate x axis grid, do this only once since all non-custom
  // x axis graphs will share it

  // keep track of time values along the x axis for 
  // easy conversion later on

  var gridXInfo = this.GridXInfo(
    start,
    end,
    s,
    "time",
    ts, 
    1000,
    this.startTime
  );

  time_gridX = gridXInfo.gridX;
  time_gridTicksX = gridXInfo.gridTicksX;
  time_xc = gridXInfo.xc;
  time_nextTickX = gridXInfo.nextTickX;

  this.time_gridX = time_gridX;

  
  // render chart seperators
  n=0;
  for(i in this.graphsOrder) {
    graph = this.graphsOrder[i];
    if(!graph.overlay && n < this.stackedGraphs-1) {
      y = graph.b;
      n++;
      C.Line(
        this.layout.chart.x, 
        y,
        (this.config.width-R.x)-10,
        y,
        this.config.grid.width, 
        colors.bdc_chart
      );
    }

    graph.maxY = 0;
    graph.maxX = 0;
    graph.minY = empty ? 0 : 9999999999999999999;
    graph.minX = null;
    if(graph.custom_x_axis) {
      if(graph.custom_x_axis.absolute) {
        start = graph.start = 0;
        end = graph.end = graph.data.length;
      } else {
        end = graph.end = Math.max(this.plotPointsX, graph.data.length - (s.length - time_end));
        start = graph.start = Math.max(0, graph.end - this.plotPointsX);
      }
    } else {
      start = graph.start = time_start;
      end = graph.end = time_end;
    }
    // calculate plot data and  grid points
    if(graph.SetCustomLimits) {
      graph.SetCustomLimits(start, end)
    } else {
      for(r = start; r < end; r++) {
        graph.SetLimits(graph.data[r]);
      }
      graph.SetLimitsViaAdjusters();
    }

  }


  // render plot data 
  for(i in this.graphsOrder) {
    
    graph = this.graphsOrder[i];
    var plotData = null;

    if(graph.error)
      continue;

    graph.beforeCalculate.fire({graph:graph});

    start = graph.start
    end = graph.end;


    if(!graph.custom_x_axis) {
      
      // graph will be using the common time grid

      var gridX = time_gridX,
          gridTicksX = time_gridTicksX,
          xc = time_xc,
          nextTickX = time_nextTickX;

    } else {

      if(graph.custom_x_axis.auto_overflow) {
        if(graph.data.length > this.plotPointsX)
          graph.custom_x_axis.absolute = false;
        else
          graph.custom_x_axis.absolute = true;
      }
      
      // graph will be doing custom x axis calculation / grid setup
      // graph.custom_x_axis.absolute = true;

      var gridX = [], 
          gridTicksX = 0, 
          xc = 0, 
          nextTickX = null;

      plotData = graph.GetDataForPlotName(graph.custom_x_axis.plot);

    }


    // create shortcuts to various useful properties on the graph

    graph.plotPointW = this.plotPointW;
    graph.plotPointH = this.plotPointH;
    graph.plotPointsX = this.plotPointsX;
    graph.plotPointsY = this.plotPointsY;
    graph.barW = this.barW;


    if(graph.custom_x_axis) {

      if(graph.custom_x_axis.absolute) {
        
        // if custom_x_axis.absolute is true it means all the graph data
        // will be displayed absolute to the chart's container proportions
        // there will be no scrolling

        graph.plotPointW = graph.width / graph.end;
        graph.plotPointsX = graph.width / graph.plotPointW;
        graph.barW = qr(graph.plotPointW * (graph.custom_x_axis.bar_scale||0.75));
        graph.xCount = (graph.width / grid.x_width);
        graph.ticksPerGridX = Math.ceil(
          (
            (graph.maxX - graph.minX) /
            graph.xCount
          ) /
          graph.custom_x_axis.tick_size
        );

      } else {
        
        // if custom_x_axis.absolute is false it means the graph data
        // can be scrolled.
       
        gridXInfo = this.GridXInfo(
          graph.start,
          graph.end,
          plotData,
          graph.custom_x_axis.field,
          graph.custom_x_axis.tick_size,
          graph.custom_x_axis.tick_size_normalizer || 1,
          null, 
          true
        );

        gridX = gridXInfo.gridX;
        gridTicksX = gridXInfo.gridTicksX;
        nextTickX = gridXInfo.nextTickX;
        xc = gridXInfo.xc;

      }
    }

    // draw horizontal grid lines and tick labels
    
    var bottom_graph = graph.renderXAxisToGraph;
    
    if(graph.renderXAxis) {
      
      // Render background and borders for graph separator line
    
      C.Rect(
        layout.chart.x,
        bottom_graph.b,
        this.config.width,
        this.config.grid.x_axis_height,
        this.config.colors.bgc_container
      );
      C.Line(
        layout.chart.x,
        bottom_graph.b,
        layout.chart.x+layout.chart.w,
        bottom_graph.b,
        1,
        this.config.colors.bdc_chart
      );
      C.Line(
        layout.chart.x,
        graph.y-this.config.grid.pad_y,
        layout.chart.x+layout.chart.w,
        graph.y-this.config.grid.pad_y,
        1,
        this.config.colors.bdc_chart
      );

      if(!graph.custom_x_axis || !graph.custom_x_axis.absolute) {

        // To render charts with a scrollable x axis use the gridX info
        // object to determine where tick lines and labels should go
        for(x in gridX) {

          j = qr(gridX[x][1]*this.plotPointW);
          j += qr(this.plotPointW / 2)
      
          // grid line
          C.Line(
            layout.chartInner.x + j,
            graph.y,
            layout.chartInner.x + j,
            bottom_graph.b,
            1,
            this.config.colors.grid
          );

          // tick line
          C.Line(
            layout.chartInner.x + j,
            bottom_graph.b,
            layout.chartInner.x + j,
            bottom_graph.b + 3,
            1,
            this.config.colors.bdc_chart
          );

          // tick label
          if(!graph.custom_x_axis) {
            var labelText = this.FormatTimeTick(gridX[x][0], gridX[x][2]);
          } else {
            var labelText = graph.FormatTickValueX(gridX[x][0]);
          }

          C.Text(
            labelText,
            "#fff",
            layout.chartInner.x + j,
            bottom_graph.b + 5,
            "10px Arial",
            "center"
          );
        
        }
      } else {
        
        // Render x axis ticks and labels for unscrollable absolute
        // graphs
        
        r = qr(graph.ticksPerGridX), o = 0;

        for(e = graph.start; e < graph.end; e++) {
          if(!plotData[e])
            continue;

          var current = plotData[e][graph.custom_x_axis.field];

          if(o < r && e > graph.start) {
            o++
            continue;
          }
          o = 0;

          var x = graph.x + ((e-graph.start)*graph.plotPointW) + (graph.plotPointW/2);

          //console.log(r, x, nextTickX, graph.xCount, graph.width, graph.x);
     
          // grid line
          C.Line(
            x,
            graph.y,
            x,
            bottom_graph.b,
            1,
            this.config.colors.grid
          );

          // tick line
          C.Line(
            x,
            bottom_graph.b,
            x,
            bottom_graph.b + 3,
            1,
            this.config.colors.bdc_chart
          );

          // tick label
          var labelText = graph.FormatTickValueX(current);

          C.Text(
            labelText,
            "#fff",
            x,
            bottom_graph.b + 5,
            "10px Arial",
            "center"
          );
 
        }
      }
    }

    e = graph.maxY - graph.minY;


    var maxY, minY, diffMax, diffMin, center;

    var pad = graph.y_zoom;
   
    if(!graph.overlay && pad) {

      if(graph.sync_scale) {
        var O;
        for(o = 0; o < graph.overlayed.length; o++) {
          O = graph.overlayed[o][1]
          //if(!O.sync_scale || O.dont_sync_parent_scale)
          //  continue;
          graph.maxY = Math.max(graph.maxY, O.maxY);
          graph.minY = Math.min(graph.minY, O.minY);
        }
      }

      graph.dataMaxY = graph.maxY;
      graph.dataMinY = graph.minY;

      if(graph.CalculateTickSize)
        graph.tick_size = graph.CalculateTickSize();


      r = pad*graph.tick_size;
      graph.maxY = (graph.maxY + r);
      graph.maxY -= (graph.maxY % graph.tick_size);
      graph.minY = (graph.minY - r);
      graph.minY -= (graph.minY % graph.tick_size);

    }

    j = (e / graph.tick_size);

    h = graph.height / grid.y_height;
    graph.yCount = (graph.height / grid.y_height);

    if(graph.forceMinY != undefined) {
      graph.minY = graph.forceMinY;
    }
    
    if(graph.overlay) {
      var overlayed_on = this.graphs[graph.overlay];
      if(graph.sync_scale && (overlayed_on.data_type == graph.data_type)) {
        graph.maxY = overlayed_on.maxY;
        graph.minY = overlayed_on.minY;
      }
    }


    // draw price grid lines
    var nextTickY = null, gridTicksY = 0;
    r = Math.ceil(((graph.maxY - graph.minY) / graph.yCount) / graph.tick_size);

    if(graph.forceMinY != undefined) {
      var trueMinY = graph.maxY - (h*r);
      if(trueMinY < graph.minY) {
        graph.maxY += (graph.minY - trueMinY);
        graph.maxY = Math.ceil(graph.maxY);
      }
    }

    //console.log("Drawing from",graph.minY,"to",graph.maxY,graph.yCount,graph.height,grid.y_height);


    graph.maxY = Math.max(
      graph.minY + (graph.yCount * r * graph.tick_size),
      graph.maxY
    );

    //r = Math.ceil(((graph.maxY - graph.minY) / graph.yCount) / graph.tick_size);

    graph.ticksPerGrid = r;

    var yA, yB, vA, vB, originPoint = (graph.y_axis_origin == undefined ? graph.minY : graph.y_axis_origin);

    if(originPoint < graph.minY || originPoint > graph.maxY)
      originPoint = graph.minY;

    for(e = 0; e <= graph.yCount; e++) {
      if(graph.overlay)
        continue;

      if(!e) {
        vA = originPoint;
        vB = null;
      } else {
        if(vB === null)
          vB = originPoint;
        vA -= graph.tick_size * r;
        vB += graph.tick_size * r;
      }

      yA = this.ValueToY(graph, vA);
      yB = this.ValueToY(graph, vB);

      if(vA >= graph.minY && yA <= layout.chartInner.b) {

        C.Line(
          layout.chart.x+1,
          yA,
          layout.chart.r-2,
          yA,
          1,
          this.config.colors.grid
        );

        C.Line(
          layout.chart.r,
          yA,
          layout.chart.r+3,
          yA,
          1,
          this.config.colors.bdc_chart
        );

        C.Text(
          graph.FormatTickValue(vA),
          "#fff",
          layout.chart.r+5,
          yA - 5,
          "10px Arial",
          "left"
        );
      }
      if(vB <= graph.maxY && vB !== null && yB <= layout.chartInner.b) {

        C.Line(
          layout.chart.x+1,
          yB,
          layout.chart.r-2,
          yB,
          1,
          this.config.colors.grid
        );

        C.Line(
          layout.chart.r,
          yB,
          layout.chart.r+3,
          yB,
          1,
          this.config.colors.bdc_chart
        );

        C.Text(
          graph.FormatTickValue(vB),
          "#fff",
          layout.chart.r+5,
          yB - 5,
          "10px Arial",
          "left"
        );
      }
 
    }

    first = false;
    

    // plot data
    if(graph.config.opacity)
      C.Ctx().globalAlpha = graph.config.opacity;

    var gd, gdp;
    C.SetClip(
      this.layout.chart.x,
      (parseInt(i)==0 ? this.layout.chart.y : graph.y),
      this.layout.chart.w,
      graph.height
    );

    for(r = start; r < end; r++) {

      // ticks on the timeline (x axis) are not always
      // even because of market close. So keep a map
      // of the current plot points on the timelime,
      // this can later be used to translate a time to
      // a point on the chart quickly.
      
      gd = graph.data[r];
      gdp = r>0 ? graph.data[r-1] : null;

      if(!gd)
        continue;
        
      for(x in gd.plots) {
        if(gd.plots[x][graph.config.plots[x].plotValue] == undefined)
          continue;
        
        try {
          graph.draw(this, graph, gd.plots[x], gdp ? gdp.plots[x] : null, x, r, start, end);
        } catch(err) {
          graph.HandleError(err);
          break;
        }

        if(r+1 == end){
          graph.onDrawCurrent.fire({
            graph : graph,
            chart : this,
            plot : gd.plots[x],
            plotName : x,
            prev : gdp ? gdp.plots[x] : null
          })
        }
      }


    }

    graph.onRenderPlots.fire({graph:graph, chart:this, canvas:C});

    C.clip = null;

    C.Ctx().globalAlpha = 1;

    h += graph.height;
  }

  for(i in this.graphsOrder) {
    var graph = this.graphsOrder[i];

    if(graph.overlay)
      continue;

    C.SetClip(
      this.layout.chart.x,
      (parseInt(i)==0 ? this.layout.chart.y : graph.y),
      this.layout.chart.w,
      graph.height
    );

 
    // render drawings
    var drawing, j = 0, grapharea = { 
      x : graph.minX,
      r : graph.maxX,
      y : graph.minY,
      b : graph.maxY 
    };
    for(r in graph.drawings) {
      drawing = graph.drawings[r]; 

      // make sure drawing falls into drawing region
      if(
        drawing.InArea(
          graph.minX,
          graph.minY,
          graph.maxX,
          graph.maxY
        )
      ) {
        j++;
        if(drawing.noClip) {
          var clip = C.clip;
          C.clip = null;
        }
        drawing.Draw(C, drawing.capture);

        if(this.drawingTool || this.drawingSelected == drawing) {

          this.RenderDrawingControl(
            drawing,
            drawing.EraserCoords(10, 10), function(x,y,drawing) {
              drawing.Destroy();
            }, "btn-close.png", 10, 10
          );

          this.RenderDrawingControl(
            drawing,
            drawing.EditorCoords(10, 10), function(x,y,drawing) {
              drawing.OpenPrefs();
            }, "btn_stick.png", 10, 10
          );

          this.RenderDrawingControl(
            drawing,
            drawing.MoverCoords(10, 10), function(x,y,drawing) {
              drawing.Pickup();
            }, "btn-move.png", 10, 10
          );

          var changers = drawing.ChangerCoords(10, 10), ch=0;
          for(ch in changers) {
            this.RenderDrawingControl(
              drawing,
              { x : changers[ch][0], y : changers[ch][1] },
              function(x, y, data) {
                data.drawing.PickupPoint(data.changer);
              }, "btn-blank.png", 10 , 10, { changer : changers[ch][2] } 
            );
          }


        }
        if(drawing.noClip) {
          C.clip = clip;
        }
 
      }
      //window.document.title = j + " drawings";
    };

    C.clip = null;
    C.Ctx().globalAlpha = 1;

  }


  time.push(["plot", new Date().getTime()-t1]);

  if(this.index != this.prevIndex || this.sourceLength != this.prevSourceLength) {
    this.RenderUI();
  }

  this.onRenderData.fire();

  this.prevIndex = this.index;
  this.prevSourceLength = this.sourceLength;

  this.RenderMarkers();
  //alert(time);

};

/**
 * Check mouse coordinates in this.mouseX and return the
 * data index (bar number) that the mouse is currently touching
 *
 * if none is touched return the most recent index
 * @method SelectedBar
 * @returns {Number} bar index touched by mouse pointer
 */

Chart.prototype.SelectedBar = function() {
  if(!this.source || !this.source.length)
    return null;

  if(!this.mouseMoved && this.selectedBar)
    return this.selectedBar;

  var bar = this.source.length-1, x = this.mouseX, y = this.mouseY;
  if(TwentyC.util.Inside(x,y,this.layout.chartInner)) {
    bar = Math.floor(this.start + (
      (x - this.layout.chartInner.x) /
      this.plotPointW
    ));
    if(this.source[bar] == undefined)
      bar = this.source.length-1;
    this.selectedBar = bar;
  };

  this.mouseMoved = false;
  
  return (bar);
};

/**
 * Format a time tick into a user readable string taking time difference
 * to the previous tick into account
 * @method FormatTimeTick
 * @param {Number} t timestamp of tick in ms
 * @param {Number} p timestamp of previous tick in ms
 * @returns {String} user readable time string
 */

Chart.prototype.FormatTimeTick = function(t, p, dbg) {

  var zp = TwentyC.util.ZeroPad;

  var tmpl = TwentyC.widget.Chart.date_tmpl;
  
  // create date objects
  var dT = new Date();
  dT.setTime(t);

  var dP = new Date();
  dP.setTime(p);
  var r;
  
  if(!p) {
    r = tmpl.full;
  } else if(dT.getFullYear() != dP.getFullYear()) {
    r = tmpl.year;
  } else if(dT.getMonth() != dP.getMonth()) {
    r = tmpl.month;
  } else if(dT.getDate() != dP.getDate()) {
    r = tmpl.day;
  } else if(dT.getHours() != dP.getHours()) {
    r = tmpl.hour;
  } else if(dT.getMinutes() != dP.getMinutes()) {
    r = tmpl.minute;
  } else  {
    r = tmpl.second;
  }

  r = r.replace(
    "%Y", dT.getFullYear()
  ).replace(
    "%m", TwentyC.util.MonthXL[dT.getMonth()]
  ).replace(
    "%d", zp(dT.getDate(),2)
  ).replace(
    "%h", zp(dT.getHours(),2)
  ).replace(
    "%i", zp(dT.getMinutes(),2)
  ).replace(
    "%s", zp(dT.getSeconds(),2)
  );

  return r;
};

/**
 * Render column
 * @method RenderColumn
 * @param {Object} plotA plot object holding plot data (price, time)
 * @param {Object} plotB plot object holding plot data (price, time)
 * @param {String} plotName plot config name as it exists in graph.config.plots
 */

Chart.prototype.RenderColumn = function(graph, plotA, plotB, plotName) {
  var C = this.canvasDict.plot;
  var color, cfg = graph.config.plots[plotName];
  var borders = cfg.borders;
  var borderColor;
  var y = this.ValueToY(graph, plotA[cfg.plotValue]);

  if(plotB && plotB[cfg.plotValue] > plotA[cfg.plotValue]) {
    color = cfg.colors.negative;
    borderColor = cfg.colors.border_negative;
  } else {
    color = cfg.colors.positive;
    borderColor = cfg.colors.border_positive;
  }

  var payload = { 
    graph : graph,
    chart : this,
    plot_name : plotName,
    colors : {
      primary : color,
      secondary : borderColor
    },
    current : plotA,
    prev : plotB
  }

  graph.onRenderPlot.fire(payload);

  if(cfg.fill) {
    C.Rect(
      this.ValueToX(graph, plotA[graph.XAxisField()]) + ((this.plotPointW / 2)-(this.barW / 2)),
      y,
      this.barW,
      (graph.y + graph.height) -y,
      payload.colors.primary,
      { updateCollisionMap : graph.collisionColor }
    );
  }

  if(cfg.borders) {
 
    C.StrokeRect(
      this.ValueToX(graph, plotA[graph.XAxisField()]) + ((this.plotPointW / 2)-(this.barW / 2)),
      y,
      this.barW,
      (graph.y + graph.height) -y,
      1,
      payload.colors.secondary,
      { updateCollisionMap : graph.collisionColor }
    );
  }
};

/**
 * Render line between to plot points
 * @method RenderLine
 * @param {TwentyC.widget.Chart.widget.Graph} graph graph object
 * @param {Object} plotA plot object holding plot data (price, time)
 * @param {Object} plotB plot object holding plot data (price, time)
 * @param {String} plotName plot config name as it exists in graph.config.plots
 */

Chart.prototype.RenderLine = function(graph, plotA, plotB, plotName, plotIdx, start, end) {
  if(!plotA || !plotB)
    return;
  var C = this.canvasDict.plot;
  var x = this.ValueToX(graph, plotA[graph.XAxisField()]) + (graph.plotPointW/2);
  var r = this.ValueToX(graph, plotB[graph.XAxisField()]) + (graph.plotPointW/2);

  var cfg = graph.config.plots[plotName];
  if(plotA[cfg.plotValue] === undefined || plotB[cfg.plotValue] === undefined)
    return;
  if(x<=0||r <= 0)
    return;

  var payload = { 
    graph : graph,
    chart : this,
    plot_name : plotName,
    line_thickness : cfg.line_thickness,
    efficient_fill : cfg.efficient_fill,
    fill : cfg.fill,
    colors : {
      fill : cfg.colors.fill || cfg.colors.neutral,
      primary : cfg.colors.neutral,
      secondary : cfg.colors.neutral
    },
    prev : plotA,
    current : plotB
  }

  graph.onRenderPlot.fire(payload);

  if(payload.fill) {
    var y = this.ValueToY(graph, plotA[cfg.plotValue]);
    var y2 = this.ValueToY(graph, plotB[cfg.plotValue]);
    var z = this.ValueToY(graph, 0);
   
    if(!payload.efficient_fill) {
      // efficient fill is false, so we want to immediatly draw
      // this plot point and fill it
      C.Path(
        payload.colors.fill,
        [
          [x, z],
          [x, y],
          [r, y2],
          [r, z],
          [x, z]
        ],
        "fill"
      );
    } else {
      // efficient fill is true, so we add to the existing path
      // and only fill on the last plot point
      var isFirst = (plotIdx == start+1);
      var isLast = (plotIdx == end-1);

      if(graph.debug)
        console.log(plotIdx, start, end, isFirst, isLast, cfg.rlPath);

      if(isFirst) {
        cfg.rlPath=[
          [x, z],
          [x, y],
          [r, y2]
        ];
      } else if(!isLast && cfg.rlPath) {
        cfg.rlPath.push([r,y2])
      } else if(isLast && cfg.rlPath) {

        cfg.rlPath.push([r,y2])
        cfg.rlPath.push([r,z])
        cfg.rlPath.push(cfg.rlPath[0])
        C.Path(
          payload.colors.fill,
          cfg.rlPath,
          "fill"
        );
        delete cfg.rlPath;
      }
    }
  } else {
    C.Line(
      x,
      this.ValueToY(graph, plotA[cfg.plotValue]),
      r,
      this.ValueToY(graph, plotB[cfg.plotValue]),
      payload.line_thickness,
      payload.colors.primary,
      { updateCollisionMap : graph.collisionColor }
    );
  }
};

/**
 * Render candlestick at the specified plot point
 * @method RenderCandlestick
 * @param {TwentyC.widget.Chart.widget.Graph} graph graph object
 * @param {Object} plotA object holding plot data (high, low, volume, open, close, time)
 * @param {Object} plotB previous plot object (same as plotA), optional
 * @param {String} plotName plot config name as it exists in graph.config.plots
 */

Chart.prototype.RenderCandlestick = function(graph, plot, plotB, plotName) {
  if(!plot)
    return;
  var g = this.config.grid; 
  var C = this.canvasDict.plot;
  var x = this.ValueToX(graph, plot[graph.XAxisField()]);
  var y,b,h,color,cfg = graph.config.plots[plotName];
  var borders = cfg.borders;
  var borderColor;
  if(plot.open > plot.close) {
    y = this.ValueToY(graph, plot.open);
    b = this.ValueToY(graph, plot.close, 1);
    color = cfg.colors.negative;
    borderColor = cfg.colors.border_negative;
  } else if(plot.open < plot.close) {
    y = this.ValueToY(graph, plot.close);
    b = this.ValueToY(graph, plot.open, 1);
    color = cfg.colors.positive;
    borderColor = cfg.colors.border_positive;
  } else {
    y = this.ValueToY(graph, plot.close);
    h = 1;
    color = cfg.colors.neutral;
  }
  h = b-y;

  var payload = { 
    graph : graph,
    chart : this,
    plot_name : plotName,
    line_thickness : cfg.line_thickness,
    colors : {
      primary : color,
      secondary : borderColor,
      third : cfg.colors.neutral
    },
    prev : plot,
    current : plotB
  }

  graph.onRenderPlot.fire(payload);


  C.Line(
    x + (this.plotPointW / 2),
    this.ValueToY(graph, plot.high),
    x + (this.plotPointW / 2),
    this.ValueToY(graph, plot.low, 1),
    payload.line_thickness,
    payload.colors.third,
    { updateCollisionMap : graph.collisionColor }
  );
  if(h >= 1) {
    C.Rect(
      x + ((this.plotPointW / 2)-(this.barW / 2)),
      y,
      this.barW,
      h,
      cfg.fill ? payload.colors.primary : null,
      { updateCollisionMap : graph.collisionColor }
    );
  } else {
    C.Line(
      x + ((this.plotPointW / 2)-(this.barW / 2)),
      y,
      x + ((this.plotPointW / 2)-(this.barW / 2)) + this.barW,
      y,
      1,
      payload.colors.primary,
      { updateCollisionMap : graph.collisionColor }
    );
  }

  // render outline

  if(borders) {
    C.StrokeRect(
      x + ((this.plotPointW / 2)-(this.barW / 2)),
      y,
      this.barW,
      h,
      1,
      payload.colors.secondary,
      { updateCollisionMap : graph.collisionColor }
    );
  }
};

/**
 * Render a time marker for the specified graph at the specified time
 * @method RenderTimeMark
 * @param {TwentyC.widget.Chart.widget.Graph} graph instance
 * @param {Number} timestamp (ms)
 * @param {String} label, if omited chart.FormatTimeTick(time) will be used
 * @param {String} bgColor background color
 * @param {String} fColor font color
 */

Chart.prototype.RenderTimeMark = function(graph, time, label, bgColor, fColor){
  if(!bgColor)
    var bgColor = graph.config.colors.mark_bgc;
  if(!fColor)
    var fColor = graph.config.colors.mark_fc;
  var C = this.canvasDict.plot;
  var clip = C.clip;
  C.clip = null;
 
  if(!graph.custom_x_axis)
    var x =this.ValueToX(graph, time) + (graph.plotPointW / 2);
  else
    var x =this.ValueToX(graph, time);

  var l = this.layout.chart;
  var vt = 14;
  var vh = 10;
  var vw = 100;
  var vy_x = (x-(vt/2));
  var vy_y = (graph.b-5);

  if(graph.config.opacity)
    C.Ctx().globalAlpha =1;

  C.Triangle(
    vy_x, vy_y, vt, vh, bgColor, "u"
  );
  
  if(!graph.custom_x_axis) {
    var x_text = label || this.FormatTimeTick(time, 0);
  } else {
    var x_text = label || graph.FormatTickValueX(time);
  }
  
  C.SetState("font", "10px Arial");
  vw = C.Ctx().measureText(x_text).width+10;

  C.Rect(
    vy_x-(vw / 2)+(vt/2),
    graph.b+3,
    vw,
    vt,
    bgColor
  );
 

  C.Text(
    x_text, fColor, x+2, graph.b+5, "10px Arial", "center"
  );

  if(graph.config.opacity)
    C.Ctx().globalAlpha = graph.config.opacity;

  if(clip)
    C.clip = clip;

};



/**
 * Render a price marker for the specified graph at the specified price
 * @method RenderPriceMark
 * @param {TwentyC.widget.Chart.widget.Graph} graph instance
 * @param {Number} price
 * @param {String} label, if omited graph.FormatTickValue(price) will be used
 * @param {String} bgColor background color
 * @param {String} fColor font color
 */

Chart.prototype.RenderPriceMark = function(graph, price, label, bgColor, fColor){
    
  if(!bgColor)
    var bgColor = graph.config.colors.mark_bgc;
  if(!fColor)
    var fColor = graph.config.colors.mark_fc;
  var C = this.canvasDict.plot;
  var w = 10;
  var h = 14;
  var x = this.layout.chart.r-(w/2);
  var y = this.ValueToY(graph,price)-(h/2);

  var clip = C.clip;
  C.clip = null;

  if(graph.config.opacity)
    C.Ctx().globalAlpha =1;

  C.Triangle(
    x, y, w, h, bgColor, "l"
  );

  C.Rect(
    x+w, y, this.config.width - this.layout.chart.r + (w/2), h,
    bgColor
  );

  C.Text(
    label ||
    graph.FormatTickValue(price),
    fColor,
    x+w,
    y,
    "10px Arial",
    "left"
  );

  if(graph.config.opacity)
    C.Ctx().globalAlpha = graph.config.opacity;

  if(clip)
    C.clip = clip;

};

TwentyC.util.Find = function(arr, n, closest, key, keyFn) {

  if(!arr||!arr.length)
    return -1;

  var end = arr.length-1;
  var start = 0, middle, i;
 
  while(start <= end) {
    middle = Math.floor((start+end)/2);
    if(!keyFn)
      i = key ? arr[middle][key] : arr[middle];
    else {
      i = keyFn(arr[middle]);
    }
    if(i > n)
      end = middle -1;
    else if(i < n)
      start = middle +1;
    else
      return middle
  }
  return closest ? start-1 : -1;

}

/**
 * Translate a plot value on the x axis to a pixel value
 * @method ValueToX
 * @param {Graph} graph graph object
 * @param {Number} n plot value to be translated
 * @param {Number} align can be 0, 1 or 2, 0 will return left alignment, 1 will return right, 2 will return center, 3 will return center with barW in mind
 * @returns {Number} translated pixel value
 */


Chart.prototype.ValueToX = function(graph, n, right) {

  if(!graph || !graph.custom_x_axis) {
    var f= (this.plotPointW/1);
    var L = this.layout.chartInner;
    var j,l,m;
    var x = TwentyC.util.Find(this.source, n, true, "time") * f;
    var s = this.start * f;

    x -= s;
    x += L.x;
 
    if(!right)
      return x;
    else if(right == 1)
      return x + this.plotPointW;
    else if(right == 2)
      return x +((this.plotPointW / 2));
    else if(right == 3)
      return x +((this.plotPointW / 2)-(this.barW / 2));

  } else if(graph.custom_x_axis.absolute) {

    var diff = graph.maxX - graph.minX;
    var b = graph.maxX - n;
    var a = diff - b;
    return graph.x + (a * graph.plotPointW);

  } else {

    var f= (graph.plotPointW/1);
    var j,l,m;
    var x = TwentyC.util.Find(
      graph.data, 
      n, 
      true, 
      null,
      function(data) {
        return data.plots[graph.custom_x_axis.plot][graph.custom_x_axis.field];
      }
    ) * f;
    var s = graph.start * f;

    x -= s;
    x += graph.x;
 
    if(!right)
      return x;
    else if(right == 1)
      return x + graph.plotPointW;
    else if(right == 2)
      return x +((graph.plotPointW / 2));
    else if(right == 3)
      return x +((graph.plotPointW / 2)-(graph.barW / 2));

  }
  
};

/**
 * Translate a pixel calue on the x axis to a plot value
 * @method XToValue
 * @param {Graph} graph graph object
 * @param {Number} n pixel value on the x axis, relative to chart boundary
 * @param {Number) [b] 
 * @returns {Number} translated plot value
 */

Chart.prototype.XToValue = function(graph, n, b, dbg) {
  if(!graph || !graph.custom_x_axis) {
    n -= (n % this.plotPointW);
    var p = Math.round(n / this.plotPointW);
    if(this.index > this.plotPointsX)
      var x =this.index-(this.plotPointsX-p);
    else
      var x = p;

    if(x > this.source.length-1)
      x = this.source.length-1;

    if(b && x > 0)
      x--;
 
    if(!this.source[x]) {
      return 0;
    }
    return this.source[x].time;
  } else if(graph.custom_x_axis.absolute) {
    
    var k = n / graph.plotPointW;
    var diffX = graph.maxX - graph.minX;
    return Math.round(graph.minX + (k * (diffX / graph.plotPointsX)));
  } else {

    n -= (n % graph.plotPointW);
    var p = Math.round(n / graph.plotPointW);
    if(graph.end > graph.plotPointsX)
      var x = graph.end-(graph.plotPointsX-p);
    else
      var x = p;

    if(x > graph.data.length-1)
      x = graph.data.length-1;

    if(b && x > 0)
      x--;
 
    if(!graph.data[x]) {
      return 0;
    }
    return graph.data[x].plots[graph.custom_x_axis.plot][graph.custom_x_axis.field];
 
  }
};

/**
 * Translate a plot value on the y axis to a pixel value
 * @method ValueToY
 * @param {TwentyC.widget.Chart.widget.Graph} graph instance 
 * @param {Number} n plot value to be translated
 * @param {Boolean} bottom if true will return y+plot height (bottom)
 * @returns {Number} translated pixel value
 */

Chart.prototype.ValueToY = function(graph, n, bottom) {

  var p = graph.ticksPerGrid;
  var a = graph.maxY;
  var b = graph.minY;
  var k = (p * graph.yCount);
  var d = (graph.height / k);
  return (graph.y + ((((a-n)/graph.tick_size)-0)*d));
 
};

/**
 * Translate y coordinate to plot value
 * @method YToValue
 * @param {TwentyC.widget.Chart.widget.Graph} graph
 * @param {Number} y point on y axis to be translated (in pixels) relative to chart boundry
 * @returns {Number} translated plot value
 */

Chart.prototype.YToValue = function(graph, y, debug) {
  var grid = this.config.grid;
  var qr = TwentyC.util.qr;
  var y = qr(y);

  var a = graph.y;
  var b = graph.y+graph.height;
  var k = (grid.y_height / graph.ticksPerGrid);
  return graph.maxY - Math.round((y/k)*graph.tick_size);
};

/**
 * Render static data (eg. background, borders and grid)
 * @method RenderBase
 */

Chart.prototype.RenderBase = function() {

  var BG = this.canvasDict.bg, color = this.config.colors;;
  var i,n,r,p,j;
  var grid = this.config.grid;
  var L = this.layout;
  var R = this.config.chart_region;

  // render background

  BG.Rect(L.chart.x, L.chart.y, L.chart.w, L.chart.h, color.bgc_chart);

  // render border 
  
  BG.StrokeRect(L.chart.x, L.chart.y, L.chart.w, L.chart.h, 1, color.bdc_chart);

};

/**
 * Render drawing control button
 * @method RenderDrawingControl
 * @param {TwentChart.widget.DrawingTool} drawing 
 * @param {Object} coords coordinate object holding x and y coordinates (px)
 * @param {Function} onClick function call when button is clicked
 * @param {String} src image source for the button (without TwentyC.widget.Chart.pathImg)
 * @param {Number} w width (px)
 * @param {Number} h height (px)
 * @param {Object} data data to be passed to onClick (as third argument), optional. If set the drawing object will be referenced in it under the key "drawing"
 */

Chart.prototype.RenderDrawingControl = function(drawing, coords, onClick, src, w, h, data) {

  var C = this.canvasDict.plot;
  var colors = this.config.colors;

  if(data)
    data.drawing = drawing;
  else
    var data = drawing;
          
  this.EventZones.drawings.push({
    x : coords.x,
    y : coords.y,
    w : w,
    h : h,
    click : onClick,
    data : data
  });

  C.Rect(
    coords.x,
    coords.y,
    w,
    h,
    colors.bgc_chart
  );

  C.Image(
    TwentyC.widget.Chart.pathImg+"/"+src,
    coords.x,
    coords.y
  );
 
};

/**
 * Pickup a completed drawing for movement
 * @method PickupDrawing
 * @param {TwentyC.widget.Chart.widget.DrawingTool} drawing
 */

Chart.prototype.PickupDrawing = function(drawing) {
  
  // only proceed if there is no drawing in progress

  if(this.drawingTool && this.drawingTool.progress) {
    return;
  };

  this.oldDrawingTool = this.drawingTool;
  
  this.drawingTool = drawing;
  drawing.graph.RemoveDrawing(drawing);
  this.RenderDrawingProgress();
};

/**
 * Drop drawing that was picked up with PickupDrawing
 */

Chart.prototype.DropDrawing = function() {
  if(this.drawingTool && this.drawingTool.done) {
    this.drawingTool.graph.drawings.push(this.drawingTool);
    this.onDraw.fire(this.drawingTool);
    this.drawingTool = this.oldDrawingTool;
    this.oldDrawingTool = null;
    this.RenderDrawingProgress();
    this.RenderData();
  }
}

/**
 * Render drawing tool progress
 * @method RenderDrawingProgress
 */

Chart.prototype.RenderDrawingProgress = function() {
  var C = this.canvasDict.draw;
  C.Rect(0,0,this.config.width,this.config.height);

  if(this.drawingTool) {
    var tool = this.drawingTool;
    tool.Draw(C, tool.capture);
  };
}

/**
 * End current drawing process
 * @method EndDrawing
 */

Chart.prototype.EndDrawing = function(another) {
  var tool = this.drawingTool;
  this.drawingSelected = null;
  var C = this;
  if(tool) {
    this.drawingTool = null;
    if(tool.graph && tool.done && !tool.pickedUp) {
      tool.graph.drawings.push(tool);
    } else if(tool.done && tool.pickedUp) {
      tool.Drop();
    }
    this.RenderDrawingProgress();
    this.RenderMarkers();
    this.RenderData();
    this.onDraw.fire(tool);

    if(another) {
      this.drawingTool = new TwentyC.widget.Chart.drawingTools.dict[tool.id]().Init();
      this.drawingTool.onDone.subscribe(function() {
        C.EndDrawing(another);
      });
      this.RenderData();
    }
  };
};

/**
 * If chart is scrolled on time axis, snap it back to present (right most position)
 * @method SnapToPresent
 */

Chart.prototype.SnapToPresent = function() {
  if(this.index < this.sourceLength) {
    this.index = this.sourceLength;
    this.RenderData();
    this.RenderUI();
  }
};

/**
 * Render userinterface, buttons, scrollbar etc.
 * @method RenderUI
 */

Chart.prototype.RenderUI = function() {
  var chart = this; 
  var C = this.canvasDict.ui;
  var L = this.layout,i,graph,label,x,y;
  var p = TwentyC.widget.Chart.pathImg;
  var colors = this.config.colors;
  C.Rect(0,0,this.config.width, this.config.height);

  // render scrollbar

  var cfg = this.config.scrollbar;
  if(this.Scrollbar) {
    this.Scrollbar.Sync();
  }

  // reset event zones
  this.EventZones.ui = [];

  // if chart is scrolled show indicator
  if(this.index < this.sourceLength) {
    this.SetUIButton(
      L.chart.r-10,
      L.chart.y-6,
      15,
      14,
      p+"/scroll-indicator.png",
      function(x,y,graph,zone,chart) {
        chart.SnapToPresent();
      },
      graph
    ); 
    this.SetUIButton(
      L.chart.r-10,
      L.chart.b-6,
      15,
      14,
      p+"/scroll-indicator.png",
      function(x,y,graph,zone,chart) {
        chart.SnapToPresent();
      },
      graph
    ); 

  }

  if(!this.editMode)
    return;

  // render button to toggle edit mode off again
  this.SetUIButton(
    L.chart.r-20,
    L.chart.y+10,
    10,
    10,
    p+"/btn-close.png",
    function(x,y,graph,zone,chart) {
      chart.TglEditMode(false);
    },
    graph
  ); 

  C.Text(
    TwentyC.widget.Chart.locale.end_edit_mode,
    '#ff0000',
    L.chart.r-22,
    L.chart.y+8,
    'bold 10px Arial',
    'right'
  );


 

  // render graph buttons
  for(i in this.graphsOrder) {
    graph = this.graphsOrder[i];
    label = this.layout.graphLabel;
    x = label.x;
    if(!graph.overlay) {
      y = graph.y+label.y;
      if(graph.name != "main") {
        C.Line(graph.x, graph.y, graph.r, graph.y, 1, "#fff");
        C.Triangle(graph.x+5, graph.y+4, 10, 5, "#fff", "d");
        C.Triangle(graph.r-15, graph.y+4, 10, 5, "#fff", "d");
        C.Line(graph.x, graph.b-3, graph.r, graph.b-3, 1, "#fff");
        C.Triangle(graph.x+5, graph.b-11, 10, 5, "#fff", "u");
        C.Triangle(graph.r-15, graph.b-11, 10, 5, "#fff", "u");
      }
    } else {
      y = graph.par.y+label.y+((label.h+5)*(graph.ParentIndex()+1));
    }

    // background and graph title

    C.Rect(
      x, y, label.w, label.h, colors.bgc_graph_label
    );
    C.Text(
      graph.Title() || graph.name,
      colors.f_graph_label,
      x+5, y+2, "bold 10px Arial", "left"
    );

    y+=2
    
    // Close graph
    if(graph.name != "main") {
      this.SetUIButton(
        x+label.w-15,
        y,
        10,
        10,
        p+"/btn-close.png",
        function(x,y,graph,zone,chart) {
          chart.RemoveGraph(graph);
        },
        graph
      );
    }

    // prefs
    this.SetUIButton(
      x+label.w-30,
      y,
      10,
      10,
      p+"/btn_stick.png",
      function(x,y,graph,zone,chart) {
        chart.PrefsBuild(graph, graph.prefs, graph.Title(), true);
      },
      graph
    );

    // graph dnd pickup
    this.SetUIButton(
      x,
      y,
      label.w-30,
      label.h,
      null,
      function(x,y,graph,zone,chart) {
        chart.GraphDnDPickup(graph);
      },
      graph,
      "move"
    );

 
  }

  // render drag & drop indicators

  var I = this.graphDnD, ins = TwentyC.util.Inside;
  var L = this.layout.chart, colors = this.config.colors;
  var color;

  if(I) {
    
    var x = this.mouseX, y = this.mouseY, target=-1;
    
    // top of chart indicator

    if(ins(x,y,{ x : L.x, y : L.y, w : L.w, h : 20}))  {
      color = colors.dnd_highlight;
      target = 0;
    } else {
      color = colors.dnd_normal;
    }
    C.Line(L.x+1, L.y, L.r-1, L.y, 1,color);
    C.Triangle(L.x+5, L.y+2, 10, 5, color, "u");
    C.Triangle(L.r-15, L.y+2, 10, 5, color, "u");

    // bottom of chart indicator
    
    if(ins(x,y,{ x : L.x, y : L.b-20, w : L.w, h : 20}))  {
      target = null;
      color = colors.dnd_highlight;
    } else {
      color = colors.dnd_normal;
    }
    C.Line(L.x+1, L.b, L.r-1, L.b-2, 1,color);
    C.Triangle(L.x+5, L.b-8, 10, 5, color, "d");
    C.Triangle(L.r-15, L.b-8, 10, 5, color, "d");

    // between graphs indicator
    
    var n = 0;

    for(i in this.graphsOrder) {
      graph = this.graphsOrder[i];
      if(graph.overlay) 
        continue;

      n++;
      if(n >= this.stackedGraphs)
        continue;

      if(ins(x,y,{x:L.x, y:graph.b-10, w:L.w, h:20})) {
        color = colors.dnd_highlight;
        target = n;
      } else {
        color = colors.dnd_normal;
      }
      
      C.Triangle(L.x+5, graph.b+2, 10, 5, color, "u");
      C.Triangle(L.r-15, graph.b+2, 10, 5, color, "u");
      C.Line(L.x+1, graph.b, L.r-1, graph.b, 1,color);
      C.Triangle(L.x+5, graph.b-7, 10, 5, color, "d");
      C.Triangle(L.r-15, graph.b-7, 10, 5, color, "d");

    }

    // if no target was found, indicate drag and drop
    // target on graph

    if(target == -1) {
      
      for(i in this.graphsOrder) {
        graph = this.graphsOrder[i];
        if(ins(x,y,{x:L.x, y:graph.y, h:graph.height, w:L.w})) {
          target = graph;
          color = "#ccc";
          var text = "Add as overlay to this graph";
          C.Rect(
            L.x+10,
            graph.y + 10,
            L.w-20,
            graph.height - 20,
            "rgba(0,0,0,0.5)"
          );

          C.Text(
            text,
            color,
            L.x + (L.w / 2),
            graph.y + (graph.height / 2),
            "bold 12px Arial",
            "center"
          );

          C.Triangle(
            L.x + (L.w / 2) - 15,
            graph.y + (graph.height / 2) - 25,
            30,
            12,
            color,
            "u"
          );

          C.Rect(
            L.x + (L.w / 2) - 8,
            graph.y + (graph.height / 2) - 14,
            16,
            10,
            color
          );
          break;
        }
      }

    }

    I.target = target;

  }

};

/**
 * Render an UI button and create a click zone for it
 * @method SetUIButton
 * @param {Number} x in pixels
 * @param {Number} y in pixels
 * @param {Number} w width in pixels
 * @param {Number} h height in pixels
 * @param {String} src image source to use
 * @param {Function} callback callback for click event
 * @param {Mixed} data data to pass to the callback function
 * @param {String} [cursor="pointer"] css cursor to use
 */

Chart.prototype.SetUIButton = function(x, y, w, h, src, callback, data, cursor) {
  
  this.EventZones.ui.push({
    x : x,
    y : y,
    w : w,
    h : h,
    r : w+x,
    b : h+y,
    click : callback,
    cursor : cursor || "pointer",
    data : data
  });

  if(!src)
    return;

  var C = this.canvasDict.ui;

  C.Image(
    src, x, y 
  );
};

/**
 * Toggle erasor tool. Will cancel drawing mode
 * @method TglEraser
 */

Chart.prototype.TglEraser = function() {
  if(!this.eraserTool)
    this.eraserTool = true;
  else
    this.eraserTool = false;
  this.drawingTool = null;
  this.RenderData();
};

/**
 * Toggle edit mode on or off. When in edit mode indicators can be 
 * moved and configured.
 * @method TglEditMode
 * @param {Boolean} b on or off
 */

Chart.prototype.TglEditMode = function(b) {
  this.editMode = b;
  this.onEditMode.fire(b);
  this.RenderData();
  this.RenderUI();
  this.ToolbarUpdateHotkeys();
};

/**
 * Add a new hotkey to the toolbar
 * @method ToolbarAddHotkey
 * @param {String} id hotkey id
 */

Chart.prototype.ToolbarAddHotkey = function(id) {
  
  if(this.config.toolbar.disabled)
    return;

  if(this.hotkeys[id])
    return;

  var element = this.elements.toolbar_hotkeys;

  var hotkey = TwentyC.widget.Chart.hotkeys.dict[id];

  if(!hotkey)
    throw("Tried to assign unknown hotkey to slot: "+id);

  var button = new TwentyC.widget.Chart.widget.Hotkey(this, hotkey);
  element.insertBefore(button.element, this.elements.toolbar_blank_hotkey);

  this.hotkeys[id] = button;

  this.ToolbarUpdateHotkeys();

  if(TwentyC.util.InArray(id, this.config.hotkeys) == -1)
    this.config.hotkeys.push(id);

  this.onAddHotkey.fire({ chart : this, hotkey : id });

  return element;

};

/**
 * Remove hotkey from the toolbar
 * @method ToolbarRemoveHotkey
 * @param {String} id hotkey id
 */

Chart.prototype.ToolbarRemoveHotkey = function(id) {
  if(!this.hotkeys[id])
    return;

  this.elements.toolbar_hotkeys.removeChild(this.hotkeys[id].element);

  var idx = TwentyC.util.InArray(id, this.config.hotkeys);
  if(idx > -1)
    this.config.hotkeys.splice(idx, 1);

  delete this.hotkeys[id];

  this.onRemoveHotkey.fire({ chart : this, hotkey : id });
};

/**
 * Update the state of all hotkeys in the toolbar
 * @method ToolbarUpdateHotkeys
 */

Chart.prototype.ToolbarUpdateHotkeys = function() { 
  var i;
  for(i in this.hotkeys) {
    this.hotkeys[i].UpdateState();
  }
}

/**
 * Build preference form from template object
 * @method PrefsBuild
 * @param {Object} obj instance of target object (for example a Graph instance)
 * @param {Object} template
 * @param {String} title
 * @param {Boolean} open if true prefs pane will be opened after building is done
 */

Chart.prototype.PrefsBuild = function(obj, template, title, open) {
  var chart = this;
  var e = this.elements.prefs;
  if(!e)
    return;

  this.prefs = [];
  var lst,i,r,v,data,input,label,row;
  
  // clear prefs pane
  e.innerHTML = "<h1>"+title+"</h1>";

  this.PrefsBuildElements(obj, e, template);
  
  // create button
  var btn = document.createElement("input");
  btn.setAttribute("type", "button");
  btn.value = "OK";
  btn.className = "twentychart-prefs-btn";
  e.appendChild(btn);

  Y.util.Event.addListener(
    btn, "click", function(e, chart) {
      chart.PrefsSubmit(obj);
    }, this
  );

  if(open)
    this.PrefsOpen();
};

Chart.prototype.PrefsBuildElements = function(obj, node, template, title, collapsed) {
  var i,v,k,input,chart = this;
  var fnSubmit = function(e) {
   var kc = Y.util.Event.getCharCode(e);
   if(kc == 13)
     chart.PrefsSubmit(obj);
  }; 

  var e = document.createElement('div');
  e.className = "twentychart-prefs-section";

  if(title) {
    var titleNode = document.createElement("h2");
    titleNode.innerHTML = title+ " <span>Click to Open</span>";
   
    Y.util.Event.addListener(titleNode, "click", function() {
      if(e.style.height != "auto") {
        e.style.height = "auto";
        titleNode.innerHTML = title;
      } else {
        e.style.height = "35px";
        titleNode.innerHTML = title+ " <span>Click to Open</span>";
      }
    });

    e.appendChild(titleNode);
    e.style.height = "35px";
  }

  // build form elements and labels
  
  for(i in template) {
    
    v = template[i];

    // check if sub section
    if(!v.type) {
      if(!v._sectionSelect)
        this.PrefsBuildElements(obj, node, v, v.title);
      else {
        
        // build collapsable sections
        for(k in v) {

          if(typeof v[k]!= "object")
            continue;

          this.PrefsBuildElements(k, node, v[k], v[k].title||k);

        }
      }
      continue;
    }

    // build form element according to type
    switch(v.type) {
      case "color":
        input = document.createElement("input");
        input.setAttribute("type", "text");
        input.className = "twentychart-fld twentychart-color-fld";
        Y.util.Event.addListener(
          input, "keydown", fnSubmit
        );
        // set value
        input.value = v.get(obj);
      break;

      case "text":
        input = document.createElement("input");
        input.setAttribute("type", "text");
        input.className = "twentychart-fld";
        Y.util.Event.addListener(
          input, "keydown", fnSubmit
        );
        // set value
        input.value = v.get(obj);
      break;

      case "checkbox":
        input = document.createElement("input");
        input.setAttribute("type", "checkbox");
        input.checked = v.get(obj);
      break;


      case "list":
        input = document.createElement("select");
        lst = [];
        if(typeof v.items == "function")
          data = v.items(obj);
        else
          data = v.items;
        for(r in data) {
          lst.push('<option '+(data[r][1]==v.get(obj)?"selected":"")+' value="'+data[r][1]+'">'+data[r][0]+'</option>');
        }
        input.innerHTML = lst.join(" ");
      break;
    };

    input.tcSet = [v.set, obj, v.onSet, v.type];
    this.prefs.push(input);
    
    // create new row
    row = document.createElement("div");
    row.className = "twentychart-prefs-row";
    

    row.innerHTML = "<span>"+v.label+"</span>";

    // append input to row
    if(v.type == "checkbox") {
      row.childNodes[0].className = "checkbox-label"
      row.insertBefore(input, row.childNodes[0]);
    } else 
      row.appendChild(input);

    // append row to pane
    e.appendChild(row);
    
    this.onPrefsCreateInput.fire({
      name : v.title,
      type : v.type,
      input : input
    });

  }

  node.appendChild(e);


}

/**
 * Submit the elements stored in this.prefs
 * @method PrefsSubmit
 * @param {Object} obj preferences will be submitted to this object (for example a Graph instance)
 */

Chart.prototype.PrefsSubmit = function(obj, callback) {
  var i,k;
  for(i in this.prefs) {
    if(!obj)
      continue;
    k = this.prefs[i];
    if(k.tcSet[3] == "checkbox")
      k.tcSet[0](k.tcSet[1], k.checked);
    else
      k.tcSet[0](k.tcSet[1], k.value);
    if(k.tcSet[2])
      k.tcSet[2](k.tcSet[1]);
  }
  this.onPrefsSubmit.fire(obj);
  this.PrefsClose();
  this.RenderData();
}

/**
 * Open the prefs pane
 * @method PrefsOpen
 */

Chart.prototype.PrefsOpen = function() {
  var e = this.elements.prefs;
  if(!e)
    return;

  e.style.left = "0px";
  e.style.overflow = "auto";
};

/**
 * Close the prefs pane
 * @method PrefsClose
 */

Chart.prototype.PrefsClose = function() {
  var e = this.elements.prefs;
  if(!e)
    return;

  e.style.overflow = "hidden";
  e.style.left = (-(e.offsetWidth+10))+"px";
}; 

/**
 * Picks up an indicator graph and places it at the mouse pointer for
 * drag and drop
 * @method GraphDnDPickup
 * @param {TwentyC.widget.Chart.widget.Graph} graph graph instance
 */

Chart.prototype.GraphDnDPickup = function(graph) {

  // check if another graph is currently picked up
  // for drag and drop, if there is bail

  if(this.graphDnD)
    return;

  // set up drag and drop info

  var I = this.graphDnD = {
    graph : graph
  };

  // toggle text selection off
  
  TwentyC.util.ToggleGlobalSelect(0);  

  // create drag and drop element

  var node = document.createElement('div');
  node.className = "twentychart-dnd-icon";
  node.innerHTML = graph.Title();
  node.style.left = (this.mouseX+5)+"px";
  node.style.top = (this.mouseY+5)+"px";

  this.element.appendChild(node);
  I.icon = node;
  this.RenderUI();
};

/**
 * End graph DnD, if a location is set in this.graphDnD, graph will 
 * be moved to that location
 * @method GraphDnDDrop
 */

Chart.prototype.GraphDnDDrop = function() {
  
  // get drag and drop info
  var I = this.graphDnD;

  if(I && I.target != -1 && typeof I.target != "undefined") {
    this.element.removeChild(I.icon);
    this.MoveGraph(I.graph, I.target);
  };

  TwentyC.util.ToggleGlobalSelect(1);  
  this.graphDnD = null;
  this.RenderUI();
};

/**
 * Sticky graph drag and drop icon to mouse position
 * @method GraphDnDDrag
 */

Chart.prototype.GraphDnDDrag = function() {
  
  // get drag and drop info
  var I = this.graphDnD;

  if(I) {
    var node = I.icon;

    node.style.left = (this.mouseX+5)+"px";
    node.style.top = (this.mouseY+5)+"px";
    this.RenderUI();
  }


};

/******************************************************************************
 * Scrollbar widget that allows for targeted scrolling within the chart timeline
 * @class Scrollbar
 * @namespace TwentyC.widget.Chart.widget
 * @constructor
 */

var Scrollbar = TwentyC.widget.Chart.widget.Scrollbar = function() {};

/**
 * Initialize scrollbar with config object
 * @method InitScrollbar
 * @param {Object} config config object with key value config variables
 */

Scrollbar.prototype.Init =
Scrollbar.prototype.InitScrollbar = function(config) {
  this.config = {

    /**
     * Slider size
     * @config slider_width
     * @type {Number}
     */

    slider_width : 15,

    /**
     * Amount of ticks to scroll when Scroll() is called
     * @config ticks
     * @type {Number}
     */

    ticks : 2,

    /**
     * Speed of the Scroll() interval while one of the scroll buttons
     * is being pressed (in ms)
     * @config speed
     * @type {Number}
     */

    speed : 50,
    
    /**
     * Color config, all color values need to be html valid color strings
     * eg. "red" "#fff" or "rgba(1,2,3,1)"
     * @config colors
     * @type {Object}
     */

    colors : {
      
      /**
       * @config colors.button
       */

      button : "#999",

      /**
       * @config colors.bar
       */

      bar : "#333"
    }

  };

  TwentyC.util.UpdateObject(this.config, config);

  // create event function, look at SetEvents() for
  // event listener creation
  var sb = this, ins = TwentyC.util.Inside;

  // mouse down event
  this.evClick = function(e, d) {
    var l = sb.layout;
    var x = d[0].x;
    var y = d[0].y;
    var rv = true;

    if(ins(x,y,l.button_dec)) {
      // button (left, up) clicked
      rv = false;
      sb.TglScroll("l");
    } else if(ins(x,y,l.button_inc)) {
      // button (right, down) clicked
      rv = false;
      sb.TglScroll("r");
    } else if(ins(x,y,l.button_drag)) {
      // button (slider) clicked
      rv = false;
      sb.TglScroll("d",x,y);
    }
    return rv;
  };

  // mouse up event
  this.evRelease = function(e) {
    sb.TglScroll(0);
    return true;
  };

  // mouse move
  this.evDrag = function(e, d) {
    var x = d[0].x;
    var y = d[0].y;
    if(sb.scrollDrag) {
      
      var diff = sb.scrollDrag.x - x;
      var p = diff / sb.pixelsPerTick;
      
      if(Math.abs(p) >= 1) {
        sb.scrollDrag.x = x;
        sb.scrollDrag.y = y;
        sb.Scroll(-Math.round(p));
      }
      return false;
    }
    return true;
  };
};

/**
 * Toggle scrolling on or off according to scroll type. Scrolling directional,
 * .eg left or right will scroll in the specified direction at a set interval
 * until TglScroll(0) is called. Drag scrolling will scroll according to
 * mouse movement until TglScroll(0) is called.
 * @method TglScroll
 * @param {String} type can be "l" for left, "r" for right or "d" for drag
 * @param {Number} x only relevant when type == "d", should be the location of the mousepointer when TglScroll() is called
 * @param {Number} y only relevant when type == "d", should be the location of the mousepointer when TglScroll() is called
 */

Scrollbar.prototype.TglScroll = function(type, x, y) {
  
  var c = this.config;

  if(!type) {
    // toggle all scrolling off
    if(this.scrollInterval) {
      this.scrollInterval = clearInterval(this.scrollInterval);
      this.scrollInterval = null;
    }
    this.scrollDrag = null;
  }
  var dir;
  if(type == "l")
    dir = -c.ticks 
  else if(type == "r")
    dir = c.ticks;
  else if(type == "d") {
    this.scrollDrag = {
      x : x, 
      y : y
    }
  }

  if(dir) {
    // direction was specified, start interval that calls Scroll()
    // accordingly
    var sb = this;
    this.scrollInterval = setInterval(function() {
      sb.Scroll(dir);   
    }, c.speed);
  }
};

/**
 * Scroll n ticks
 * @method Scroll
 * @param {Number} n amount of steps to scroll, can be negative
 */

Scrollbar.prototype.Scroll = function(n) {
  if(this.chart && this.chart.source) {
    this.chart.index += n;
    if(this.chart.index < 0)
      this.chart.index = 0;
    else if(this.chart.index > this.chart.source.length)
      this.chart.index = this.chart.source.length;

    this.chart.RenderData();
  }
};

/**
 * Calculate proportions and positions and store them in
 * this.layout
 * @method SetLayout
 * @param {Number} x 
 * @param {Number} y
 * @param {Number} w width
 * @param {Number} h height
 */

Scrollbar.prototype.SetLayout = function(x,y,w,h) {
  var l = this.layout = {
    bar : {},
    button_dec : {},
    button_inc : {}
  }

  // background bar
  l.bar.x = x+h;
  l.bar.y = y;
  l.bar.w = w-(h*2);
  l.bar.r = l.bar.x+l.bar.w;
  l.bar.b = y+h;
  l.bar.h = h;

  //button: decrease (left, up)
  l.button_dec.x = x;
  l.button_dec.y = y;
  l.button_dec.h = h;
  l.button_dec.w = h*0.75;
  l.button_dec.r = x+l.button_dec.w;
  l.button_dec.b = y+l.button_dec.h;

  //button: increase (down, right)
  l.button_inc.w = h*0.75;
  l.button_inc.h = h;
  l.button_inc.y = y;
  l.button_inc.x = x+w-l.button_inc.w;
  l.button_inc.r = x+w;
  l.button_inc.b = y+l.button_inc.h;

};

/**
 * Link the scrollbar to a chart
 * @method SetChart
 * @param {TwentyC.widget.Chart.widget.Chart} chart chart instance
 */

Scrollbar.prototype.SetChart = function(chart) {
  this.chart = chart;

  chart.onMouseDown.subscribe(this.evClick);
  chart.onMouseUp.subscribe(this.evRelease);
  chart.onMouseMove.subscribe(this.evDrag);
};

/**
 * Draw scrollbar at the specified coordinates
 * @method Render
 */

Scrollbar.prototype.Render = function() {

  var canvas = this.chart.canvasDict.ui;
  var col = this.config.colors;
  var l  = this.layout;
  if(!l)
    return;

  // bar bg
  canvas.Rect(
    l.bar.x, l.bar.y, l.bar.w, l.bar.h, col.bar
  );
  
  // button scroll left
  canvas.Triangle(
    l.button_dec.x, 
    l.button_dec.y,
    l.button_dec.w, 
    l.button_dec.h, 
    col.button, 
    "l"
  );

  // button scroll right
  canvas.Triangle(
    l.button_inc.x,
    l.button_inc.y,
    l.button_inc.w,
    l.button_inc.h,
    col.button, 
    "r"
  );

  // button drag
  if(l.button_drag) {
    canvas.Rect(
      l.button_drag.x,
      l.button_drag.y,
      l.button_drag.w,
      l.button_drag.h,
      col.button
    );
  }

};

/**
 * Sync scrollbar to chart
 * @method Sync
 */

Scrollbar.prototype.Sync = function() {
  if(!this.chart || !this.chart.source || !this.chart.config.scrollbar.enabled)
    return;

  var C = this.chart;
  var c = this.config,r,n,j,t,d,w,x,y,h,l=this.layout;

  this.min = C.plotPointsX;
  this.max = C.source.length;
  d = this.max - this.min;
  w = c.slider_width;

  // calculate drag button position
  r = (l.bar.w-w) / d;
  x = l.bar.x + ((C.index-this.min) * r);

  this.pixelsPerTick = r;

  l.button_drag = {
    w : w,
    h : l.bar.h,
    x : x,
    y : l.bar.y
  }

  this.Render();

};

/******************************************************************************
 * Chart context menu.
 * @class ChartContextMenu
 * @constructor
 * @namespace TwentyC.widget.Chart.widget
 */

var ChartContextMenu = TwentyC.widget.Chart.widget.ChartContextMenu = function(chart) {
  this.menu = new Y.widget.ContextMenu(chart.id+"-context-menu", {
    zindex : 50000,
    trigger : chart.element,
    constraintoviewport : false
  });
  this.chart = chart;
  this.SetItems();

  
  var CM = this;

  this.menu.triggerContextMenuEvent.subscribe(function(a,b,c) {
    var graph = chart.TouchedGraph(chart.mouseX, chart.mouseY)
    if(CM.editIndicatorMenu) {
      CM.editIndicatorMenu.SetItems(
        chart,
        false,
        function(e,ev,graph) {
          chart.PrefsBuild(graph, graph.prefs, graph.Title(), true);
        }
      )
    }
    if(CM.removeIndicatorMenu) {
      CM.removeIndicatorMenu.SetItems(
        chart,
        true,
        function(e,ev,graph) {
          chart.RemoveGraph(graph)
        }
      )
    }
  });

  this.menu.render(document.body);
}

/******************************************************************************
 */

ChartContextMenu.prototype.SetItems = function() {
  
  var chart = this.chart;

  this.menu.clearContent();
  
  this.indicatorMenu = new TwentyC.widget.Chart.widget.IndicatorMenu(this.chart)
  this.editIndicatorMenu = new TwentyC.widget.Chart.widget.ActiveGraphsMenu(this.chart);
  this.removeIndicatorMenu = new TwentyC.widget.Chart.widget.ActiveGraphsMenu(this.chart);
  this.drawingToolsMenu = new TwentyC.widget.Chart.widget.DrawingToolMenu(this.chart);

  this.menu.addItems([
    {
      text : TwentyC.widget.Chart.locale.edit_layout,
      onclick : {
        fn : function() {
          chart.TglEditMode(chart.editMode?0:1);
        }
      }
    },
    {
      text : "<hr />"
    },
    {
      text : TwentyC.widget.Chart.locale.indicators,
      submenu : this.indicatorMenu.menu
    },
    {
      text : TwentyC.widget.Chart.locale.edit_indicators,
      submenu : this.editIndicatorMenu.menu
    },
    {
      text : TwentyC.widget.Chart.locale.remove_indicators,
      submenu : this.removeIndicatorMenu.menu
    },
    {
      text : "<hr />"
    },
    {
      text : TwentyC.widget.Chart.locale.drawing_tools,
      submenu : this.drawingToolsMenu.menu
    }
  ]);

  var extend = TwentyC.widget.Chart.menu_items, i, item;
  if(extend.length) {
    for(i = 0; i < extend.length; i++) {
      item = extend[i];
      var a = { text : item.text };

      if(item.onclick) {
        a.onclick = {
          fn : item.onclick,
          obj : this.chart
        }
      }

      if(item.submenu) {
        a.submenu = item.submenu(this.chart);
      }

      this.menu.addItem(a);
    }
  }
}

/******************************************************************************
 */

var ActiveGraphsMenu = TwentyC.widget.Chart.widget.ActiveGraphsMenu = function(chart) {
  this.menu = new Y.widget.Menu((TwentyC.widget.Chart.refCnt++)+"-active-graphs-menu", {
    constraintoviewport : false
  });
  this.chart = chart;
  this.menu.render(document.body);
}

ActiveGraphsMenu.prototype.SetItems = function(chart, skipMain, fnClick) {
  this.menu.clearContent();
  var i;
  for(i in chart.graphs) {
    var graph = chart.graphs[i];
    if(graph.name != "main" || !skipMain) {
      this.menu.addItem({
        text : graph.Title(),
        onclick : {
          fn : fnClick,
          obj : graph
        }
      });
    }
  }

  this.menu.render();
}

/******************************************************************************
 * Indicator select menu
 * @class IndicatorMenu
 * @constructor
 * @namespace TwentyC.widget.Chart.widget
 */

var IndicatorMenu = TwentyC.widget.Chart.widget.IndicatorMenu = function(chart){
  this.menu = new Y.widget.Menu((TwentyC.widget.Chart.refCnt++)+"-indicator-menu", {
    zindex : 50000,
    constraintoviewport : false
  });
  this.chart = chart;
  this.SetItems();
  this.menu.render(document.body);
};

/******************************************************************************
 * Fill the indicator menu with items
 * @method SetItems
 */

IndicatorMenu.prototype.SetItems = function() {
  var i, I = TwentyC.widget.Chart.indicators.list;
  var chart = this.chart;

  this.menu.clearContent();

  // add indicators
  for(i in I) {
    var graph = new TwentyC.widget.Chart.indicators.dict[I[i]];
    this.menu.addItem({
      text : graph.Title(), 
      onclick : {
        fn : function(e,ev, id) {
          try {
            var graph = new TwentyC.widget.Chart.indicators.dict[id]();
          } catch(err) {
            log("Error when trying to init graph "+graph.Title);
            log(err.message)
            return;
          }
          try {
            graph.Init();
          } catch(err) {
            graph.HandleError(err);
            return;
          }
          chart.AddGraph(id+(chart.graphNum++), graph);
        }, 
        obj : I[i]
      }
    });
  }


}

/******************************************************************************
 * Drawing tool select menu
 * @class DrawingToolMenu
 * @constructor
 * @namespace TwentyC.widget.Chart.widget
 */

var DToolMenu = TwentyC.widget.Chart.widget.DrawingToolMenu = function(chart){
  this.menu = new Y.widget.Menu((TwentyC.widget.Chart.refCnt++)+"-drawingtool-menu", {
    zindex : 50000,
    constraintoviewport : false
  });
  this.chart = chart;
  this.SetItems();
  this.menu.render(document.body);
};

DToolMenu.prototype.SetItems = 
DToolMenu.prototype.SetItemsDToolMenu = function() {
  var i, I = TwentyC.widget.Chart.drawingTools.list;
  var chart = this.chart;
  
  this.menu.clearContent();

  this.menu.addItem({
    text : '<img src="'+TwentyC.widget.Chart.pathImg+'/ico-crosshair.png" class="twentychart-menu-icon" /> '+TwentyC.widget.Chart.locale.stop_drawing,
    onclick : {
      fn : function() { chart.EndDrawing(); }
    }
  });

  // add tools
  for(i in I) {
    var tool = TwentyC.widget.Chart.drawingTools.dict[I[i]];
    this.menu.addItem({
    
      text : '<img src="'+tool.prototype.icon()+'" class="twentychart-menu-icon" /> '+tool.prototype.name,
      onclick : {
        fn : function(e, ev, id) {
          var tool = new TwentyC.widget.Chart.drawingTools.dict[id]().Init();
          tool.onDone.subscribe(function() {
            chart.EndDrawing(true);
          });
          chart.drawingTool = tool;
          chart.RenderData();
        }, 
        obj : I[i]
      }
    })
  }
};
 
/******************************************************************************
 * Hotkey meny 
 * @class HotkeyMenu
 * @constructor
 * @namespace TwentyC.widget.Chart.widget
 */

var HotkeyMenu = TwentyC.widget.Chart.widget.HotkeyMenu = function(chart, onclick){
  this.menu = new Y.widget.Menu((TwentyC.widget.Chart.refCnt++)+"-hotkey-menu", {
    zindex : 50000,
    constraintoviewport : false
  });
  this.chart = chart;
  this.SetItems(onclick);
  this.menu.render(document.body);
};

HotkeyMenu.prototype.SetItems = 
HotkeyMenu.prototype.SetItemsHotkeyMenu = function(onclick) {
  var i, I = TwentyC.widget.Chart.hotkeys.list;
  var chart = this.chart;
  
  this.menu.clearContent();

  // add tools
  for(i in I) {
    var hotkey = TwentyC.widget.Chart.hotkeys.dict[I[i]];
    this.menu.addItem({
    
      text : '<img src="'+hotkey.icon()+'" class="twentychart-menu-icon" /> '+hotkey.name,
      onclick : {
        fn : onclick,
        obj : I[i]
      }
    })
  }
};
 
/******************************************************************************
 * Hotkey button widget.
 * @class Hotkey
 * @constructor
 * @namespace TwentyC.widget.Chart.widget
 * @param {Chart} chart chart that his hotkey belongs to
 * @param {Object} config object literal holding config attributes
 */

var Hotkey = TwentyC.widget.Chart.widget.Hotkey = function(chart, config) {
  if(config) 
    this.Init(chart, config);
}
  
/******************************************************************************
 * Initialize the hotkey element - This is done automatically by constructor
 * if constructor is called with config argument.
 * @method InitHotkey
 * @param {Chart} chart chart that his hotkey belongs to
 * @param {Object} config object literal holding config attributes
 */

Hotkey.prototype.Init =
Hotkey.prototype.InitHotkey = function(chart, config) {

  this.chart = chart;
  this.config = config;

  this.element = document.createElement("div");

  this.element.style.backgroundImage = [
    "url(",
    config.icon(),
    ")"
  ].join("");
  this.element.style.backgroundRepeat = "no-repeat";

  this.highlightHover = document.createElement("img");
  this.highlightSelect = document.createElement("img");

  Y.util.Dom.addClass(this.highlightHover, "toolbar-hotkey-hover");
  Y.util.Dom.addClass(this.highlightSelect, "toolbar-hotkey-selected");
  Y.util.Dom.addClass(this.element, "toolbar-hotkey");

  this.highlightHover.src = TwentyC.widget.Chart.pathImg+"/toolbar-highlight-overlay.png";
  this.highlightSelect.src = TwentyC.widget.Chart.pathImg+"/toolbar-selected-overlay.png";

  this.highlightHover.style.display = "none";
  this.highlightSelect.style.display = "none";

  this.element.appendChild(this.highlightSelect);
  this.element.appendChild(this.highlightHover);

  Y.util.Event.addListener(this.element, "mouseup", function(e, hotkey) {
    if(e.button == 2) {
      chart.ToolbarRemoveHotkey(hotkey.config.id);
      
      setTimeout(function(){chart.contextMenu.menu.hide()},0);

      return;
    }
    var obj = config.fn(hotkey.chart, hotkey);
    if(obj) {
      if(obj.addItems) {
        obj.cfg.setProperty("context", [hotkey.element, "tl", "bl"]);
        obj.show();
      }
    }
  }, this);

  Y.util.Event.addListener(this.element, "mouseover", function(e, hotkey) {
    hotkey.highlightHover.style.display = "block";
  }, this);

  Y.util.Event.addListener(this.element, "mouseout", function(e, hotkey) {
    hotkey.highlightHover.style.display = "none";
  }, this);

  this.element.title = config.name;

};

Hotkey.prototype.UpdateState = function() {
  var st = this.config.state;
  if(typeof st == "function") {
    var st = st(this.chart, this);
  }
  this.highlightSelect.style.display = (st ? "block" : "none");
}

})();
