from __future__ import division
#from builtins import str
from builtins import range
from past.utils import old_div
from builtins import object

from pkg_resources import get_distribution

import re
import uuid
import copy
import os
import time

import vodka.app
import vodka.data
import vodka.data.renderers
import vodka.config
import vodka.config.shared
import vodka.plugins
import vodka.plugins.zeromq

import graphsrv.group

#FIXME: these need to be abstracted in wsgi plugin

from flask import request, send_file

__version__ = get_distribution('graphsrv').version

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
            help_text="formatter for y axis labels"
        )

        # deperecated
        precision_y = vodka.config.Attribute(
            int,
            default=2,
            help_text="float precision"
        )

        # deprecated
        size_y = vodka.config.Attribute(
            float,
            default=0.25,
            help_text="tick size on the y axis"
        )

        # deprecated
        sizes_x = vodka.config.Attribute(
            list,
            default=[3000],
            help_text="valid sizes for the x axis - this should be a list of intervals you want to support for viewing. (ms)"
        )

        type = vodka.config.Attribute(
            str,
            help_text="graph type"
        )

        plot_y = vodka.config.Attribute(
            str,
            help_text="plot this value on the y axis (data field name)",
            default="avg"
        )

        id_field = vodka.config.Attribute(
            str,
            help_text="the field by which a record in the data set is uniquely identified"
        )

        inspect = vodka.config.Attribute(
            bool,
            default=True,
            help_text="Allow clicking through to a detail view"
        )

        inspect_layout = vodka.config.Attribute(
            str,
            default="detail",
            help_text="layout to direct to for detail view"
        )



