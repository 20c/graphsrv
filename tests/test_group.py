import unittest
import graphsrv.group
import uuid
import vodka

TEST_DATA = {
    "plot" : [
      {"data": {"1" : {"x":0,"y":0}, "2":{"x":1,"y":1}}}
    ]
}

class TestGroup(unittest.TestCase):

    def test_add_and_get(self):

        data_id = str(uuid.uuid4())

        vodka.storage.storage[data_id] = TEST_DATA["plot"]
        graphsrv.group.add(data_id, "first", {"1":{}, "2":{}})
        graphsrv.group.add(data_id, "second", {"2":{}})

        data, config = graphsrv.group.get(data_id, "first")

        self.assertEqual(data, TEST_DATA["plot"])
        self.assertEqual(config, {"1":{}, "2":{}})

        data, config = graphsrv.group.get(data_id, "second")
        self.assertEqual(data, [{"data":{"2":TEST_DATA["plot"][0]["data"]["2"]}}])

    def test_get_from_path(self):

        data_id = str(uuid.uuid4())

        vodka.storage.storage[data_id] = TEST_DATA["plot"]
        graphsrv.group.add(data_id, "first", {"1":{}, "2":{}})
        data, config = graphsrv.group.get_from_path("{}.{}".format(data_id, "first"))
        self.assertEqual(data, TEST_DATA["plot"])
        self.assertEqual(config, {"1":{}, "2":{}})

    def test_get_config_from_path(self):

        data_id = str(uuid.uuid4())

        vodka.storage.storage[data_id] = TEST_DATA["plot"]
        graphsrv.group.add(data_id, "first", {"1":{}, "2":{}})
        config = graphsrv.group.get_config_from_path("{}.{}".format(data_id, "first"))
        self.assertEqual(config, {"targets":{"1":{}, "2":{}}})


    def test_get_paths(self):
        graphsrv.group.groups = {}

        data_id = str(uuid.uuid4())
        graphsrv.group.add(data_id, "first", {"1":{}, "2":{}})

        paths = graphsrv.group.get_paths()
        self.assertEqual(paths, {"%s.first" % data_id: {"targets":{"1":{}, "2":{}}}})


