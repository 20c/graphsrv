// INIT

var graph_colors = ["AliceBlue","AntiqueWhite","Aqua","Aquamarine","Azure","Beige","Bisque","Black","BlanchedAlmond","Green","BlueViolet","Brown","BurlyWood","CadetBlue","Chartreuse","Chocolate","Coral","CornflowerBlue","Cornsilk","Crimson","DarkBlue","DarkCyan","DarkGoldenRod","DarkGray","DarkGrey","DarkGreen","DarkKhaki","DarkMagenta","DarkOliveGreen","Darkorange","DarkOrchid","DarkRed","DarkSalmon","DarkSeaGreen","DarkSlateBlue","DarkSlateGray","DarkSlateGrey","DarkTurquoise","DarkViolet","DeepPink","DeepSkyBlue","DimGray","DimGrey","DodgerBlue","FireBrick","FloralWhite","ForestGreen","Fuchsia","Gainsboro","GtargetWhite","Gold","GoldenRod","Gray","Grey","GreenYellow","HoneyDew","HotPink","IndianRed","Indigo","Ivory","Khaki","Lavender","LavenderBlush","LawnGreen","LemonChiffon","LightBlue","LightCoral","LightCyan","LightGoldenRodYellow","LightGray","LightGrey","LightGreen","LightPink","LightSalmon","LightSeaGreen","LightSkyBlue","LightSlateGray","LightSlateGrey","LightSteelBlue","LightYellow","LimeGreen","Linen","Magenta","Maroon","MediumAquaMarine","MediumBlue","MediumOrchid","MediumPurple","MediumSeaGreen","MediumSlateBlue","MediumSpringGreen","MediumTurquoise","MediumVioletRed","MidnightBlue","MintCream","MistyRose","Moccasin","NavajoWhite","Navy","OldLace","Olive","OliveDrab","OrangeRed","Orchid","PaleGoldenRod","PaleGreen","PaleTurquoise","PaleVioletRed","PapayaWhip","PeachPuff","Peru","Plum","PowderBlue","Purple","RosyBrown","RoyalBlue","SaddleBrown","Salmon","SandyBrown","SeaGreen","SeaShell","Sienna","SkyBlue","SlateBlue","SlateGray","SlateGrey","Snow","SpringGreen","SteelBlue","Tan","Teal","Thistle","Tomato","Turquoise","Violet","Wheat","White","WhiteSmoke","YellowGreen"], i;

graph_colors.unshift("Red")
graph_colors.unshift("Blue")
graph_colors.unshift("Lime")
graph_colors.unshift("Yellow")
graph_colors.unshift("Orange")
graph_colors.unshift("Silver")
graph_colors.unshift("Pink")
graph_colors.unshift("Cyan")

/**
 * sizes
 */

graphsrv.sizes = {
  "kbyte" : 1024,
  "mbyte" : Math.pow(1024, 2),
  "gbyte" : Math.pow(1024, 3),
  "tbyte" : Math.pow(1024, 4),
  "pbyte" : Math.pow(1024, 5)
}

/**
 * when multiple graphs are displayed we want to consolidate all
 * update requests into one
 */

