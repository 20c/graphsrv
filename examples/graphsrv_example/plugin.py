import vodka
import vodka.plugins
import vodka.data

import graphsrv.application

import random


@vodka.plugin.register("test_plot")
class TestPlotPlugin(graphsrv.application.GraphSourcePlugin):

    """
    This is a graphsrv source plugin, it allows for quickly pushing
    plots for a graph
    """

    def work(self):

        """
        The work function is called on an interval specified in the
        plugin config
        """

        # self.push pushes plot data for one or more plots, one plot point
        # per graph
        #
        # if you need to push several ticks call push several times and provide
        # custom timestamp values via the 'ts' keyword argument (it defaults
        # to current time)

        self.push(
            [
                # plot a
                {"id": "a", "value": float(random.randint(1, 100))},
                # plot b
                {"id": "b", "value": float(random.randint(100, 200))},
            ]
        )
