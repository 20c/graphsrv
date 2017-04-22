(function() {

var DG = TwentyC.widget.Chart.widget.SmokeStackGraph = function() {}
DG.prototype = new TwentyC.widget.Chart.widget.Graph();
DG.prototype.title = "Vaping Detail"
DG.prototype.Init = 
DG.prototype.InitDGPlot = function(target, isOverlay, config) {
  this.InitGraph();
  this.targetConfig = config && config.targets ? config.targets[target] || {} : {};
  this.title = this.targetConfig.name || target;
  this.config.plots.main.renderFncName = "RenderHeatmap",
  this.config.plots.main.plotValue = "close"
  this.config.plots.main.colors.neutral = "#fff";
  this.config.plots.main.colors.loss_level0 = "lime";
  this.config.plots.main.colors.loss_level1 = "aqua";
  this.config.plots.main.colors.loss_level2 = "blue";
  this.config.plots.main.colors.loss_level3 = "darkslateblue";
  this.config.plots.main.colors.loss_level4 = "purple";
  this.config.plots.main.colors.loss_level5 = "magenta";
  this.config.plots.main.colors.loss_level6 = "red";
  this.config.plots.main.line_thickness = 3;

  this.maxTargets = 1;
  
  var i;
  for(i=0; i<7; i++)
    this.PrefsColorAdd("main", "loss_level"+i, "Loss LVL "+i)

  this.tick_size = 25
  this.precision = 2
  this.sync_scale = true;
  this.target = target
  this.labels = {
    close : {
      title : "avg "
    },
    high : {
      title : "max "
    },
    loss : {
      title : "loss ",
      unvalidated : true,
      fnColor : function(a,b,prev,cur,graph) {
        return graph.LossColor(cur.loss, cur.cnt);
      },
      fnFormat : function(b) { return parseInt(b); }
    },
    cnt : {
      title : "/ ",
      unvalidated : true,
      fnFormat : function(b) { return parseInt(b); }
    }
  }
  this.onRenderPlot.subscribe(function(e,d) {
    var payload = d[0];
    payload.line_thickness = payload.chart.plotPointW;
    payload.colors.third = '#fff';
    payload.colors.primary = payload.graph.config.plots[payload.plot_name].colors[payload.graph.LossColor(payload.prev.loss, payload.prev.cnt)];
  });
  return this;
}

DG.prototype.toInt = function(v) {
  return parseInt(v * Math.pow(10, this.precision));
}

DG.prototype.toFloat = function(v) {
  return parseFloat(v) / Math.pow(10, this.precision);
}

DG.prototype.on_open = 
DG.prototype.on_change = 
DG.prototype.calc = function(chart, i, prev, data) {
  if(!data || !data.data[this.target]) {
    return { plots : { main : { time : 0 } } }
  }

  var rv= {
    plots : {
      main : {
        time : data.time,
        data : data.data[this.target].data,
        loss : parseInt(data.data[this.target].loss),
        cnt : parseInt(data.data[this.target].cnt),
        recv : parseInt(data.data[this.target].recv),
        close : this.toInt(parseFloat(data.data[this.target].avg)+0.5),
        open : this.toInt(parseFloat(data.data[this.target].avg)-0.5),
        high : this.toInt(parseFloat(data.data[this.target].max)),
        low : this.toInt(parseFloat(data.data[this.target].min)),
        price : this.toInt(parseFloat(data.data[this.target].avg))
      }
    }
  }
  //if(rv.plots.main.loss > 0)
  //  console.log(data.data[this.target]);
  return rv;
}

DG.prototype.LossColor = function(loss, cnt) {
  var p = (loss / cnt), lvl;
  if(!p) {
    lvl = 0;
  } else if(p <= 0.2) {
    lvl = 1
  } else if(p <= 0.3) {
    lvl = 2
  } else if(p <= 0.4) {
    lvl = 3
  } else if(p <= 0.5) {
    lvl = 4
  } else if(p <= 0.9) {
    lvl = 5
  } else  {
    lvl = 6
  }

  return "loss_level"+lvl;
}


DG.prototype.FormatTickValue = function(val, unvalidated) {
  if(unvalidated)
    return val;
  return this.toFloat(val).toFixed(2)+"ms";
}

DG.prototype.Id = function() {
  return this.target;
}
TwentyC.widget.Chart.indicators.Register("smokestack", DG);

DG.instantiate = function(chart, targets, data_n, data_e, config) {
  var target = targets[0], ctor = this;
  var G = chart.AddGraph("main", new ctor().Init(target, false, config)); 
  G.forceMinY = 0;
}

})();
