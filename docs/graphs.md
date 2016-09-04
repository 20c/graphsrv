# Configuration Attributes

#### type
- type:str

graph type, currently supported values:

- 'multitarget': allows rendering of multiple plots 
- 'smokestack': this was developed for vaping, and will need further work to make customizable, it's not recommended to use this outside of vaping at this point.

#### id_field
- type: str

specify which field to use to identify a plot (as it exists in the graph data)

#### format_y
- type: str

formatter for y axis labels, possible values
- '': no formatting
- 'ms': formatting to "xx.xx ms"

#### precision_y
- type: int

float precision of the y axis labels

#### size_y
- type: float

tick size of y axis values, should respect precision defined in precision_y

#### plot_y
- type: str

specify which field to use for plotting y axis values (as it exists in the graph data)

#### sizes_x
- type: list

Not fully implemented feature at this point!

specify which durations you want to be viewable on the graph. Currently only supports the duration that
matches the time gaps in the actual graph data. So a graph source serving plots at 1 second intervals would require this to contain a value of 1000

    sizes_x:
      - 1000
