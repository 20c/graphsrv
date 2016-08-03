import unittest
import pytest
import json
import graphsrv.application
import time
import os.path
import vodka.storage
import graphsrv.group

APP_CONFIG = {
    "tmpl_engine" : "jinja2"
}

graphsrv.group.add("test", "a", {"x":{},"y":{}})

class TestConfig(unittest.TestCase):

    @pytest.fixture(autouse=True)
    def setup(self, tmpdir):
        self.tmpdir = tmpdir.mkdir("tmp")
        d = self.tmpdir.join("layout.json")
        self.layout_config = {"layouts":{}}
        self.layout_config_file = d
        d.write(json.dumps(self.layout_config))
        APP_CONFIG["layout_config_file"] = str(d)
        self.app = graphsrv.application.GraphServ(APP_CONFIG)
        self.app.setup();

    
    def test_data_type(self):
        self.assertEqual("test", self.app.data_type("test"))

    def test_data(self):
        expected = vodka.storage.storage["test"] = [{"data":{"x":0,"y":1}}]
        self.assertEqual(self.app.data("test.a"), expected)

    def test_collect_graph_data(self):

        points = {"x":{}, "y":{}}
        
        vodka.storage.storage["test"] = [
            {"data":points, "ts": 0},
            {"data":points, "ts": 2}
        ]

        r = []
        self.app.collect_graph_data(r, ["x"], "test.a")
        self.assertEqual(
            r,
            [{"data":{"x":{}},"ts":0},{"data":{"x":{}},"ts":2}]
        )
                
        r = []
        self.app.collect_graph_data(r, ["all"], "test.a")
        self.assertEqual(
            r,
            [{"data":points,"ts":0},{"data":points,"ts":2}]
        )
 
        r = []
        self.app.collect_graph_data(r, ["x"], "test.a", ts=1)
        self.assertEqual(
            r,
            [{"data":{"x":{}},"ts":2}]
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

        print APP_CONFIG

        self.app.sync_layout_config();

        self.assertEqual(self.app.layouts, self.layout_config);

        layout_config = {"layouts":{"test":[]}}
        time.sleep(0.5)
        self.layout_config_file.write(json.dumps(layout_config));
        self.app.sync_layout_config();
        self.assertEqual(layout_config, self.app.layouts.data);


