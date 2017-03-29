You may want to override your graphsrv html templates in order to customize them, starting with graphsrv 1.1.0 this is now possible.

create a directory that will hold your template overrides

```sh
mkdir /path/to/my/templates
```

create a file called overview.html inside this directory

```html
{!examples/override_template/overview.html}
```

update the config to let graphsrv know about the directory

```yml
{!examples/override_template/config.yml}
```
