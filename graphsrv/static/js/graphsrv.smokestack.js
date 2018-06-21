(function($, $tc, $gs) {

$gs.components.register(
  "smokestack",
  {

    "smokestack" : function(options) {
      this.Graph(options);
      this.type = "smokestack";
      this.container.attr("class", "smokestack");
      this.data_viewport.set(150);
    },

    "render_data" : function() {

      var i,j,k,
          x = this.scales.x,
          y = this.scales.y,
          o = this.options;
      var bar_width = this.inner_width() / this.data[0].length;
      var backref = d3.local()

      this.d3.data.selectAll("g.data")
        .data(this.data)
        .enter().append("g")
          .attr("class","data")
          .selectAll("rect")
          .data(function(d) { return d })
          .enter().append("rect")
            .attr("y", function(d,i) { return y(d[o.data_y]) - 2 })
            .attr("x", function(d,i) { return x(d[o.data_x]) - (bar_width * 0.5) })
            .attr("height", 2)
            .attr("width", bar_width)
            .style("fill", function(d,i) { return this.loss_color(d) }.bind(this))

      for(i = 0; i < this.data[0].length; i++) {
        j = this.data[0][i];
        if(!j.smokedata) {
          j.smokedata = $gs.util.count_values(j.data);
        }
      }


      this.d3.data.selectAll("g.data")
        .data(this.data)
        .selectAll("g")
        .data(function(d) { return d })
        .enter().append("g")
          .each(function(d) { backref.set(this, d) })
          .selectAll("rect")
          .data(function(d) { return d.smokedata || [] })
          .enter().append("rect")
            .attr("height", function(d,i,j) {
              var br = backref.get(j[i].parentNode)
              return y(br.min) - y(d.value)
            })
            .attr("x", function(d,i,j) {
              var br = backref.get(j[i].parentNode)
              return x(br[o.data_x]) - (bar_width * 0.5)
            })
            .attr("y", function(d) { return y(d.value) })
            .attr("width", bar_width)
            .attr("fill", "#fff")
            .attr("opacity", function(d) {
              return (1/d.total) * d.count;
            })

    },

    "default_options" : function() {
      var default_options = this.Graph_default_options()
      $.extend(true, default_options, {
        "max_targets" : 1,
        "data_max_y" : "max",
        "data_min_y" : "min",
        "loss_color" : [
          "lime",
          "aqua",
          "blue",
          "darkslateblue",
          "purple",
          "magenta",
          "red"
        ]
      })
      return default_options;
    },


    "popover_update" : function(e, payload) {
      var content = $("<div>")
      var j = 0;

      this.d3.data.selectAll("g.data")
        .each(function(d) {
          content.append(this.popover_render_line($("<p>"), d[payload.index]))
        }.bind(this))

      var t = new Date();
      t.setTime(this.data[0][payload.index].time)

      this.popover().children("h1").text(t);
      this.popover().children("div.body").empty().append(content);
    },

    "loss_color" : function(data) {
      var lvl, p = (data.loss / data.cnt);
      if(!p)
        lvl = 0;
      else if(p <= 0.2)
        lvl = 1;
      else if(p <= 0.3)
        lvl = 2;
      else if(p <= 0.4)
        lvl = 3;
      else if(p <= 0.5)
        lvl = 4;
      else if(p <= 0.9)
        lvl = 5;
      else
        lvl = 6
      return this.options.loss_color[lvl];
    },

    "render_label" : function(data) {
      return this.Graph_render_label(data) + " max " + data.max + "ms - " + data.loss + "/" + data.cnt;
    }

  },
  "Graph"
)

})(jQuery, twentyc, graphsrv);