@vodka.app.register('graphsrv')
class GraphServ(vodka.app.WebApplication):
    # configuration

    version = __version__

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

        includes = vodka.config.shared.Container(
            dict,
            nested=1,
            share="includes:merge",
            default={
                "js" : {
                    "jquery" : {"path":"graphsrv/js/jquery.js"},
                    "bootstrap" : {"path":"graphsrv/js/bootstrap.min.js"},
                },
                "css": {
                    "bootstrap" : {"path":"graphsrv/media/bootstrap.min.css"},
                    "graphsrv" : {"path":"graphsrv/media/graphsrv.css", "order":1}
                }
            },
            handler=lambda x,y: vodka.config.shared.Routers(dict, "includes:merge", handler=vodka.app.SharedIncludesConfigHandler),
            help_text="allows you to specify extra media includes for js,css etc."
        )

    # application methods

    def setup(self):
        super(GraphServ, self).setup()
        self.layout_last_sync = 0
        graphsrv.group.add_all(self.get_config("groups"))

        # collect graphs that require routes set up for their javascript
        # and css sources

        graph_config = self.config.get("graphs",{})


        for name, graph in graph_config.items():
            js_src = graph.get("javascript")
            css_src = graph.get("css")
            if js_src and hasattr(self, "wsgi_plugin"):
                def serve_js(src = js_src):
                    return send_file(src)
                self.wsgi_plugin.set_route("/static/graphsrv/js/graphsrv.{}.js".format(name), serve_js)
            if css_src and hasattr(self, "wsgi_plugin"):
                def serve_css(src = css_src):
                    return send_file(src)
                self.wsgi_plugin.set_route("/static/graphsrv/media/graphsrv.{}.css".format(name), serve_css)


        if hasattr(self, "wsgi_plugin"):
            self.wsgi_plugin.set_route("/view/<layout>/<source>", self.view, methods=["GET","POST"])


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

            # load base layout
            base_layout = vodka.config.Config()
            base_layout.read(config_file=self.resource("etc/layouts.yaml"))

            # load extended layout
            ext_layout = vodka.config.Config()
            ext_layout.read(config_file=path)

            # merge and set
            self.layouts = base_layout
            self.layouts.data["layouts"].update(**ext_layout.data.get("layouts",{}))

            self.layout_last_sync = mtime

        return self.layouts

    def view(self, layout, source):
        return self._overview_view(layout, source)

    def overview_view(self):
        return self._overview_view(
            request.args.get("layout"),
            request.args.get("source")
        )


    def _overview_view(self, layout_name, source_name):
        """
        Renders the overview which can hold several graphs
        and is built via config
        """
        self.sync_layout_config()

        layouts = self.layouts.get("layouts")
        graphs = self.config.get("graphs")

        if layout_name:
            _layout = layouts.get(layout_name)
        else:
            if source_name:
                #if source name is specified but layout name is not
                #find the first layout that is a custom layout
                _layout = [l for l in layouts.values() if l["type"] == "custom"][0]
            else:
                #if neither source name nor layout name are specified
                #we want to render the index layout
                _layout = layouts.get("index")

        layout = copy.deepcopy(_layout)

        source = layout.get("source", source_name)

        if source:
            title = layout.get("title", source)
        else:
            title = layout.get("title", "overview")

        sources = [source]

        ids = 1

        if layout.get("type") == "index":
            # index layout

            if not layout.get("layout"):
                # auto-generate grid
                grid = [int(x) for x in layout.get("grid", "3x3").split("x")]


                # get all possible sources
                sources = layout.get("sources", graphsrv.group.get_paths())


                sources = [{"source":s,
                            "type":d.get("default_graph","multitarget"),
                            "config":d.get("default_graph","multitarget")}
                            for s,d in sources.items()]

                sources = sorted(sources, key=lambda a: a.get("source"))

                # filter sources matching the index
                #sources = [s for s,d in sources.items()
                #           if layout.get("graph").get("config") == d.get("default_graph","multitarget")]

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

                    if layout.get("type") == "index":
                        if not col["graph"].get("source") and sources:
                            col["graph"].update(sources.pop(0))
                        if not col["graph"].get("id"):
                            col["graph"]["id"] = "auto-%s" % ids
                            ids +=1

                    else:
                        col["graph"]["source"] = sources[0]

                    cfg = graphs.get(col["graph"].get("config"))

                    # default configs
                    if "targets" not in cfg:
                        cfg["targets"] = [{"target":"all"}]
                    if "inspect" not in cfg:
                        cfg["inspect"] = Graph.Configuration.inspect.default
                    if "inspect_layout" not in cfg:
                        cfg["inspect_layout"] = Graph.Configuration.inspect_layout.default

                    col["graph"]["config_dict"] = cfg



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
            "plotConfig" : self.plot_config(graph_config),
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

    def plot_config(self, graph_config):
        """
        converts a graphs plot config to data config
        usable with the new d3 frontend

        FIXME: graph config needs to be refactored
        to be in line with the frontend
        """

        plot_config = {}

        for k, v in graph_config.items():
            m = re.match(r"plot_(.+)", k)
            if m:
                name = m.group(1)
                plot_config.update({
                    "data_{}".format(name) : v,
                    "data_max_{}".format(name) : v,
                    "data_min_{}".format(name) : v,
                })

            m = re.match(r"(min|max)_(.+)", k)
            if m:
                plot_config["data_{}".format(k)] = v

            m = re.match(r"format_(.+)", k)
            if m:
                plot_config[k] = v

        return plot_config

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


    def collect_graph_data(self, data, targets, source, **kwargs):

        """
        collect graph data from specified source

        data <list> - collect into this container
        targets <list> - list of target ids, only collect those targets
        source <str> - storage data id
        ts <float> - if specified only collect targets that were updated past this timestamp (seconds)
        """


        cdata = self.data(source)
        index = {}
        timestamps = kwargs.get("timestamps",{})


        for row in cdata:

            rdata = row["data"]
            _time = row["ts"] * 1000

            for target,bars in list(rdata.items()):
                ts = timestamps.get("ts_{}".format(target))
                if ts and ts >= row["ts"]:
                    continue
                if targets != ["all"] and target not in targets:
                    continue
                bars["time"] = _time
                bars["id"] = target
                if target not in index:
                    index[target] = len(data)
                    data.append([bars])
                else:
                    data[index[target]] += [bars]


    @vodka.data.renderers.RPC(errors=True)
    def graph_data(self, data, *args, **kwargs):
        """
        Returns a json response containing graph data
        """

        targets = request.values.get("targets","").split(",")
        timestamps = dict([(k,float(v)) for k,v in request.values.items()
                          if k.find("ts_") == 0])
        source = request.values.get("source")

        if not source:
            raise ValueError("No source specified")

        if not len(targets):
            raise ValueError("Target targets missing")


        self.collect_graph_data(data, targets, source, timestamps=timestamps)
