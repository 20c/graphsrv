(function($, $tc, $gs) {

$gs.formatters.mtr_x = function(value, i, values, graph) {
  var hop = graph.get_recent()[value];
  if(hop) {
    return $gs.formatters.ms(hop.avg);
    //return d3.format(".2f")(hop.min) + " - " + d3.format(".2f")(hop.max) + "ms";
    //return $gs.formatters.ms(hop.min) + " - "+ $gs.formatters.ms(hop.max);
  } else {
    return "-"
  }
};

$gs.components.register(
  "mtr",
  {

    "colors" : [
      "lightblue",
      "lightgreen",
      "gold",
      "cyan",
      "lime",
      "yellow",
      "beige",
      "lightsalmon",
      "hotpink",
      "orange",
      "khaki"
    ],

    "mtr" : function(options) {
      this.Graph(options);
      this.type = "mtr";

      this.margin.left = 50;
      this.data_viewport.set(50);

      $(this).on("render_axes_after", function() {
        this.d3.axes.selectAll("g.x").selectAll("text")
          .attr("transform", "rotate(33)")
          .style("text-anchor", "start")
      });

    },

    "init_popover": function() {
    },

    "default_options" : function() {
      options = this.Graph_default_options();
      options.max_targets = 1;
      options.data_min_y = "min";
      options.data_max_y = "max";
      options.format_x = "mtr_x";
      options.format_y = "pcnt";
      options.format_y2 = "ms";
      return options;
    },

    "tick_size_x" : function() { return null },

    "render_label" : function(data) {
      return "MTR "+this.target_config(data).name;
    },

    "get_hops" : function() {
      var i;
      if(this.data && this.data[0] && this.data[0].length) {
        var l = this.data[0].length-1;
        return this.data[0][l].hops;
      }
      return [];
    },

    "get_recent" : function() {
      var i;
      if(this.data && this.data[0] && this.data[0].length) {
        var l = this.data[0].length-1;
        return this.data[0][l].data;
      }
      return {};
    },

    "get_smokestack" : function(host) {
      var smokestack = [];
      if(this.data && this.data[0]) {
        var i, data = this.data[0];
        for(i = 0; i < data.length; i++) {
          if(data[i].data[host])
            smokestack.push(data[i].data[host]);
        }
      }
      return smokestack;
    },

    "calculate_scales" : function() {
      var graph = this;
      var hops = this.get_hops();
      var smokestacks = [], i;
      for(i = 0; i < hops.length; i++) {
        smokestacks[i] = this.get_smokestack(hops[i]);
      }
      this.scales = {
        "x" : d3.scaleBand()
          .range([this.margin.left, this.inner_right()])
          .domain($.map(hops, function(d) { return d })),
        "y2" : d3.scaleLinear()
          .range([this.inner_bottom(), this.margin.top])
          .domain([
            d3.min(hops, function(d,i) {
              return d3.min(smokestacks[i], function(d) { return d.min })
            }),
            d3.max(hops, function(d,i) {
              return d3.max(smokestacks[i], function(d) { return d.max })
            })
          ]),
        "y" : d3.scaleLinear()
          .range([this.inner_bottom(), this.margin.top])
          .domain([0, 1])
      }
    },

    "render_data" : function() {
      var i,
          o = this.options,
          x = this.scales.x,
          y = this.scales.y2,
          colors = {},
          graph = this,
          h = this.inner_height(),
          hops = this.get_hops();

      var recent = this.get_recent();

      bandwidth = Math.min(x.bandwidth()-2, 25);

      for(i = 0; i < hops.length; i++) {
        colors[hops[i]] = this.colors[i]
      }

      var bars = this.d3.data.selectAll("g")
        .data(hops)
        .enter().append("g")
          .attr("transform", function(d) { return "translate("+x(d)+",0)"})

      bars.append("rect")
        .attr("class", "loss")
        .attr("x", (x.bandwidth() / 2) + (bandwidth / 2))
        .attr("y", function(d) { return h - (h * recent[d].loss) })
        .attr("height", function(d) { return h * recent[d].loss })
        .attr("width", 2)
        .style("fill", "red")


      bars.selectAll("rect.bar")
        .data(function(d,i) { return this.get_smokestack(d) }.bind(this))
        .enter().append("rect")
          .attr("class", "bar")
          .attr("width", bandwidth)
          .attr("height", function(d) { return y(d[o.data_min_y]||0) - y(d[o.data_max_y]||0);})
          .attr("y", function(d) { return y(d[o.data_max_y]||0) })
          .attr("x", (x.bandwidth() / 2) - (bandwidth / 2))
          .style("fill", function(d,i,j) {
            return colors[d.host]
          })
          .style("opacity", function(d,i,j) { return 1/j.length })

      bars.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", x.bandwidth()/2)
        .attr("x", function(d) { return -(this.inner_height()) + 5 }.bind(this))
        .attr("dy", ".35em")
        .text(function(d) { return d })


    }
  },
  "Graph"
);

})(jQuery, twentyc, graphsrv);
