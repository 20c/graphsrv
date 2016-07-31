if(typeof window.graphsrv == "undefined") {
  window.graphsrv = {
    graphs : {},
    config : {
      maxTicks : {{ maxTicks }}
    },
    syncSize : function(a) {
      var i, g, region;
      for(i in this.graphs) {
        if(a && a != i)
          continue;
        g = this.graphs[i]
        if(g.fit) {
          region = YAHOO.util.Dom.getRegion(g.container.parentNode);
          g.chart.SetConfig({width:region.width-15, height:region.height});
        }
      }
    },
    ready : function() {
      var i, fit=false;
      this.isReady = true;
      TwentyC.widget.Chart.pathImg = "{{ static_url }}media/";
      for(i in this.graphs) {
        this.loadGraph(i);
        if(this.graphs[i].fit == "yes")
          fit = true;
      }
      graphsrv.globalUpdate.requestAll();
      setInterval(function() {
        graphsrv.globalUpdate.requestAll();
      }, 1000);

      if(fit) {
        TwentyC.cla.Event.on(window, "resize", function() {
          graphsrv.syncSize();
        });
        this.syncSize();

      }

    }
  }

  if(typeof window.TwentyC == "undefined")
    window.TwentyC = {};
}

//console.log("Preparing graph", "{{ id }}");
var container = document.createElement('div')
container.id = "graph-{{id}}"
graphsrv.graphs["{{ id }}"] = { 
  id : "{{ id }}",
  config : {% if graphConfig %}{{ graphConfig }}{% else %}{}{% endif %},
  isFFA : {% if targets=="all" %}true{%else%}false{%endif%},
  targets : {% if targets == "all" %}""{% else %}"{{ targets }}"{% endif %},
  targetsArray : {% if targets == "all" %}[]{% else %}"{{ targets }}".split(","){% endif %},
  targetsSource : "{{ targets }}".split(","),
  type : "{{ type }}",
  fit : "{{ fit }}",
  tickSize : {{ tickSize }},
  source : "{{ source }}",
  dataType : "{{ dataType }}",
  data : [],
  container : container
}
var scriptTags = document.getElementsByTagName('script');
var par = scriptTags[scriptTags.length-1].parentNode;

par.appendChild(container);

if(graphsrv.isReady) {
  graphsrv.loadGraph("{{ id }}");
  graphsrv.syncSize("{{ id }}");
}

if(!graphsrv.loadingLibs) {

  graphsrv.loadingLibs = true;
  graphsrv.loadedLibs = false;
  
  var loaders = [
    "{{ static_url }}js/yui.js",
    "{{ static_url }}js/twentyc.core.ext.js",
    "{{ static_url }}js/twentyc.cla.yui2.js",
    "{{ static_url }}js/twentyc.chart.js",
    "{{ static_url }}js/graphsrv.js"
  ]
  {% for graph_type in graph_types %}
  loaders.push("{{ static_url }}js/graphsrv.{{ graph_type }}.js")
  {% endfor %}
    

  var onload = function() {
    loaders.shift();
    if(loaders.length == 0 && !graphsrv.loadedLibs) {
      console.log("READY")
      graphsrv.loadedLibs = true;
      graphsrv.ready();
    }
    return loaders[0]
  };
  var load = function(url) {
    script = document.createElement('script');
    script.onload = function() {
      var next = onload();
      if(next)
        load(next);
    };
    script.type = "text/javascript"
    script.src = url;
    document.head.appendChild(script)
    return script
  }
  load(loaders[0]);

  var style = document.createElement("link")
  style.href = "{{ static_url }}media/style.css"
  style.type = "text/css"
  style.rel = "stylesheet"
  document.head.appendChild(style);
}

