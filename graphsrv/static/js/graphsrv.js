(function($, $tc) {

// namespace(s)
graphsrv = {
  "components" : new $tc.cls.Registry(),
  "formatters" : {},
  "instances" : {},
  "popovers" : new $tc.cls.Registry(),
  "util" : {}
}

/**
 * Describes a data window specified by start
 * and end points in a dataset
 *
 * @class DataViewport
 * @namespace graphsrv.util
 * @constructor
 * @param {Number} length - max length of data
 */

graphsrv.util.DataViewport = $tc.cls.define(
  "DataViewport",
  {
    "DataViewport" : function(length) {
      this.length = 0;
      this.offset = 0;

      this.set(length)
    },

    /**
     * Sets the length of the viewport
     * @method set
     * @param {Number} length
     */
    "set" : function(length) {
      this.length = (length == undefined ? -1 : length)
    },

    /**
     * Returns the start point (index) for the window
     * when applied to a dataset (first index)
     * @param {Array} data
     * @returns {Number} start
     */
    "get_start" : function(data) {
      if(this.length == -1)
        return 0;
      var s = Math.max(0, Math.max(0, data.length - this.length) + this.offset);
      return s;
    },

    /**
     * Returns the end point (index) for the window when
     * applied to a dataset (last index+1)
     *
     * @method get_end
     * @param {Array} data
     * @returns {Number} end
     */
    "get_end" : function(data) {
      if(this.length == -1)
        return data.length;
      return Math.min(data.length, this.get_start(data) + this.length);
    },

    /**
     * Returns the length of the window (number of items
     * contained in the window) when applied to a dataset
     *
     * @method get_length
     * @param {Array} data
     * @returns {Number} length
     */
    "get_length" : function(data) {
      if(this.length == -1)
        return (data ? data.length : 0)
      return Math.min(this.length, (data?data.length:0))
    },

    "bind_scroll" : function(bind_to, extra, property) {
      if(!property)
        property = "pageX";

      if(this.length < 0)
        return;

      var width = bind_to.width()

      var scroll_viewport = function(e) {
        var _extra = extra();
        if(this.scrolling.prev) {
          var diff = e[property] - this.scrolling.prev[property];
          if(!diff)
            return;
          diff = Math.round(diff / _extra.scroll_size);
          if(!diff)
            return;
          this.offset = Math.min(0,this.offset - diff);
          this.offset = Math.max(-(_extra.max_length - this.get_length(_extra.data)), this.offset);
          $(this).trigger("scroll");
        }
        this.scrolling.prev = e;
      }.bind(this);

      bind_to.on("mousedown", function(e) {
        this.scrolling = { "triggered" : new Date() };
        $(document.body).on("mousemove", scroll_viewport);
        e.preventDefault();
      }.bind(this));

      this.stop_scrolling = function() {
        if(this.scrolling) {
          this.scrolling = null;
          $(document.body).off("mousemove", scroll_viewport);
        }
      }.bind(this);

      $(document.body).on("mouseup", function(e) {
        this.stop_scrolling();
      }.bind(this));


    }
  }
);

/**
 * Popover base
 *
 * Popovers can be used to display data when clicking elements
 * inside a graph or a plugin
 *
 * All popovers should extend this class
 *
 * Uses the bootstrap4 popover
 *
 * @class Popover
 * @namespace graphsrv.popovers
 * @constructor
 * @param {jQuery} bind - element to bind
 *     popover to. This will be the element that will dictate the
 *     position of the popover. It is also the element that will
 *     trigger the popover when clicked.
 *
 *     See `bind_events` and `bind_popover` methods for details.
 */

graphsrv.popovers.register(
  "Popover",
  {
    "Popover" : function(bind) {
      if(bind.data("bs.popover"))
        throw("Can only bind one popover to an element")

      this.bind_events(bind);
      this.bind_popover(bind);
    },

    /**
     * Binds the mouse events required to open a popover
     * @method bind_events
     * @param {jQuery} bind - object
     *    to bind click event to. Clicking this element will
     *    open the popover
     */

    "bind_events" : function(bind) {
      this.trigger = bind;
      this.trigger.on("click", function(e) {
        this.show(e);
      }.bind(this))
    },

    /**
     * Binds the popover itself to an element, which will then
     * be used to position the popover.
     *
     * @method bind_popover
     * @param {jQuery} bind - object to bind popover to
     */

    "bind_popover" : function(bind) {
      this.bound_to = bind;
      this.bound_to.popover(this.options());
    },

    /**
     * Update the title of the popup
     *
     * @method title
     * @param {String|jQuery|HTML Element} content
     */

    "title" : function(content) {
      if(typeof content == "string")
        content = $("<span>").text(content);
      var tip = this.bound_to.data("bs.popover").tip
      if(tip)
        $(tip).find(".popover-header").empty().append(content)
    },

    /**
     * Update the body of the popover
     *
     * @method content
     * @param {jQuery|HTML Element} content
     */

    "content" : function(content) {
      var tip = this.bound_to.data("bs.popover").tip
      if(tip) {
        content
          .click(function() { this.hide(); }.bind(this))
          .css("cursor", "pointer");
        $(tip).find(".popover-body").empty().append(content)
      }
    },

    /**
     * Show the popover
     * @method show
     * @param {Event} e - mouse event
     */

    "show" : function(e) {
      this.bound_to.popover("show")
      this.update(e);
    },

    /**
     * Hide the popover
     * @method hide
     * @param {Event} e - jquery event object
     */

    "hide" : function(e) {
      this.bound_to.popover("hide")
    },

    /**
     * Check if the popover is currently shown
     * @method shown
     * @returns {Boolean} shown
     */

    "shown" : function() {
      if(!this.bound_to)
        return false;
      return $(this.bound_to.data("bs.popover").tip).is(":visible")
    },

    /**
     * Return bootstrap popover options to use for
     * instantiating the popover
     *
     * @method options
     * @returns {Object} options
     */

    "options" : function() {
      return {
        "title" : "Popover",
        "content" : "Popover Content",
        "html" : true,
        "trigger" : "manual",
        "placement" : "right",
        "container" : "body"
      }
    },

    /**
     * Update popup, called automatically during show() but
     * can also be used to update a currently open popover with
     * new content
     *
     * @method update
     * @param {Event} e - jquery event object
     */

    "update" : function(e) {
    }
  }
)

/**
 * Generic graph popover that can be used
 * with graphsrv.components.Graph
 *
 * @class GraphPopover
 * @namespace graphsrv.popovers
 * @extends graphsrv.popovers.Popover
 * @constructor
 * @param {jQuery} bind - bind the popover to this element
 * @param {Graph} graph
 */

graphsrv.popovers.register(
  "GraphPopover",
  {
    "GraphPopover" : function(bind, graph) {

      /**
       * Holds reference to the graph that this popover
       * belongs to
       * @property {Graph} graph
       */

      this.graph = graph;

      /**
       * When tried to index a popover to a data point we
       * will use the field described in this poperty
       *
       * It defaults to whatever the graph option for `data_x`
       * is
       * @property {String} index_field
       */
      this.index_field = graph.options.data_x;
      this.Popover(bind);

      $(graph).on("update_after_render", function() {
        if(this.shown() && this.value)
          this.update(null, this.value);
      }.bind(this));
    },

    /**
     * Return the popover index value from the specified
     * data object
     *
     * @method index
     * @param {Object} data
     * @returns {Mixed} popover index value
     */

    "index" : function(data) {
      return data[this.index_field];
    },

    "show" : function(e) {
      this.bind_popover();
      this.Popover_show(e);
    },

    "hide" : function(e) {
      this.Popover_hide(e);
      d3.select(this.bound_to.get(0))
        .remove()
      this.bound_to.off();
      this.bound_to = null;
    },

    /**
     * Take jQuery event object and calculate the index
     * in graph data from the mouse coordinates
     *
     * Returns an object literal with a `data` and `index`
     * key.
     *
     * `index` - holds the index in the dataset that corresponds to the mouse coordinates
     * `data` - holds the item in the dataset that corresponds to the mouse coordinates
     *
     * Note that if there are multiple datasets, data will always refer to the first
     * set. Use the value in `index` to obtain the item from the other datasets
     *
     * @method data_from_mouse_event
     * @param {jQuery Event} e
     * @returns {Object}
     */

    "data_from_mouse_event" : function(e) {
      var o = this.graph.options;
      var x = this.graph.scales.x;
      var index = d3.bisector(
        function(d) { return d[o.data_x] }
      ).left(this.graph.data[0], x.invert(e.offsetX))-1;
      return {"data":this.graph.data[0][index], "index":index};
    },


    /**
     * Take a value and find the index in graph data from it
     *
     * Returns an object literal with a `data` and `index`
     * key.
     *
     * `index` - holds the index in the dataset that corresponds to the value
     * `data` - holds the item in the dataset that corresponds to the value
     *
     * Note that if there are multiple datasets, data will always refer to the first
     * set. Use the value in `index` to obtain the item from the other datasets
     *
     * @method data_from_mouse_event
     * @param {Mixed} value
     * @returns {Object}
     */

    "data_from_value" : function(value) {
      var o = this.graph.options;
      var index = d3.bisector(
        function(d) { return this.index(d) }.bind(this)
      ).left(this.graph.data[0], value);
      if(!index)
        return null;
      return {"data":this.graph.data[0][index], "index":index};
    },

    /**
     * Update the popover body
     *
     * @method content
     * @param {Object} data - data entry (a single data point in the first dataset)
     * @param {Number} index - index of data entry in dataset
     */

    "content" : function(data, index) {
      var o = this.graph.options,i,target_config,_data;
      var content = $("<div>");
      for(i = 0; i < this.graph.data.length; i++) {
        _data = this.graph.data[i][index];
        target_config = this.graph.target_config(_data);
        content.append(
          $("<div>").text(
            target_config.name+": "+
            this.graph.formatter("y")(_data[o.data_y])
          )
        );
      }
      $(this).trigger("content-prepare", [content, data])
      this.Popover_content(content)
    },

    /**
     * Update the popover title
     *
     * @method title
     * @param {Object} data - data entry (a single data point in the first dataset)
     * @param {Number} index - index of data entry in dataset
     */

    "title" : function(data, index) {
      var o = this.graph.options;
      var t = new Date();
      t.setTime(data.time);
      var content = $("<span>").text(t);
      $(this).trigger("title-prepare", [content, data])
      this.Popover_title(content)
    },

    /**
     * Update the popover
     *
     * This will update title and content as well the popover indicator position
     *
     * @method update
     * @param {jQuery Event} e - if set retrieve popover data from mouse coordinates
     * @param {Mixed} value - if set (and `e` is not set) retrieve popover data from
     *    index value
     */

    "update" : function(e, value) {
      var data;
      if(e) {
        data = this.data_from_mouse_event(e);
        this.value = this.index(data.data);
      } else if(value) {
        data = this.data_from_value(value);
      } else {
        return;
      }

      if(!data)
        return this.hide();

      this.indicator(data.data, data.index);
      this.title(data.data, data.index);
      this.content(data.data, data.index);

    },

    "bind_popover" : function(bind) {
      if(this.bound_to)
        return;
      this.bound_to = $(
        this.graph.d3.container.append("rect")
          .attr("class","popover-indicator")
          .node()
      )
      this.bound_to.popover(this.options())
    },

    /**
     * Update the popover indicator position according
     * to the data entry and data index
     *
     * @method indicator
     * @param {Object} data - data entry (a single data point in the first dataset)
     * @param {Number} index - index of data entry in dataset
     */

    "indicator" : function(data, index) {
      var x = this.graph.scales.x,
          y = this.graph.scales.y,
          o = this.graph.options;

      var barwidth = this.graph.inner_width() / this.graph.data[0].length

      d3.select(this.bound_to.get(0))
        .attr("x", x(data[o.data_x]) - (barwidth*0.5))
        .attr("y", 0)
        .attr("width", barwidth)
        .attr("height", this.graph.inner_height())
        .style("fill", "#fff")
        .style("opacity", 0.25);

      this.bound_to.popover("update")

    }
  },
  "Popover"
)

graphsrv.util.count_values = function(arr) {
  var r  = [], index = {}, i, value;
  for(i = 0; i < arr.length; i++) {
    value = arr[i];
    if(index[value] == undefined) {
      index[value] = r.length;
      r.push({ "value" : value, "count" : 1, "total" : arr.length })
    } else {
      r[index[value]].count++;
    }
  }
  return r;
}

/**
 * Holds axis label formatter functions
 * to be passed to d3 tickFormat
 *
 * @class formatters
 * @namespace graphsrv
 */

/**
 * Latency milliseconds formatter
 * @method ms
 * @param {Float} value
 * @returns {String}
 */

graphsrv.formatters.ms = function(value) {
  return d3.format(".2f")(value)+"ms";
}

/**
 * Data update manager
 * Allows you to request data from the server
 * incrementally
 *
 * @class update
 * @namespace graphsrv
 */

graphsrv.update = {

  /**
   * data will be requests from this address
   * @property host
   * @type String
   * @default http://0.0.0.0
   */
  "host" : "http://0.0.0.0",

  /**
   * tracks data requests and retrieve data
   * @property index
   * @type Array
   * @private
   */
  "index" : [],

  "claimed_targets" : {},

  /**
   * check if there is already a data request
   * active for the specified urls and parameters
   *
   * @method has
   * @param {String} url - url path without host
   * @param {Object} params - post params
   * @param {Number} interval - request interval in ms
   * @returns {Number} -1 if non existant otherwise the index of
   *    the request in this.index
   */
  "has" : function(url, params, interval) {
    var i, k, update;
    for(i=0; i < this.index.length; i++) {
      update = this.index[i];
      if(update.interval > interval)
        continue;
      if(update.url != url)
        continue;
      if(JSON.stringify(update.params) !== JSON.stringify(params))
        continue;
      return i;
    }
    return -1;
  },

  /**
   * request data at the specified interval
   *
   * @method require
   * @param {String} url - url path without host
   * @param {Object} params - post params
   * @param {Number} interval - request interval in ms
   * @returns {Object} update handler
   */

  "require" : function(url, params, interval) {

    // check if we already satisfy this request requirement
    // elsewhere
    var index = this.has(url, params, interval)
    var host = this.host;

    if(index == -1) {

      // request requirement not satisfied, add new update
      // handler
      var update = {
        "url" : url,
        "params" : params,
        "refcount" : 1,
        "data" : [],
        // FIXME: should come from some config
        "max_length" : 500,
        "interval" : interval,
        // FIXME: should come from some config
        "incremental" : function(d) { return d.time/1000 },
        "request" : function() {
          $.ajax(
            {
              "url": host + url,
              "method": "POST",
              "data": this.params,
              "success" : function(data) {
                data = JSON.parse(data);
                if(!data.data.length)
                  return;

                // FIXME should come from config
                this.params.ts = d3.max(data.data, function(d) {
                  return d3.max(d, function(_d) {
                    return this.incremental(_d)
                  }.bind(this))
                }.bind(this))

                if(this.data && this.data.length) {
                  // there already exists some data, so append the
                  // new data to the old set
                  var i;
                  for(i = 0; i < this.data.length; i++) {
                    this.data[i] = this.data[i].concat(data.data[i])

                 }
                } else {
                  // first data set, simply reference
                  this.data = data.data;
                }
                for(i = 0; i < this.data.length; i++) {
                  // maintain data limit
                  while(this.data[i].length > this.max_length)
                    this.data[i].shift()
                }

                $(this).trigger("update", [this.data]);


              }.bind(this)
            }
          ).fail(function() {
            $(this).trigger("data_feed_stopped")
          }.bind(this))
        }
      }

      // initial request for data
      update.request();

      // request new data at an interval
      update.timer = setInterval(function() { update.request(); },  interval)

      this.index.push(update);
      index = this.index.length-1;
    } else {
      // update handler for data requirement already exists,
      // use it and up the refcount
      this.index[index].refcount++;
    }

    return this.index[index];

  }

}

graphsrv.components.counter = 0;

/**
 * Base graphsrv component.
 *
 * @class Base
 * @namespace graphsrv.components
 * @param {String} [container_selector="<div>"] - jQuery selector string to buil container
 */

graphsrv.components.register(
  "Base",
  {
    "Base" : function(container_selector) {
      this.component_id = ++graphsrv.components.counter;
      this.container = $(container_selector || '<div>')
      /**
       * component width - this is set automatically during `get_proportions`
       * @property width
       * @type Number
       */
      this.width = 0;

      /**
       * component height - this is set automatically during `get_proportions`
       * @property height
       * @type Number
       */
      this.height = 0;

      /**
       * configuration options
       * @property options
       * @type Object
       */
      this.options = {};

      this.claimed_targets = [];

      this.data_viewport = new graphsrv.util.DataViewport(250);

      this.type = "component"

      // load default options
      this.update_options(this.default_options())

      $(window).resize(function() {
        this.render_static();
        this.render_dynamic();
      }.bind(this));
    },

    /**
     * Returns the default options for the component
     * @method default_options
     * @returns Object
     */

    "default_options" : function() {
      return {
        "target_id" : "id"
      };
    },

    /**
     * Update the component's options
     * @method update_options
     * @param {Object} options - object literal holding the option values
     *    you want to update
     */

    "update_options" : function(options) {
      $.extend(true, this.options, options);
    },

    /**
     * Update thid `width` and `height` properties
     * of the component.
     *
     * This does not actually alter container width and height, but simply
     * retrieves the parent element's width and height and stores it in
     * the component's `width` and `height` properties
     *
     * @method get_proportions
     */

    "get_proportions" : function() {
      this.width = this.container.parent().width()

      var h=5;
      this.container.parent().children().not(this.container).each(function() {
        h+=$(this).height()
      });

      this.height = this.container.parent().height()-h
    },

    /**
     * Syncs `width` and `height` properties to the container element
     * effectivly resizing it.
     *
     * @method sync_properties
     */

    "sync_proportions" : function() {
      this.get_proportions()
      this.container.attr("width", this.width)
      this.container.attr("height", this.height)
    },

    /**
     * Render static parts of the component
     * @method render_static
     */

    "render_static" : function() {
      this.sync_proportions();
    },

    /**
     * Render dynamic parts of the component
     * @method render_dynamic
     */

    "render_dynamic" : function() {
    },

    /**
     * Update the component
     * @method update
     * @param {Array} data
     */

    "update" : function(data) {
      if(data == undefined && this.raw_data)
        data = this.raw_data;
      var _data = [], __data = [], i, k, id, source=this.options.source;

      var vp = this.data_viewport, start, end;

      for(i = 0; i < data.length; i++) {
        id = source + '-' + this.type + "-" + data[i][0][this.options.target_id];
        if(graphsrv.update.claimed_targets[id] == this) {
          __data = []
          start = vp.get_start(data[i])
          end = vp.get_end(data[i])
          for(k = start; k < end; k++) {
            __data.push(data[i][k])
          }
          _data.push(__data)
        }
      }

      this.data = _data;
      this.raw_data = data;

      $(this).trigger("update_before_render", [this.data])
      this.render_dynamic();
      $(this).trigger("update_after_render", [this.data])
    },

    "claim_targets" : function(data) {
      var id, i, n = this.options.max_targets;
      var source = this.options.source;
      if(n <= this.claimed_targets.length)
        return;
      for(i = 0; i < data.length; i++) {
        if(n == 0)
          break;
        id = source + '-' + this.type + "-" + data[i][0][this.options.target_id];
        if(!graphsrv.update.claimed_targets[id]) {
          graphsrv.update.claimed_targets[id] = this;
          n--;
          this.claimed_targets.push(id);
        }
      }
    }


  }
)

/**
 * Basic graph component that can render multiple
 * data along x and y
 *
 * @class Graph
 * @extends graphsrv.components.Base
 * @namespace graphsrv.components
 * @constructor
 * @param {Object} options
 */

graphsrv.components.register(
  "Graph",
  {
    "Graph" : function(options) {

      /**
       * graph margin
       * @property margin
       * @type Object
       */
      this.margin = { top : 0, bottom : 40, left : 0, right : 65 }

      /**
       * Holds the graph scales once calculated via `calculate_scales`
       * @property scales
       * @type Object
       */
      this.scales = {};
      this.type = "graph";
      this.Base('<svg class="multitarget">');
      this.container.attr("id", options.id)

      // define d3 containers
      this.d3 = {
        // component container
        "container" : d3.select(this.container.get(0)),

        // defs
        "defs" : d3.select(this.container.get(0)).
          append("defs"),

        // graph background rect
        "background" : d3.select(this.container.get(0)).
          append("rect").attr("class", "background"),

        // holds the data paths
        "data" : d3.select(this.container.get(0)).
          append("g").attr("class","data"),

        // holds the data labels
        "labels" : d3.select(this.container.get(0)).
          append("g").attr("class", "labels"),

        // holds the axes
        "axes" : d3.select(this.container.get(0)).
          append("g").attr("class","axes"),

        // for mouse events on the graph area
        "interactive" : d3.select(this.container.get(0)).
          append("rect").attr("class","interactive").attr("pointer-events","all"),

        // for mouse event on the history scroll area
        "history_scroll" : d3.select(this.container.get(0)).
          append("rect").attr("class","history_scroll").attr("pointer-events","all")
      }

      // default options
      this.update_options(options);

      // before we render an update we need to recalulcate the scales
      // as new data may change their domains
      $(this).on("update_before_render", function(e, data) {
        this.calculate_scales();
      })

      // require an update handler for this graph
      var update = graphsrv.update.require(
        "/graph_data/",
        {
          "source":options.source,
          "targets":options.targets.join(",")
        }, options.interval
      )

      // everytime the update handler gets data, we update the graph
      $(update).on("update", function(e, data) {
        this.data_feed_stopped = false;
        var _update = function() {
        var t1 = new Date().getTime();
        this.claim_targets(data);
        this.update(data);
        var t2 = new Date().getTime();
        this.update_time = (t2-t1);
        if(this.debug)
          console.log(this.type, this.component_id, "render time", this.update_time, "ms");
        }.bind(this);
        if(graphsrv.staggered_render) {
          var delay =  graphsrv.staggered_render*this.component_id
          setTimeout(_update, delay);
        }  else {
          _update();
        }
      }.bind(this))

      $(update).on("data_feed_stopped", function(e) {
        this.data_feed_stopped = true;
        this.update();
      }.bind(this))

      var popover_class = graphsrv.popovers.get("GraphPopover")
      this.popover = new popover_class($(this.d3.interactive.node()), this);

      this.data_viewport.bind_scroll(
        $(this.d3.history_scroll.node()),
        function() {
          return {
            "max_length" : this.raw_data[0].length,
            "data" : this.data[0],
            "scroll_size" : (this.inner_width()/this.data[0].length)
          }
        }.bind(this)
      )
      $(this.data_viewport).on("scroll", function() {
        this.update();
      }.bind(this));

    },

    /**
     * Returns the default options for the graph
     * @method default_options
     * @returns {Object}
     */

    "default_options" : function() {

      return {
        // target config
        "config" : {},
        // field to be used to id targets
        "target_id" : "host",
        // field to be datated on x axis
        "data_x" : "time",
        "data_max_x" : "time",
        "data_min_x" : "time",
        // field to be datated on y axis
        "data_y" : "avg",
        "data_max_y" : "avg",
        "data_min_y" : "avg",
        // y axis formatter to use
        "format_y" : "ms",
        // x axis formatter to use
        "format_x" : null,
        "max_targets" : 999
      }

    },

    /**
     * Returns the active graph height taking margins into account
     * @method inner_height
     * @returns Number
     */

    "inner_height" : function() {
      return this.height - this.margin.top - this.margin.bottom;
    },

    /**
     * Returns the active graph width taking margins into account
     * @method inner_width
     * @type Number
     */

    "inner_width" : function() {
      return this.width - this.margin.left - this.margin.right;
    },

    "inner_right" : function() {
      return this.inner_width() + this.margin.left;
    },

    "inner_bottom" : function() {
      return this.inner_height() + this.margin.top;
    },

    /**
     * Returns the formatter function for the specified axis (by axis name)
     * @method formatter
     * @param {String} axis - axis name so "x", "y", "x2" etc.,
     * @return Function
     */

    "formatter" : function(axis) {
      return graphsrv.formatters[this.options["format_"+axis]];
    },

    /**
     * Calculate the scales for the graph
     *
     * Scales will be available by axis name in `scales` afterwards.
     * @method calculate_scales
     */

    "calculate_scales" : function () {
      var options = this.options;
      this.scales = {
        "x" : d3.scaleTime()
          .range([this.margin.left, this.inner_width()+this.margin.left])
          .domain([
            d3.min(this.data, function(d) {
              return d3.min(d, function(_d) {
                return _d[options.data_min_x]
              })
            }),
            d3.max(this.data, function(d) {
              return d3.max(d, function(_d) {
                return _d[options.data_max_x]
              })
            })
          ]),
        "y" : d3.scaleLinear()
          .range([this.inner_height()+this.margin.top, this.margin.top])
          .domain([
            d3.min(this.data, function(d) {
              return d3.min(d, function(_d) {
                return _d[options.data_min_y];
              }.bind(this))
            }.bind(this)),
            d3.max(this.data, function(d) {
              return d3.max(d, function(_d) {
                return _d[options.data_max_y]*1.25
              }.bind(this))
            }.bind(this))
          ])
      };
    },

    /**
     * Retrieve target config object from data point
     *
     * @method target_config
     * @param {Object} data
     * @returns Object
     */

    "target_config" : function(data) {
      // Default target config to return if no target
      var config = {
        "color" : "#ccc",
        "stroke_width" : "1.5",
        "name" : target
      };

      if(!data)
        return config;

      var target = data[this.options.target_id]

      if(this.options.config && this.options.config.targets[target])
        $.extend(true, config, this.options.config.targets[target])
      return config;
    },

    /**
     * Render static graph parts such as background and proportions
     * @method render_static
     */

    "render_static" : function() {
      this.Base_render_static();
      this.render_background();
      this.render_interactive();
      this.render_history_scroll();
    },

    "render_background" : function() {
      this.d3.background
        .attr("width", this.inner_width())
        .attr("height", this.inner_height())
        .attr("transform", "translate("+this.margin.left+", "+this.margin.top+")")
    },

    "render_interactive" : function() {
      this.d3.interactive
        .style("fill", "transparent")
        .attr("width", this.inner_width())
        .attr("height", this.inner_height())
        .attr("transform", "translate("+this.margin.left+", "+this.margin.top+")")
    },

    "render_history_scroll" : function() {
      this.d3.history_scroll
        .style("fill", "transparent")
        .style("cursor", "ew-resize")
        .attr("width", this.inner_width())
        .attr("height", 25)
        .attr("transform", "translate("+this.margin.left+", "+(this.margin.top+this.inner_height())+")")
    },

    /**
     * Render dynamic graph parts (axes, labels, data)
     * @method render_dynamic
     */

    "render_dynamic" : function() {
      $(this).trigger("render_dynamic_before")
      this.clear_data();
      this.render_data();
      this.clip_data();
      this.render_labels();
      this.render_axes();
      $(this).trigger("render_dynamic_after")
    },

    /**
     * Render the axes, this is called during `render_dynamic`
     * @method render_axes
     */

    "render_axes" : function() {

      $(this).trigger("render_axes_before")

      this.d3.axes.selectAll("*").remove()

      this.d3.axes.append("g")
        .attr("class", function(d)  {
          return "y axis right" + (this.data_feed_stopped?" error":"")
        }.bind(this))
        .attr("transform", "translate("+(this.inner_width()+this.margin.left)+", 0)")
        .call(d3.axisRight(this.scales.y).ticks(5).tickFormat(this.formatter("y")))

      this.d3.axes.append("g")
        .attr("class", function(d) {
          return "x axis bottom" + (this.data_viewport.offset<0?" historic":"");
        }.bind(this))
        .attr("transform", "translate(0, "+(this.inner_height() + this.margin.top)+")")
        .call(d3.axisBottom(this.scales.x).tickFormat(this.formatter("x")))

      if(this.data_feed_stopped) {
        this.d3.axes.append("g")
          .attr("transform", "translate("+this.inner_right()+", "+this.inner_bottom()+")")
          .attr("class", "data-feed-stopped")
          .append("text")
            .attr("x", this.inner_bottom()/2)
            .attr("y", -5)
            .text("Data Feed Stopped")
            .attr("transform", "rotate(-90)")
      }

      $(this).trigger("render_axes_after")
    },


    "clear_data" : function() {
      // remove all existing data data
      this.d3.data.selectAll("*").remove()

      this.d3.defs.select("clipPath").remove()

      this.d3.defs.append("clipPath")
        .attr("id", "data-clip-"+this.component_id)
        .append("rect")
          .attr("width", this.inner_width())
          .attr("height", this.inner_height())
          .attr("tranform", "translate("+this.margin.left+", "+this.margin.top+")")
    },

    "clip_data" : function() {
      var id = this.component_id;
      this.d3.data.selectAll("rect").attr("clip-path", "url(#data-clip-"+id+")")
      this.d3.data.selectAll("path").attr("clip-path", "url(#data-clip-"+id+")")
    },

    /**
     * Render the data, this is called during `render_dynamic`
     * @method render_data
     */

    "render_data" : function() {

      var scales = this.scales;
      var options = this.options;

      // line datating function
      var line = d3.line()
        .x(function(d) { return scales.x(d[options.data_x]); })
        .y(function(d) { return scales.y(d[options.data_y] || 0); })

      // create data
      var data = this.d3.data.selectAll("g")
        .data(this.data)
        .enter().append("g")
          .append("path")
            .style("stroke", function(d,i) { return this.target_config(d[i]).color; }.bind(this))
            .attr('stroke-width', function(d,i) { return this.target_config(d[i]).stroke_width; }.bind(this))
            .attr('d', line)

    },

    "render_label" : function(data) {
      return this.target_config(data).name + " " + this.formatter("y")(data[this.options.data_y]);
    },

    /**
     * Render the data labels, this called during `render_dynamic`
     * @method render_labels
     */

    "render_labels" : function() {
      var text_width = []
      this.d3.labels.selectAll("*").remove()

      var i, _data = [], row;
      for(i = 0; i < this.data.length; i++) {
        row = this.data[i][this.data[i].length-1];
        _data.push({"data": row, "text":this.target_config(row).name})
      }
      _data.sort(function(a,b) { return d3.ascending(a.text, b.text) })

      // remove existing labels
      this.d3.labels.selectAll("g")
        .data(_data)
        .enter().append("g")

      // add dummy labels so we can figure out heir width
      // they will be removed immediatly afterwards
      this.d3.labels.selectAll("g")
        .append("text")
          .attr("class", "label")
          .text(function(d,i) {
            return this.render_label(d.data)
          }.bind(this))
          .each(function() {
            text_width.push(this.getComputedTextLength())
            this.remove();
          })

      // render label backdrops to improve readability
      this.d3.labels.selectAll("g")
        .append("rect")
          .attr("rx", 6)
          .attr("ry", 6)
          .attr("class", "label-background")
          .attr("width", function(d,i) { return text_width[i]+6 })
          .attr("height", 18)
          .attr("transform", function(d,i) {
            return "translate("+(this.margin.left+2)+", "+(((i+1)*20)-13)+")"}.bind(this))
          .style("fill", "#000")

      // render label texts
      this.d3.labels.selectAll("g")
        .append("text")
          .attr("class", "label")
          .attr("transform", function(d,i) {
            return "translate("+(this.margin.left+5)+", "+((i+1)*20)+")"}.bind(this))
          .style("fill", function(d,i) {
            return this.target_config(d.data).color
          }.bind(this))
          .text(function(d,i) {
            return this.render_label(d.data)
          }.bind(this))
    }

  },
  "Base"
)

/**
 * Base graphsrv Plugin. basically anything that is not a graph
 * should extend this
 *
 * @class Plugin
 * @namespace graphsrv.components
 * @constructor
 * @params {Object} options
 */

graphsrv.components.register(
  "Plugin",
  {
    "Plugin" : function(options) {
      this.Base();
    }
  },
  "Base"
)

graphsrv.components.instantiate = function(name, options) {
  var cls = this.get(name);
  return new cls(options);
}

$(window).mouseleave(function(e) {
  if(!e.relatedTarget) {
    var i;
    for(i in graphsrv.instances) {
      var instance = graphsrv.instances[i];
      if(instance.data_viewport) {
        instance.data_viewport.stop_scrolling();
      }
    }
  }
});

})(jQuery, twentyc)
