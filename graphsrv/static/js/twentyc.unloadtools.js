/**
 * Tools for unloading module components
 * This script is loaded as a prepend to RCE loaded module unload script
 * 
 * All functions and variables will be created in the scope of the module's
 * unload script
 */


var UnloadTools = {

  /**
   * Close all windows that match the idi (regexp)
   */

  CloseAllWindows : function(baseId) {

    var i;

    for(i in TwentyC.Windows.list) {
      if(i.match(baseId))  {
        TwentyC.Windows.list[i].Close();
      }
    }
 

  },


  /**
   * Remove Entry from window menu
   */

  RemoveFromWindowMenu : function(itemId, menu) {
    if(TwentyC.widget.WindowMenu.menu) {
      if(!menu)
        var menu = TwentyC.widget.WindowMenu.menu;
      var items = menu.getItems(), item, i, submenu;
      for(i = 0; i < items.length; i++) {
        item = items[i]
        if(item.id.match(itemId)) {
          menu.removeItem(item);
          item.destroy()
        } else if((submenu = item.cfg.getProperty("submenu"))) {
          this.RemoveFromWindowMenu(itemId, submenu);
        }
      }
    }
  },

  /**
   * Remove chart indicator
   */

  RemoveChartIndicator : function(indicatorId) {
    
    // make the indicator unavailable
    TwentyC.util.RemoveFromArray(
      TwentyC.widget.Chart.indicators.list, 
      indicatorId
    );
    delete TwentyC.widget.Chart.indicators.dict[indicatorId];
    
    // remove existing instances for it from all chart windows
    var win, i, ind, n, rlist=[];
    for(i in TwentyC.Windows.list) {
      win = TwentyC.Windows.list[i];
      if(win.chart) {
        for(n in win.chart.chart.graphs) {
          ind = win.chart.chart.graphs[n];
          if(ind.Id() == indicatorId) 
            rlist.push(ind)
        }
        for(i in rlist)
          win.chart.chart.RemoveGraph(rlist[i]);
      }
    }

  }
  
}
