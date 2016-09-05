This section shows you how to let others embed your graphs on their website

# Allow Cross-domain requests

First you will have to allow cross domain requests to the graph data. You do that by
editing plugins.http.routes as follows:

```yml
plugins:

  - name: http
    type: flask
    
    # ... other flask config omitted ... #

    routes:

      # ... other route config omitted ... #
      
      /graph_data :
        methods:
          - OPTIONS
          - POST
          - GET
        crossdomain:
          # allow all origin hosts (can be a list)
          origin: '*'
          # also allow these headers
          headers:
            - 'X-Requested-With'
        target: graphsrv->graph_data
```

# Embed Example

Works with the quickstart example in this documentation.

```html
<div>
<script src="http://localhost:7026/graph/?source=source_a.first&targets=all&config=multitarget&id=test"></script>
</div>
```

## Url Paremeters

#### source

should be <data_type>.<group_name>, where <data_type> is usually also identical to the name of the plugin providing the data. For the quickstart example that would be "source_a.first"

#### targets 

can be 'all' or a comma separated list of targets, where a target is a plot (as idenitified by its id field), for the quickstart example it could also be 'a' or 'a,b'.

#### config

name of graph config to use

#### fit 

if 'yes', graph will be fitted to the containing element - this also you to scale the graph by setting the size of the containing div.

#### id
 
a unique arbitrary id for the graph element
