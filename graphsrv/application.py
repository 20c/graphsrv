import uuid
import copy
import os

import vodka.app
import vodka.data
import vodka.config
import vodka.plugins
import vodka.plugins.flaskwsgi
import vodka.plugins.zeromq

#FIXME: these need to be abstracted in wsgi plugin
from flask import request, abort


class Graph(object):
   
    class Configuration(vodka.config.Handler):
        source = vodka.config.Attribute(
            str,
            help_text="data source for this graph (as specified in sources)"
        )

        format_y = vodka.config.Attribute(
            str,
            default="ms",
            #FIXME: should be dynamic
            choices=["ms"],
            help_text="formatter for y axis labels"
        )

        type = vodka.config.Attribute(
            str,
            #FIXME: should be dynamic
            choices=["multitarget", "smokestack"],
            help_text="graph type"
        )

        plot_y = vodka.config.Attribute(
            str,
            help_text="plot this value on the y axis (data field name)"
        )

        id_field = vodka.config.Attribute(
            str,
            help_text="the field by which a record in the data set is uniquely identified"
        )

        targets = vodka.config.Attribute(
            dict,
            default={},
            help_text="list or dict of target config objects"
        )

        @classmethod
        def prepare_targets(cls, value, config={}):
            id_field = config.get("id_field")
            if type(value) == list and id_field:
                r = {}
                for target in value:
                    if type(target) == dict:
                        r[target[id_field]] = target
                    else:
                        r[target] = {id_field : target}
                return r
            return value
                

class GraphServ(vodka.app.WebApplication):
    handle = "graphsrv"

    # configuration

    class Configuration(vodka.app.WebApplication.Configuration):
        
        layout_config_file = vodka.config.Attribute(
            vodka.config.validators.path,
            default=lambda x,i: i.resource("etc/layouts.yaml"),
            help_text="location of your layout configuration file"
        )

        graphs = vodka.config.Attribute(
            dict,
            default={},
            help_text="graph configuration",
            handler=lambda k,v: Graph
        )

    # application methods

    def setup(self):
        super(GraphServ, self).setup()
        self.layout_last_sync = 0

    def data(self, source):
        return vodka.storage.get(source)

    def data_type(self, source):
        return source

    def overview_read_file(self):
        return ""

    def sync_layout_config(self):
        path = self.get_config("layout_config_file")
        mtime = os.path.getmtime(path)


        if not self.layout_last_sync or self.layout_last_sync != mtime:
            self.log.debug("%s has changed, reloading layout config..."%path)
            self.layouts= vodka.config.Config()
            self.layouts.read(config_file=path)
            self.layout_last_sync = mtime

        return self.layouts
        

    def overview_view(self):
        """
        Renders the overview which can hold several graphs
        and is built via config
        """
        self.sync_layout_config()
        
        layouts = self.layouts.get("layouts")
        graphs = self.config.get("graphs")


        if "layout" in request.args:
            _layout = layouts.get(request.args["layout"])
        else:
            _layout = layouts.values()[0]

        layout = copy.deepcopy(_layout)

        for row in layout:
            for col in row.get("cols",[]):
                if "graph" in col:
                    cfg = graphs.get(col["graph"].get("config"))
                    if "targets" not in cfg:
                        cfg["targets"] = [{"target":"all"}]

                    col["graph"]["config_dict"] =cfg


        return self.render(
            "overview.html", 
            self.wsgi_plugin.request_env(layout=layout)
        )
  
    def graph_view(self):
        """
        Renders graph.js
        """

        source = request.args.get("source")
        
        if not source:
            raise ValueError("No source specified")

        data_type = self.data_type(source)

        valid_tick_sizes = [int(s) for s in self.config.get("%s_periods", "3000").split(",")]
        tick_size = int(request.args.get("size", valid_tick_sizes[0]))
        graphs = self.config.get("graphs")
        
        graph_types = []
        for n, g in graphs.items():
            if g.get("type") not in graph_types:
                graph_types.append(g.get("type"))


        variables = {
            "type" : request.args.get("type", "multitarget"),
            "source" : source,
            "graph_types" : graph_types,
            "dataType" : data_type,
            "maxTicks" : int(self.config.get("max_ticks", 500)),
            "tickSize" : tick_size,
            "targets" : request.args.get("targets", ""),
            "fit" : request.args.get("fit", "no"),
            "id" : request.args.get("id", str(uuid.uuid4()))
        } 

        # for detail charts we only allow one target
        if variables["type"] in ["detail"]:
            variables["targets"] = variables["targets"].split(",")[0]

        self.sync_layout_config()
        if "config" in request.args: 
            variables["graphConfig"] = self.config.get("graphs",{}).get(
                request.args["config"]
            )

        return self.render("graph.js", self.wsgi_plugin.request_env(**variables))

    def collect_targets(self, data, source):
        for row in self.data(source):
            for target in row["data"].keys():
                if target not in data and target[0] != "_":
                    data.append(target)


    @vodka.data.renderers.RPC(errors=True)
    def targets(self, data, *args, **kwargs):
        """
        Returns a json response containing all available
        targets (that have been collected from incoming
        data)
        """
        source = request.values.get("source")
        
        if not source:
            raise ValueError("No source specified")

        self.collect_targets(data, source)


    def collect_graph_data(self, data, targets, source, ts=0.0):

        """
        collect graph data from specified source

        data <list> - collect into this container
        targets <list> - list of target ids, only collect those targets
        source <str> - storage data id
        ts <float> - if specified only collect targets that were updated past this timestamp (seconds)
        """

        
        cdata = self.data(source)

        for row in cdata:
            if ts and ts >= row["ts"]:
                continue

            rdata = row["data"]
            
            rv_row = {"ts" : row["ts"], "data":{}}

            if "all" in targets:
                for target,bars in rdata.items():
                    rv_row["data"][target] = bars
            else:
                for target in targets:
                    if target in rdata:
                        rv_row["data"][target] = rdata.get(target)
            
            data.append(rv_row)
 


    @vodka.data.renderers.RPC(errors=True)
    def graph_data(self, data, *args, **kwargs):
        """
        Returns a json response containing graph data
        """

        targets = request.values.get("targets","").split(",")
        ts = float(request.values.get("ts",0))
        source = request.values.get("source")

        if not source:
            raise ValueError("No source specified")

        if not len(targets):
            raise ValueError("Target targets missing")

        self.collect_graph_data(data, targets, source, ts=ts)
        
                    
        
vodka.app.register(GraphServ)
