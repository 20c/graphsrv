(function($, $tc, $gs) {

$gs.components.register(
  "multitarget",
  {
    "multitarget" : function(options) {
      this.Graph(options)
      this.type = "multitarget"
    },
    "tick_size_x" : function() {
      var domain = this.scales.x.domain();
      var diff = (domain[1] - domain[0])/ 1000;
      if(diff < 60)
        return d3.timeSecond.every(5);
      else if(diff < 120)
        return d3.timeSecond.every(10);
      else if(diff < 180)
        return d3.timeSecond.every(30);
      else if(diff < 300)
        return d3.timeMinute.every(1);
      else
        return d3.timeMinute.every(3);
    }
  },
  "Graph"
);

})(jQuery, twentyc, graphsrv);