graphsrv.globalUpdate = {
  afterUpdate : new TwentyC.cla.EventHandler("afterUpdate"),
  data : {
  },
  targets : {
  },
  ffa : {
  },
  busy : {
  },
  queue : [
  ],
  get_data : function(type) {
    if(!this.data[type]) {
      this.data[type] = [] 
      this.ffa[type] = []
    }
    return this.data[type]
  },
  require : function(type, targets) {
    var i;
    for(i in targets) {
      if(!this.targets[type])
        this.targets[type] = {}
      this.targets[type][targets[i]] = true;
    }
  },
  requestAll : function(type) {
    var type;
    if(this.queue.length)
      return;
    for(type in this.data) {
      this.queue.push(type);
    }
    this.request();
  },
  request : function() {
    if(this.queue.length == 0)
      return;
    var type = this.queue[0]
    if(this.busy[type])
      return;
    this.busy[type] = true;

    var i, targets_a=[];
    for(i in this.targets[type])
      targets_a.push(i);
    var targets = targets_a.join(",");
    var data_e = this.data[type];
    var ts = (data_e.length ? data_e[data_e.length-1].ts : 0);

    TwentyC.cla.XHR.send("POST", "/graph_data/", {
      success : function(o) {
        var data_n = JSON.parse(o.responseText).data;
        var t, k, rm=0, add=0, b=false, j=0, target, target_sane, maintarget;
        
        for(k in data_n) {
          t = data_n[k]
          t.time = parseInt(t.ts * 1000);
          if(b || !data_e.length || t.time > data_e[data_e.length-1].time) {
            b = true;
            data_e.push(t);
            add++;
          }
        }

        while(data_e.length > graphsrv.config.maxTicks) {
          data_e.shift();
          rm++;
        }
        this.afterUpdate.fire({"type" : type, "data_e" : data_e, "data_n" : data_n, "added" : add, "removed" : rm});
        this.busy[type] = false;
        this.queue.shift();
        if(this.queue.length) 
          this.request();
      }.bind(this),
      failure : function(o) {
        this.busy[type] = false;
        this.queue.shift();
        if(this.queue.length) 
          this.request();
      }.bind(this)
    }, "targets="+targets+"&ts="+ts+'&source='+type);
  }
}

/**
 * assign targets spread out evenly between all ffa overview graphs
 */

graphsrv.globalUpdate.afterUpdate.subscribe(function(e,d) {
 
  var target,targets,graph,i,idx,pl = d[0];

  var graphs = [], prev_targets = {}, curr_targets = {}, new_targets ={}, dropped_targets={};
  var assigned_targets = this.ffa[pl.type];
  
  // first we figure out which targets got added / dropped
  for(i = 0; i <  pl.data_e.length; i++) {
    for(target in pl.data_e[i].data) {
      prev_targets[target]=true;
    }
  }

  for(i = 0; i <  pl.data_n.length; i++) {
    for(target in pl.data_n[i].data) {
      if(!prev_targets[target] || !assigned_targets[target]) {
        new_targets[target] = true;
      }
      curr_targets[target] = true;
    }
  }

  for(target in prev_targets) {
    if(!curr_targets[target])
      dropped_targets[target] = true;
  }
  
  // now we assign targets to the various ffa graphs
  //
  // first figure out which graphs are valid targets
  for(i in graphsrv.graphs) {
    graph = graphsrv.graphs[i];
    if(graph.source == pl.type && graph.isFFA) 
      graphs.push(graph);
  }

  if(!graphs.length)
    return;

  graphs.sort(function(a,b) { return a.targetsArray.length - b.targetsArray.length });

  // unassign dropped targets
  for(target in dropped_targets) {
    if(graph=assigned_targets[target]) {
      idx = TwentyC.util.InArray(target,graph.targetsArray);
      if(idx > -1) {
        graph.targetsArray.splice(idx,1);
        graph.targets = graph.targetsArray.join(",");
      }
      delete assigned_targets[target]
    }
  }

  i = 0
  // assign new targets
  for(target in new_targets) {
    graph = graphs[i];
    graph.targetsArray.push(target);
    assigned_targets[target] = graph;
    if(graphs[i+1]) {
      if(graph.targetsArray.length >= graphs[i+1].targetsArray.length) {
        i++;
        graph.targets = graph.targetsArray.join(",")
      }
    } else if(graphs[i-1]) {
      if(graph.targetsArray.length >= graphs[i-1].targetsArray.length) {
        graph.targets = graph.targetsArray.join(",")
        i=0;
      }
    } else {
      graph.targets = graph.targetsArray.join(",")
    }
  }


  
}.bind(graphsrv.globalUpdate));

//*****************************************************************************

