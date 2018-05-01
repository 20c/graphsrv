(function($, $tc, $gs) {

$gs.components.register(
  "multitarget",
  {
    "multitarget" : function(options) {
      this.Graph(options)
      this.type = "multitarget"
    }
  },
  "Graph"
);

})(jQuery, twentyc, graphsrv);
