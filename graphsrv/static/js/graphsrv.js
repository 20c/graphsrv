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
  host : '',
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
    }
    if(!this.ffa[type]) {
      this.ffa[type] = {}
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

    TwentyC.cla.XHR.send("POST", this.host+"/graph_data/", {
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
        this.afterUpdate.fire({"type" : type, "ts" : ts, "data_e" : data_e, "data_n" : data_n, "added" : add, "removed" : rm});
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
 
  var typ,target,targets,graph,i,idx,pl = d[0];

  var graphs = {}, _graphs, prev_targets = {}, curr_targets = {}, new_targets ={}, dropped_targets={};
  var assigned_targets = this.ffa[pl.type];
  var assigned_target, dropped_target;

  // first we figure out which targets got added / dropped
  for(i = 0; i <  pl.data_e.length; i++) {
    for(target in pl.data_e[i].data) {
      if(pl.data_e[i].ts < pl.ts)
        prev_targets[target]=true;
    }
  }

  for(i = 0; i <  pl.data_n.length; i++) {
    for(target in pl.data_n[i].data) {
      if(!prev_targets[target]) {
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
  var n = 0, graph_types = graphsrv.graph_types();
  for(i in graph_types) {
    typ = graph_types[i];
    _graphs = graphsrv.graphs_for_type(typ);
    graphs[typ] = []
    for(i in _graphs) {
      graph = _graphs[i];

      if(graph.source == pl.type && graph.isFFA) {
        graphs[typ].push(graph);
        n++;
      }
    }
  }

  if(!n)
    return;

  for(typ in graphs)
    graphs[typ].sort(function(a,b) { return a.targetsArray.length - b.targetsArray.length });

  // unassign dropped targets
  for(target in dropped_targets) {
    for(assigned_target in assigned_targets[target]) {
      if((graph = assigned_targets[assigned_target])) {
        idx = TwentyC.util.InArray(target,graph.targetsArray);
        if(idx > -1) {
          graph.targetsArray.splice(idx,1);
          graph.targets = graph.targetsArray.join(",");
        }
        delete assigned_targets[assigned_target];
      }
    }
  }

  // assign new targets
  for(typ in graphs) {
    i = 0
    for(target in new_targets) {
      graph = graphs[typ][i];
      if(!graph)
        break;
      graph.targetsArray.push(target);
      if(!assigned_targets[target])
        assigned_targets[target] = {}
      assigned_targets[target][typ] = graph;
      if(graphs[typ][i+1]) {
        if(graph.targetsArray.length >= graphs[typ][i+1].targetsArray.length) {
          i++;
          graph.targets = graph.targetsArray.join(",")
        }
      } else if(graphs[typ][i-1]) {
        if(graph.targetsArray.length >= graphs[typ][i-1].targetsArray.length) {
          graph.targets = graph.targetsArray.join(",")
          i=0;
        }
      } else {
        graph.targets = graph.targetsArray.join(",")
      }
    }
  }

  
}.bind(graphsrv.globalUpdate));

//*****************************************************************************

graphsrv.graph_types = function() {
  var i, types=[], typ;
  for(i in this.graphs) {
    typ = this.graphs[i].type;
    if($.inArray(typ, types) == -1)
      types.push(typ)
  }
  return types;
}

graphsrv.graphs_for_type = function(typ) {
  var graphs = {}, i;
  for(i in this.graphs) {
    if(typ == this.graphs[i].type)
      graphs[i] = this.graphs[i];
  }
  return graphs;
}

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
    title : "Overview"
  })
  chart.contextMenu.menu.destroy();
  chart.Dock(this.graphs[id].container);
  chart.RemoveGraph(chart.graphs.main)
  chart.RemoveGraph(chart.graphs.volume)
  this.globalUpdate.require(this.graphs[id].source,this.graphs[id].targetsSource)

  this.graphs[id].initialUpdate = function() {
    if(this.initialUpdateDone)
      return;
    var data = graphsrv.globalUpdate.get_data(this.source);
    if(data.length) {
      this.update([], data, data.length, 0); 
    }
    this.initialUpdateDone = true;
  }

  this.graphs[id].maxTargets = function() {
    if(this.chart.graphs.main)
      return this.chart.graphs.main.maxTargets || 0;
    return 0;
  },

  this.graphs[id].update = function(data_e, data_n, add, rm) {
    if(this.busy)
      return;
    var G,t, k, cfg, b=false, j=0, target, target_sane, maintarget;
    var targets = this.targetsArray;
    this.busy = true;
    var graphClass = TwentyC.widget.Chart.indicators.dict[this.type];
    if(!graphClass)
      throw("Unknown graph type "+this.type);
    else {
      if(!chart.graphs.main) {
        chart.SetSource(data_e);
        graphClass.instantiate(chart, targets, data_n, data_e, this.config)
      }
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

graphsrv.formatters = {
  get : function(name) {
    if(typeof this[name] == "function")
      return this[name];
    return function(v) { return v }
  },
  ms : function(value) {
    return parseFloat(value).toFixed(2)+"ms";
  }
}

