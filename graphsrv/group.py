import vodka.storage
import vodka.config

groups = {}
def add(data_id, group_name, targets=None, **kwargs):
    if data_id not in groups:
        groups[data_id] = {}
    groups[data_id][group_name] = {
        "targets" : targets
    }
    groups[data_id][group_name].update(**kwargs)

def add_all(cfg):
    for data_id, grp in list(cfg.items()):
        for name, targets in list(grp.items()):
            # config is used for commong config and cant be used as
            # a group name
            if name in ["config"]:
                continue
            add(data_id, name, targets=targets, **grp.get("config",{}))

def get_paths():
    r = {}
    for data_id, s in list(groups.items()):
        for group, data in s.items():
            r["{}.{}".format(data_id, group)] = data
    return r

def get_from_path(path):
    t = path.split(".")
    if len(t) != 2:
        raise ValueError("Path needs to be data_id.group_name")
    return get(t[0], t[1])

def get_config_from_path(path):
    t = path.split(".")
    if len(t) != 2:
        raise ValueError("Path needs to be data_id.group_name")
    return get_config(t[0], t[1])

def get_config(data_id, group_name):
    config = groups.get(data_id).get(group_name)
    return config

def get(data_id, group_name):
    config = groups.get(data_id).get(group_name)
    data = vodka.storage.get(data_id)
    targets = config.get("targets")
    rv = []
    if data:
        for row in data:
            _row = dict([(k,v) for k,v in list(row.items()) if k != "data"])
            _row["data"] = {}
            for _id,sub in list(row["data"].items()):
                if _id in targets:
                    _row["data"][_id] = sub
            if _row["data"]:
                rv.append(_row)

    return rv, targets
