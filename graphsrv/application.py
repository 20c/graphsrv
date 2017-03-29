from __future__ import division
#from builtins import str
from builtins import range
from past.utils import old_div
from builtins import object
import uuid
import copy
import os
import time

import vodka.app
import vodka.data
import vodka.data.renderers
import vodka.config
import vodka.plugins
import vodka.plugins.zeromq

import graphsrv.group

#FIXME: these need to be abstracted in wsgi plugin
from flask import request

class GraphSourcePlugin(vodka.plugins.TimedPlugin):
    """
    Graph data source plugin
    """

    @property
    def type_name(self):
        return self.get_config("type")

    def push(self, plots, ts=None):
        if not ts:
            ts = time.time()

        vodka.data.handle(
            self.type_name,
            {
                "data": plots,
                "ts" : ts
            },
            data_id=self.name,
            caller=self
        )




class Graph(object):

    class Configuration(vodka.config.Handler):

        format_y = vodka.config.Attribute(
            str,
            default="ms",
            #FIXME: should be dynamic
            choices=["ms"],
            help_text="formatter for y axis labels"
        )

        precision_y = vodka.config.Attribute(
            int,
            default=2,
            help_text="float precision"
        )

        size_y = vodka.config.Attribute(
            float,
            default=0.25,
            help_text="tick size on the y axis"
        )

        sizes_x = vodka.config.Attribute(
            list,
            default=[3000],
            help_text="valid sizes for the x axis - this should be a list of intervals you want to support for viewing. (ms)"
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



@vodka.app.register('graphsrv')
class GraphServ(vodka.app.WebApplication):
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

        groups = vodka.config.Attribute(
            dict,
            default={},
            help_text="data groups"
        )

        includes = vodka.config.Attribute(
            dict,
            default={
                "js" : {
                    "jquery" : {"path":"graphsrv/js/jquery.js"},
                    "graphsrv.oview": {"path":"graphsrv/js/graphsrv.oview.js", "order":1}
                },
                "css": {
                    "bootstrap" : {"path":"graphsrv/media/bootstrap.css"},
                    "graphsrv" : {"path":"graphsrv/media/graphsrv.css", "order":1}
                }
            },
            handler=lambda x,y: vodka.config.shared.Routers(dict, "includes:merge", handler=SharedIncludesConfigHandler),
            help_text="allows you to specify extra media includes for js,css etc."
        )

    # application methods

    def setup(self):
        super(GraphServ, self).setup()
        self.layout_last_sync = 0
        graphsrv.group.add_all(self.get_config("groups"))

    def data(self, source):
        data, _ = graphsrv.group.get_from_path(source)
        return data

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
            _layout = list(layouts.values())[0]

        layout = copy.deepcopy(_layout)

        source = layout.get("source", request.args.get("source"))

        if source:
            title = layout.get("title", source)
        else:
            title = layout.get("title", "overview")

        sources = [source]

        ids = 1

        if layout.get("type") == "index":
            # index layout, auto generate grid

            grid = [int(x) for x in layout.get("grid", "3x3").split("x")]

            sources = layout.get("sources", graphsrv.group.get_paths())

            layout["layout"] = [
                {
                    "cols" : [
                        {
                            "graph" : copy.deepcopy(layout.get("graph")),
                            "width" : int(old_div(12,grid[0]))
                        } for _ in range(0, grid[0])
                    ],
                    "height" : float(old_div(100.00,float(grid[1])))
                } for _ in range(0, grid[1])
            ]


        for row in layout.get("layout"):
            for col in row.get("cols",[]):
                if "graph" in col:
                    cfg = graphs.get(col["graph"].get("config"))
                    if "targets" not in cfg:
                        cfg["targets"] = [{"target":"all"}]

                    col["graph"]["config_dict"] =cfg
                    if layout.get("type") == "index":
                        if sources:
                            col["graph"]["source"] = sources.pop(0)
                        if not col["graph"].get("id"):
                            col["graph"]["id"] = "auto-%s" % ids
                            ids +=1
                    else:
                        col["graph"]["source"] = sources[0]

        return self.render(
            "overview.html",
            self.wsgi_plugin.request_env(layout=layout, source=source, title=title)
        )

    def graph_view(self):
        """
        Renders graph.js
        """

        source = request.args.get("source")

        if not source:
            raise ValueError("No source specified")

        data_type = self.data_type(source)

        graphs = self.config.get("graphs")

        source_config = graphsrv.group.get_config_from_path(source)

        if "config" in request.args:
            graph_config = graphs.get(request.args.get("config"))
        else:
            graph_config = {}

        valid_tick_sizes = graph_config.get("sizes_x", [3000])
        tick_size = int(request.args.get("size", valid_tick_sizes[0]))

        if tick_size not in valid_tick_sizes:
            tick_size = valid_tick_sizes[0]

        graph_types = []
        for _, g in list(graphs.items()):
            if g.get("type") not in graph_types:
                graph_types.append(g.get("type"))


        variables = {
            "type" : request.args.get("type", "multitarget"),
            "source" : source,
            "graph_types" : graph_types,
            "graphConfig" : graph_config,
            "maxTicks" : int(self.config.get("max_ticks", 500)),
            "dataType" : data_type,
            "tickSize" : tick_size,
            "targets" : request.args.get("targets", ""),
            "fit" : request.args.get("fit", "no"),
            "id" : request.args.get("id", str(uuid.uuid4()))
        }

        # for detail charts we only allow one target
        if variables["type"] in ["detail"]:
            variables["targets"] = variables["targets"].split(",")[0]

        self.sync_layout_config()

        variables["graphConfig"]["targets"] = graphsrv.group.get_config_from_path(source).get("targets")

        return self.render("graph.js", self.wsgi_plugin.request_env(**variables))

    def collect_targets(self, data, source):
        for row in self.data(source):
            for target in list(row["data"].keys()):
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
                for target,bars in list(rdata.items()):
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



