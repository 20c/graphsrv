## Layout

Edit the layout file that you have specified in apps.graphsrv.layout_config_file to add new layouts or edit existing ones. Graphsrv will automatically reload changes to the file while it's running, and they should be visible after a page reload.

```yml
{!examples/customize_layout/structure.yml!}
```

Layouts are indexed by their name, names can be whatever you want them to be, but there are two required ones that should exist in any layout config.

- index - the index layout rendered at /
- detail - the layout used to render a graph group after clicking through from the index page

### Layout types

#### index

Index layout types allow you to quickly generate a grid to render multiple graph groups

```yml
{!examples/customize_layout/index.yml!}
```

If you wish, however, you may normally define the index layout as well

```yml
{!examples/customize_layout/index_manual_layout.yml!}
```

#### custom

Custom layouts are completely customizable using bootstrap to render a responsive grid

```yml
{!examples/customize_layout/custom.yml!}
```

### Custom Layout Example

In this example we make a layout that evenly distributes all plots of a graph group 

The layout will render two rows of full width graphs

```yml
{!examples/customize_layout/test.yml!}
```

In order to view this layout specify the layout paramter and a graph group as source in this URL paremeters

```
/?layout=test&source=source_a.first
```
