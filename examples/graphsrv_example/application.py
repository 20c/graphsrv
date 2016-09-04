import vodka
import vodka.app

# make sure the plugin is available
import graphsrv_example.plugins.test_plot

# we dont do anything with the applet other than to make sure it exists
@vodka.app.register('graphsrv_example')
class MyApplication(vodka.app.Application):
    pass
