import vodka.storage

groups = {}
def add(data_id, group_name, targets):
    if data_id not in groups:
        groups[data_id] = {}
    groups[data_id][group_name] = { 
        "targets" : targets
    }

def get_paths():
    r = []
    for data_id, s in groups.items():
        for group in s.keys():
            r.append("%s.%s" % (data_id, group))
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
    config = groups.get(data_id).get(group_name).get("targets")
    return config

def get(data_id, group_name):
    config = groups.get(data_id).get(group_name)
    data = vodka.storage.get(data_id)
    targets = config.get("targets")
    rv = []
    if data:
        for row in data:
            _row = dict([(k,v) for k,v in row.items() if k != "data"])
            _row["data"] = {}
            for _id,sub in row["data"].items():
                if _id in targets:
                    _row["data"][_id] = sub
            if _row["data"]:
                rv.append(_row)

    return rv, targets
