import unittest
import pytest
import json
import graphsrv.application
import time
import os.path
import vodka.storage

APP_CONFIG = {
    "tmpl_engine" : "jinja2"
}

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
        expected = vodka.storage.storage["test"] = [{"x":0,"y":1}]
        self.assertEqual(self.app.data("test"), expected)

    def test_collect_graph_data(self):

        points = {"a":{}, "b":{}}
        
        vodka.storage.storage["test"] = [
            {"data":points, "ts": 0},
            {"data":points, "ts": 2}
        ]

        r = []
        self.app.collect_graph_data(r, ["a"], "test")
        self.assertEqual(
            r,
            [{"data":{"a":{}},"ts":0},{"data":{"a":{}},"ts":2}]
        )
                
        r = []
        self.app.collect_graph_data(r, ["all"], "test")
        self.assertEqual(
            r,
            [{"data":points,"ts":0},{"data":points,"ts":2}]
        )
 
        r = []
        self.app.collect_graph_data(r, ["a"], "test", ts=1)
        self.assertEqual(
            r,
            [{"data":{"a":{}},"ts":2}]
        )
 

    def test_collect_targets(self):
        
        vodka.storage.storage["test"] = [{"data":{"a":{}, "b":{}}}]
        expected = ["a","b"]
        r = []
        self.app.collect_targets(r, "test")
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


    def test_prepare_targets(self):
        """
        test preparation of target config
        """

        config = {
            "id_field" : "host"
        }

        data = [
            # target config can be a dict
            {
                "host" : "20c.com",
                "color" : "red"
            },
            # or a simple string
            "127.0.0.1"
        ]

        expected = {
            "127.0.0.1" : { "host" : "127.0.0.1" },
            "20c.com" : {"host" : "20c.com", "color" : "red" }
        }

        result = graphsrv.application.Graph.Configuration.prepare_targets(data, config); 

        self.assertEqual(result, expected)


