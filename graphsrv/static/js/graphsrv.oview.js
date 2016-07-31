if(typeof window.TwentyC == "undefined")
  TwentyC= {Modules:{loaded:{}}};
graphsrvOverview = {
  
  initTextMonitor : function(name) {
    return;

    var container = $('<div>').addClass("overview-file");

    var update = function() {
      $.get('/overview_read_file', { name : name, x : new Date().getTime() }, function(r) {
        var content = JSON.parse(r).content
        container.html(content);
      });
    }
    var scriptTags = document.getElementsByTagName('script');
    var par = scriptTags[scriptTags.length-1].parentNode;
    $(par).append(container);



    update();
    container.data('timer', setInterval(update, 1000));

  }
}
