import os
import vodka

from vodka.plugins.wsgi import WSGIPlugin
vodka.run(
    os.environ.get("VODKA_CONFIG_DIR", ".")
)
application = WSGIPlugin.wsgi_application
