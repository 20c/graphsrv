# Example

For this example we will be making a graph that plots random values on the y axis.

graphsrv is built as a vodka application, to create a new source for graph data  
we will need to make an additional vodka applet.

## Install 

```sh
pip install graphsrv
```

## Applet home

Create a directory called 'graphsrv_example' at a location of your choosing

```sh
mkdir -p /path/to/graphsrv_example
cd /path/to/graphsrv_example
```

## Create the applet

Use vodka's bartender CLI to create a new applet structure

```sh
bartender newapp
```

## Plot data plugin

In order to push data for our graph we will create a plugin

Create a file 'plugins/test_plot.py'

```py
{!examples/graphsrv_example/plugin.py!}
```

## Register example application

Next edit 'application.py'

```py
{!examples/graphsrv_example/application.py!}
```

## Configure Layout

Create a file called 'layout.yml'

```yml
{!examples/graphsrv_example/layout.yml!}
```

Note: Graphsrv will automatically reload changes to this while it's running.

## Configure Graphsrv

Create a file called 'config.yml' with the following content

Make sure to edit the following values

- apps.graphsrv.layout_config_file
- apps.graphsrv_example.home
- plugins.http.host
- plugins.http.port

```yml
{!examples/graphsrv_example/config.yml!}
```

## Run

Vodka allows you to run its applications with different wsgi servers, in our config we specified
gevent as our wsgi server. So we make sure that's installed and them simply serve it using bartender

```sh
pip install gevent
```

```sh
bartender serve --config=.
```

## Urls

Once the server is running you should be able to access these paths on your host

### Default index layout
```sh
http://localhost:7041/
```

### Detail view using the 'detail' layout with data for source_a.first
```sh
http://localhost:7041/view/detail/source_a.first
```

### If you have made another index layout 
```sh
http://localhost:7041/view/<layout_name>/all
```