graphsrv.loadGraph = function(id) {
  var chart = this.graphs[id].chart = new TwentyC.widget.Chart.widget.Chart(); 
  chart.Init({
    width : 500,
    height : 200,
    toolbar : { disabled : true },
    time_tick_size : this.graphs[id].tickSize,
    grid : { horizontal : 19 },
    colors : {
      bgc_graph_label : 'rgba(0,0,0,0.5)'
    },
    __colors : { 
      bgc_container : '#fff',
      bgc_chart : '#efeede',
      bdc_chart : '#b69d87',
      crosshair : '#b69d87',
      grid : '#d38da9'
    },
    title : "Vaping Overview"
  })
  chart.contextMenu.menu.destroy();
  chart.Dock(this.graphs[id].container);
  chart.RemoveGraph(chart.graphs.main)
  chart.RemoveGraph(chart.graphs.volume)
  this.globalUpdate.require(this.graphs[id].source,this.graphs[id].targetsArray)

  this.graphs[id].initialUpdate = function() {
    if(this.initialUpdateDone)
      return;
    var data = graphsrv.globalUpdate.get_data(this.source);
    if(data.length) {
      this.update([], data, data.length, 0); 
    }
    this.initialUpdateDone = true;
  }

  this.graphs[id].update = function(data_e, data_n, add, rm) {
    if(this.busy)
      return;
    var G,t, k, cfg, b=false, j=0, target, target_sane, maintarget;
    var targets = this.targetsArray;
    this.busy = true;
    if(this.type == "multitarget") {
      if(!chart.graphs.main) {
        chart.SetSource(data_e);
        for(t in data_n) {
          for(target in data_n[t].data) {
            if(TwentyC.util.InArray(target, targets) == -1) {
              continue;
            }

            if(this.config.targets) { 
              cfg=this.config.targets[target] || {};
            } else
              cfg={}

            target_sane = target.replace(".","_")
            if(target.charAt(0) == "_" || chart.graphs[target_sane] || maintarget==target_sane)
              continue;
            if(this.dataType == "fping") {
              G = chart.AddGraph(j==0 ? "main" : target_sane, new TwentyC.widget.Chart.widget.VapingOverviewGraph().Init(target, j, cfg));
              G.forceMinY = 0;
            } else if(this.dataType == "sflow") {
              G = chart.AddGraph(j==0 ? "main" : target_sane, new TwentyC.widget.Chart.widget.SFlowOverviewGraph().Init(target, j, cfg));
            }
            if(!j)
              maintarget = target_sane
            j++
          }
        }
      }
    } else if(this.type == "detail") {
      if(!chart.graphs.main) {
        chart.SetSource(data_e);
        target = this.targetsArray[0]
        G = chart.AddGraph("main", new TwentyC.widget.Chart.widget.VapingDetailGraph().Init(target)); 
        G.forceMinY = 0;
      }
    } else {
      throw("Unknown chart type: "+this.type);
    }
    chart.Sync(add,rm);
    this.busy = false;
  }

  this.graphs[id].initialUpdate();

  graphsrv.globalUpdate.afterUpdate.subscribe(function(e, d) {
    var payload = d[0];
    if(payload.type != this.source)
      return;
    this.update(payload.data_e, payload.data_n, payload.added, payload.removed);
  }.bind(this.graphs[id]));
}

// RENDER INOUT

