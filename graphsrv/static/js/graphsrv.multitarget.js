(function() {

var OG = TwentyC.widget.Chart.widget.MultiTargetGraph = function() {}
OG.prototype = new TwentyC.widget.Chart.widget.Graph();
OG.prototype.title = "Multiple Targets"
OG.prototype.Init = 
OG.prototype.InitOGPlot = function(target, isOverlay, config) {
  console.log(config);
  this.InitGraph();
  this.serverConfig = config || {};
  this.targetConfig = config && config.targets ? config.targets[target] || {} : {};
  this.title = this.targetConfig.name || target;
  this.plotField = config.plot_y

  this.config.plots.main.renderFncName = this.targetConfig["draw"] || "RenderLine",
  this.config.plots.main.plotValue = config.plot_y
  this.config.plots.main.fill = false;
  if(this.targetConfig.color)
    this.config.plots.main.colors.neutral = this.targetConfig.color;
  else
    this.config.plots.main.colors.neutral = graph_colors[isOverlay] || "#fff";

  this.tick_size = 25;
  this.precision = 2;
  this.sync_scale = true;
  this.data_type = 1;
  this.y_zoom = 85;

  this.target = target
  this.labels = {}
  this.labels[this.plotField] ={
    title : "",
    fnFormat : graphsrv.formatters.get(config.format_y)
  }
  if(isOverlay)
    this.overlay = "main";
  return this;
}
OG.prototype.on_open = 
OG.prototype.on_change = 
OG.prototype.calc = function(chart, i, prev, data) {
  if(!data || !data.data[this.target]) {
    return { plots : { main : { time : 0 } } }
  }
  var rv= {
    plots : {
      main : {
        time : data.time,
        avg : parseInt(data.data[this.target][this.plotField]*Math.pow(10,this.precision))
      }
    }
  }
  return rv;
}
OG.prototype.FormatTickValue = function(val) {
  return parseFloat(val/Math.pow(10,this.precision)).toFixed(2)+"ms";
}
OG.prototype.Id = function() {
  return this.target;
}
TwentyC.widget.Chart.indicators.Register("multitarget", OG);

OG.instantiate = function(chart, targets, data_n, data_e, config) {
  var G, ctor=this, j = 0, t,target_sane, maintarget;

  for(t in data_n) {
    for(target in data_n[t].data) {
      if(TwentyC.util.InArray(target, targets) == -1) {
        continue;
      }

      target_sane = target.replace(".","_")
      if(target.charAt(0) == "_" || chart.graphs[target_sane] || maintarget==target_sane)
        continue;
      G = chart.AddGraph(j==0 ? "main" : target_sane, new ctor().Init(target, j, config));
      G.forceMinY = 0;
      if(!j)
        maintarget = target_sane
      j++
    }
  }

}


})();
