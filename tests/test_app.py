import os
import unittest
import pytest
import json
import graphsrv.application
import time
import os.path
import vodka.storage
import vodka
import graphsrv.group

APP_CONFIG = {
    "tmpl_engine" : "jinja2"
}

graphsrv.group.add("test", "a", {"x":{},"y":{}})
vodka.config.instance["home"] = "."

class TestConfig(unittest.TestCase):

    @pytest.fixture(autouse=True)
    def setup(self, tmpdir):
        self.tmpdir = tmpdir.mkdir("tmp")
        d = self.tmpdir.join("layout.json")
        self.layout_config = {"layouts":{}}
        self.layout_config_file = d
        d.write(json.dumps(self.layout_config))
        APP_CONFIG["layout_config_file"] = str(d)
        APP_CONFIG["home"] = os.path.dirname(graphsrv.__file__)
        self.app = graphsrv.application.GraphServ(APP_CONFIG)
        self.app.setup();


    def test_data_type(self):
        self.assertEqual("test", self.app.data_type("test"))

    def test_data(self):
        expected = vodka.storage.storage["test"] = [{"data":{"x":0,"y":1}}]
        self.assertEqual(self.app.data("test.a"), expected)

    def test_collect_graph_data(self):

        def make_points():
            return {"x":{"bla":1}, "y":{"blu":2}}

        vodka.storage.storage["test"] = [
            {"data":make_points(), "ts": 1},
            {"data":make_points(), "ts": 2}
        ]

        r = []
        self.app.collect_graph_data(r, ["x"], "test.a")
        self.assertEqual(
            r,
            [[{"bla": 1,"time":1000,"id":"x"},{"bla":1,"time":2000,"id":"x"}]]
        )

        r = []
        self.app.collect_graph_data(r, ["all"], "test.a")
        print(r)
        self.assertEqual(
            sorted(r, key=lambda x: "blu" in x[0]),
            [[{"bla": 1,"time":1000, "id":"x"},{"bla":1,"time":2000, "id":"x"}],
             [{"blu": 2,"time":1000, "id":"y"},{"blu":2,"time":2000, "id":"y"}]]
        )

        r = []
        self.app.collect_graph_data(r, ["x"], "test.a", timestamps={"ts_x":1})
        self.assertEqual(
            r,
            [[{"bla":1,"time":2000,"id":"x"}]]
        )


    def test_collect_targets(self):

        vodka.storage.storage["test"] = [{"data":{"x":{}, "y":{}}}]
        expected = ["x","y"]
        r = []
        self.app.collect_targets(r, "test.a")
        self.assertEqual(sorted(r), sorted(expected))

    def test_sync_layout_config(self):
        """
        test that layout config is automatically reloaded
        when changed
        """

        self.app.sync_layout_config();

        base_layout = vodka.config.Config()
        base_layout.read(config_file=self.app.resource("etc/layouts.yaml"))

        self.assertEqual(self.app.layouts.data, base_layout.data)

        layout_config = {"layouts":{"test":[]}}
        time.sleep(0.5)
        self.layout_config_file.write(json.dumps(layout_config));
        self.app.sync_layout_config();
        self.assertEqual(layout_config["layouts"]["test"], self.app.layouts.data["layouts"]["test"]);
        self.assertEqual(base_layout.data["layouts"]["index"], self.app.layouts.data["layouts"]["index"]);
        self.assertEqual(base_layout.data["layouts"]["detail"], self.app.layouts.data["layouts"]["detail"]);