TwentyC.widget.Chart.widget.Chart.prototype.RenderInOut = function(graph, plotA, plotB, plotName) {
  if(!plotA || !plotB)
    return;
  var C = this.canvasDict.plot;
  var x = this.ValueToX(graph, plotA[graph.XAxisField()]) + (graph.plotPointW/2);
  var r = this.ValueToX(graph, plotB[graph.XAxisField()]) + (graph.plotPointW/2);
  var cfg = graph.config.plots[plotName];
  if(!plotA[cfg.plotValue]||!plotB[cfg.plotValue])
    return;
  if(x<=0||r <= 0)
    return;

  var y = this.ValueToY(graph, plotA.in);
  var b = this.ValueToY(graph, plotA.out);
  var y2 = this.ValueToY(graph, plotB.in);
  var b2 = this.ValueToY(graph, plotB.out);

  var payload = { 
    graph : graph,
    chart : this,
    plot_name : plotName,
    line_thickness : cfg.line_thickness,
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

  C.Path(
    cfg.colors.neutral,
    [
      [x+1, y],
      [r, y2],
      [r, b2],
      [x+1, b],
      [x+1, y]
    ],
    "fill"
  );



}

// RENDER HEATMAP

TwentyC.widget.Chart.widget.Chart.prototype.RenderHeatmap = function(graph, plot, plotB, plotName) {
  if(!plot)
    return;

  var g = this.config.grid;
  var C = this.canvasDict.plot;
  var x = this.ValueToX(graph, plot[graph.XAxisField()]);
  var y,b,h,color,cfg = graph.config.plots[plotName];
  var borders = cfg.borders;
  var borderColor;

  y = this.ValueToY(graph, plot.close);
  b = this.ValueToY(graph, plot.open, 1);
  color = cfg.colors.positive;
  borderColor = cfg.colors.border_positive;

  h = b - y

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

  C.Rect(
    x + ((this.plotPointW / 2)-(this.barW / 2)),
    y,
    this.barW,
    this.barW,
    cfg.fill ? payload.colors.primary : null,
    { updateCollisionMap : graph.collisionColor }
  );

  if(plot.data.length>0)
    C.Ctx().globalAlpha = 1/plot.data.length
  var i;
  for(i in plot.data) {
    y = this.ValueToY(graph, graph.toInt(plot.data[i]))
    b = this.ValueToY(graph, plot.low)
    C.Rect(
      x + ((this.plotPointW / 2)-(this.barW / 2)),
      y,
      this.barW,
      b-y,
      cfg.fill ? payload.colors.third : null,
      { updateCollisionMap : graph.collisionColor }
    );
  }
  C.Ctx().globalAlpha = 1
   
  
};

// DETAIl GRAPHS

var DG = TwentyC.widget.Chart.widget.VapingDetailGraph = function() {}
DG.prototype = new TwentyC.widget.Chart.widget.Graph();
DG.prototype.title = "Vaping Detail"
DG.prototype.Init = 
DG.prototype.InitDGPlot = function(target) {
  this.title = target
  this.InitGraph();
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
      fnColor : function(a,b,prev,cur,graph) {
        return graph.LossColor(cur.loss, cur.cnt);
      },
      fnFormat : function(b) { return parseInt(b); }
    },
    cnt : {
      title : "/ ",
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

DG.prototype.FormatTickValue = function(val) {
  return this.toFloat(val).toFixed(2)+"ms";
}
DG.prototype.Id = function() {
  return this.target;
}
TwentyC.widget.Chart.indicators.Register("VapingDetail", DG);

// OVERVIEW GRAPHS

var OG = TwentyC.widget.Chart.widget.VapingOverviewGraph = function() {}
OG.prototype = new TwentyC.widget.Chart.widget.Graph();
OG.prototype.title = "Vaping Overview"
OG.prototype.Init = 
OG.prototype.InitOGPlot = function(target, isOverlay, config) {
  this.title = config && config.title ? config.title : target
  this.InitGraph();
  this.serverConfig = config || {};
  this.config.plots.main.renderFncName = "RenderLine",
  this.config.plots.main.plotValue = "avg"
  this.config.plots.main.fill = false;
  if(this.serverConfig.color)
    this.config.plots.main.colors.neutral = this.serverConfig.color;
  else
    this.config.plots.main.colors.neutral = graph_colors[isOverlay] || "#fff";
  this.tick_size = 25;
  this.precision = 2;
  this.sync_scale = true;
  this.data_type = 1;
  this.y_zoom = 85;
  this.target = target
  this.labels = {
    avg : {
      title : "",
      fnFormat : function(b) { return parseFloat(b).toFixed(2)+"ms" }
    }
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
        avg : parseInt(data.data[this.target].avg*Math.pow(10,this.precision))
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
TwentyC.widget.Chart.indicators.Register("VapingOverview", OG);

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
