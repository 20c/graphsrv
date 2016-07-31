(function() {

// SFLOW OVERVIEW GRAPH

var SFOG = TwentyC.widget.Chart.widget.SFlowOverviewGraph = function() {}
SFOG.prototype = new TwentyC.widget.Chart.widget.Graph();
SFOG.prototype.title = "Sflow Overview"
SFOG.prototype.Init = 
SFOG.prototype.InitSFOGPlot = function(target, isOverlay, config) {
  this.title = config && config.title ? config.title : target
  this.InitGraph();
  this.serverConfig = config || {};

  // we want to set up two plot points for this graph, one 
  // plotting in_oct towards the top, and the other 
  // plotting out_oct towards the bottom

  this.NewPlot("in", "In", "oct")
  this.NewPlot("out", "Out", "oct")
  delete this.config.plots.main
  delete this.prefs.plots.main

  // plot configs

  this.config.plots.in.renderFncName = "RenderLine",
  this.config.plots.in.fill = true;
  this.config.plots.in.plotValue = "oct"
  this.config.plots.in.efficient_fill = true;

  this.config.plots.out.renderFncName = "RenderLine",
  this.config.plots.out.fill = true;
  this.config.plots.out.plotValue = "oct"
  this.config.plots.out.efficient_fill = true;

  if(this.serverConfig.color) {
    this.config.plots.in.colors.neutral = this.serverConfig.color;
    this.config.plots.out.colors.neutral = this.serverConfig.color;
  } else {
    this.config.plots.in.colors.neutral = graph_colors[isOverlay] || "#fff";
    this.config.plots.out.colors.neutral = graph_colors[isOverlay] || "#fff";
  }
  this.tick_size = 1024
  this.sync_scale = true;
  this.y_axis_origin = 0;
  this.data_type = 1;
  this.target = target

  // labels rendered in the top left of chart

  this.labels = {
    oct : { 
      title : ""
    }
  }
 
  // if this is an overlayed graph, make sure it overlays
  // on the main graph in the chart

  if(isOverlay)
    this.overlay = "main";

  // draw horizontal line on zero

  this.onRenderPlots.subscribe(function(e,d) {
    var payload = d[0];
    payload.canvas.Line(
      payload.chart.layout.chart.x,
      payload.chart.ValueToY(payload.graph, 0),
      payload.chart.layout.chart.r,
      payload.chart.ValueToY(payload.graph, 0),
      1,
      "#fff"
    );
  });

  return this;
}
SFOG.prototype.on_open = 
SFOG.prototype.on_change = 
SFOG.prototype.calc = function(chart, i, prev, data) {
  var date = new Date()
  if(data)
    date.setTime(data.time);
  if(!data || !data.data[this.target]) {
    return { 
      plots : { 
        in : { 
          time : (data ? data.time : 0), 
          oct : 0 
        }, 
        out : { 
          time : (data ? data.time : 0), 
          date : date,
          oct : 0 
        } 
      } 
    }
  }
  var rv= {
    plots : {
      in : {
        time : data.time,
        oct : parseInt( (parseInt(data.data[this.target].in_oct)*8) || 0)
      },
      out : {
        time : data.time,
        date : date,
        oct : parseInt( -(parseInt(data.data[this.target].out_oct)*8) || 0)
      }
    }
  }
  

  return rv;
}
SFOG.prototype.CalculateTickSize = function() {
  var sz = graphsrv.sizes
  var val = Math.max(this.dataMaxY, Math.abs(this.dataMinY));
  if(val < sz.kbyte*0.5) 
    return 1
  else if(val < sz.mbyte*0.5)
    return sz.kbyte
  else if(val < sz.gbyte*0.5)
    return sz.mbyte
  else if(val < sz.tbyte*0.5)
    return sz.gbyte
  else if(val < sz.pbyte*0.5)
    return sz.tbyte
  else
    return sz.pbyte
}
SFOG.prototype.ReadableValue = function(val, valAsMax) {
  var sz = graphsrv.sizes
  if(!valAsMax)
    var max = Math.max(this.dataMaxY, Math.abs(this.dataMinY));
  else
    var max = val;
  if(max < sz.kbyte*0.5) 
    return val
  else if(max < sz.mbyte*0.5)
    return val / 1024 
  else if(max < sz.gbyte*0.5)
    return val / Math.pow(1024, 2)
  else if(max < sz.tbyte*0.5)
    return val / Math.pow(1024, 3)
  else if(max < sz.pbyte*0.5)
    return val / Math.pow(1024, 4)
  else
    return val / Math.pow(1024, 5)
}
SFOG.prototype.MeasureLabel = function(val, valAsMax) {
  if(!valAsMax)
    var max = Math.max(this.dataMaxY, Math.abs(this.dataMinY));
  else
    var max = val;
  var sz = graphsrv.sizes
  if(max < sz.kbyte*0.5) 
    return "bit"
  else if(max < sz.mbyte*0.5)
    return "Kbit"
  else if(max < sz.gbyte*0.5)
    return "Mbit"
  else if(max < sz.tbyte*0.5)
    return "Gbit"
  else if(max < sz.pbyte*0.5)
    return "Tbit"
  else
    return "Pbit"

}
SFOG.prototype.FormatTickValue = function(val, validate, forLabel) {
  return this.ReadableValue(Math.abs(val), forLabel).toFixed(2)+this.MeasureLabel(Math.abs(val), forLabel);
}
SFOG.prototype.Id = function() {
  return this.target;
}
TwentyC.widget.Chart.indicators.Register("SFlowOverview", SFOG);
})();
