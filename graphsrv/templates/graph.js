(function(url, onload){
  var currentScript = document.currentScript;
  if(!window.twentyc && !window.twentyc_loading) {
    var script = window.twentyc_loading = document.createElement("script");
    script.src = url;
    script.callbacks = [{"script":currentScript, "onload":onload}];
    script.onload = function() {
      script.loaded = true;
      while(this.callbacks.length) {
        var callback = this.callbacks.shift()
        callback.onload(callback.script)
      }
    };
    document.head.appendChild(script);
  } else if(window.twentyc_loading && !window.twentyc_loading.loaded) {
    window.twentyc_loading.callbacks.push({"script":currentScript, "onload":onload});
  } else {
    onload(currentScript)
  }
})("{{ host }}{{ graphsrv.static_url }}js/twentyc.core.js", function(currentScript) {

  // twentyc is now available
  twentyc.libraries.
    require(window.jQuery, "{{ host }}{{ graphsrv.static_url }}js/jquery.js").
    require(false, "{{ host }}{{ graphsrv.static_url }}js/popper.min.js").
    require(false, "{{ host }}{{ graphsrv.static_url }}js/bootstrap.min.js").
    require(window.d3, "{{ host }}{{ graphsrv.static_url }}js/d3.v5.min.js").
    require(window.graphsrv, "{{ host }}{{ graphsrv.static_url }}js/graphsrv.js").
    require(window.graphsrv && window.graphsrv.components.has("{{ type }}"),
            "{{ host }}{{ graphsrv.static_url}}js/graphsrv.{{ type }}.js").
    ready(function() {
      graphsrv.update.host = "{{ host }}";
        var instance = graphsrv.instances["{{ id }}"] = graphsrv.components.instantiate(
          "{{ type }}",
          {
            id : "{{ id }}",
            config : {% if graphConfig %}{{ graphConfig }}{% else %}{}{% endif %},
            targets : {% if targets == "all" %}["all"]{% else %}"{{ targets }}".split(","){% endif %},
            type : "{{ type }}",
            fit : "{{ fit }}",
            interval : {{ tickSize }},
            source : "{{ source }}",
            data_type : "{{ dataType }}",
            data : []
          }
        )
      $(currentScript).parent().append(instance.container);
      instance.render_static();
    })
})
