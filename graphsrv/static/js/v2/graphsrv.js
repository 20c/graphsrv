(function($, $tc) {

// namespace(s)
graphsrv = {
  "components" : new $tc.cls.Registry(),
  "formatters" : {},
  "instances" : {},
  "util" : {}
}

graphsrv.util.DataViewport = $tc.cls.define(
  "DataViewport",
  {
    "DataViewport" : function(length) {
      this.set(length)
    },
    "set" : function(length) {
      this.length = (length == undefined ? -1 : length)
    },
    "get_start" : function(data) {
      if(this.length == -1)
        return 0;
      return Math.max(0, data.length - this.length);
    },
    "get_end" : function(data) {
      if(this.length == -1)
        return data.length;
      return Math.min(data.length, this.get_start(data) + this.length);
    },
    "get_length" : function(data) {
      if(this.length == -1)
        return (data ? data.length : 0)
      return Math.min(this.length, (data?data.length:0))
    }
  }
);

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
        "max_length" : 250,
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
          )
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

      this.data_viewport = new graphsrv.util.DataViewport();

      this.type = "component"

      // load default options
      this.update_options(this.default_options())

      $(window).resize(function() {
        this.render_static();
        this.render_dynamic();
        this.render_interactive(true);
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
      this.height = this.container.parent().height()
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

      $(this).trigger("update_before_render", [this.data])
      this.render_dynamic();
      $(this).trigger("update_after_render", [this.data])
    },

    "claim_targets" : function(data) {
      var id, i, n = this.options.max_targets;
      var source = this.options.source;
      for(i = 0; i < data.length; i++) {
        if(n == 0)
          break;
        id = source + '-' + this.type + "-" + data[i][0][this.options.target_id];
        if(!graphsrv.update.claimed_targets[id]) {
          graphsrv.update.claimed_targets[id] = this;
          n--;
        }
      }
    },

    "popover_bind" : function(node, payload) {
      node = $(node);
      if(node.data("popover_bound"))
        return;

      node.attr("pointer-events", "all")

      var popover_move = function(e) {
        this.popover_show(e, payload);
      }.bind(this);

      node.on("mouseover", function() {
        node.on("mousemove", popover_move)
      }.bind(this));
      node.on("mouseout", function(e) {
        node.off("mousemove", popover_move)
        this.popover_hide();
      }.bind(this))
      node.data("popover_bound", true);
    },

    "popover" : function() {
      if(!this.popover_container) {
        this.popover_container = $("<div>")
          .attr("class", "graphsrv-popover")
          .css("position", "absolute")
          .css("display", "none")
          .append($("<h1>"))
          .append($("<div>").attr("class","body"))
          .appendTo(document.body)
      }
      return this.popover_container;
    },

    "popover_show" : function(e, payload) {
      this.popover_update(e, payload)
      this.popover()
        .css("left", (e.pageX+5)+"px")
        .css("top", (e.pageY+5)+"px")
        .css("display", "block")
    },

    "popover_hide" : function() {
      this.popover().css("display", "none")
    },

    "popover_render_line" : function(line, data) {
      var target_config = this.target_config(data)
      line.append(
        $("<strong>").text(target_config.name+":").css("color", target_config.color)
      ).append(
        $("<span>").attr("class", this.options.data_y).text(
          this.formatter("y")(data[this.options.data_y])
        )
      )
      return line;
    },
    "popover_update" : function(e, payload) {
      var content = $("<div>")
      var j = 0;

      this.d3.data.selectAll("g")
        .each(function(d) {
          content.append(this.popover_render_line($("<p>"), d[payload.index]))
        }.bind(this))

      var t = new Date();
      t.setTime(this.data[0][payload.index].time)

      this.popover().children("h1").text(t);
      this.popover().children("div.body").empty().append(content);
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

        // holds the elements that the user can interactive (mouseover etc.)
        "interactive" : d3.select(this.container.get(0)).
          append("g").attr("class","interactive")
      }

      this.canvas = {
        "main" : $("<canvas>")
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
      var target = data[this.options.target_id]

      // Default target config to return if no target
      var config = {
        "color" : "#ccc",
        "stroke_width" : "1.5",
        "name" : target
      };

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

      this.d3.background
        .attr("width", this.inner_width())
        .attr("height", this.inner_height())
        .attr("transform", "translate("+this.margin.left+", "+this.margin.top+")")

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
      this.render_labels()
      this.render_axes();
      this.render_interactive();
      $(this).trigger("render_dynamic_after")
    },

    /**
     * Render the axes, this is called during `render_dynamic`
     * @method render_axes
     */

    "render_axes" : function() {

      this.d3.axes.selectAll("*").remove()

      this.d3.axes.append("g")
        .attr("class", "y axis right")
        .attr("transform", "translate("+(this.inner_width()+this.margin.left)+", 0)")
        .call(d3.axisRight(this.scales.y).tickFormat(this.formatter("y")))

      this.d3.axes.append("g")
        .attr("class", "x axis bottom")
        .attr("transform", "translate(0, "+(this.inner_height() + this.margin.top)+")")
        .call(d3.axisBottom(this.scales.x).tickFormat(this.formatter("x")))

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

      // remove existing labels
      this.d3.labels.selectAll("g")
        .data(this.data)
        .enter().append("g")

      // add dummy labels so we can figure out heir width
      // they will be removed immediatly afterwards
      this.d3.labels.selectAll("g")
        .append("text")
          .attr("class", "label")
          .text(function(d,i) {
            return this.render_label(d[d.length-1])
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
            return this.target_config(d[d.length-1]).color
          }.bind(this))
          .text(function(d,i) {
            return this.render_label(d[d.length-1])
          }.bind(this))
    },

    "render_interactive" : function(force) {
      if(!force) {
      if(!this.data || !this.data.length || !this.data[0].length)
        return;

      if($(this.d3.interactive.node()).children().length == this.data[0].length)
        return;
      }

      console.log(this.type, this.component_id, "rendering_interactives (2)")

      this.d3.interactive.selectAll("rect")
        .each(function(d,i,j) {
          $(j[i]).off()
        })
        .remove();


      var scales = this.scales, o = this.options;
      var bar_width = this.inner_width() / this.data[0].length;

      var sections = this.d3.interactive.selectAll("rect")
        .data(this.data[0])
        .enter().append("rect")
          .style("fill", "transparent")
          .attr("y", 0)
          .attr("x", function(d,i) { return scales.x(d[o.data_x]) - (bar_width * 0.5) })
          .attr("width", this.inner_width()/this.data[0].length)
          .attr("height", this.inner_height())
          .each(function(d,i,j) {
            this.popover_bind(j[i], {"index":i})
          }.bind(this))

/*
      var sections = this.d3.interactive.selectAll("rect")
        .data(this.data[0])
        .enter().append("rect")
          .style("fill", "transparent")
          .attr("y", 0)
          .attr("x", function(d,i) { return scales.x(d[o.data_x]) - (bar_width * 0.5) })
          .attr("width", this.inner_width()/this.data[0].length)
          .attr("height", this.inner_height())
          .each(function(d,i,j) {
            this.popover_bind(j[i], {"data":d, "index":i})
          }.bind(this))
*/
    },


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

})(jQuery, twentyc)
