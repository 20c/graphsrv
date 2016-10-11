
#graphsrv Change Log

## [Unreleased]
### Added

- py3 support
- visiual indicator when data feed has stopped

### Fixed

- NaN format issues on ms formatted labels

### Changed
### Deprecated
### Removed
### Security

##1.0.6
### Fixed

- fix remote graph embedding

##1.0.5

### Added

- documentation
- graph config attribute size_y: specifies y tick size
- graph config attribute precision_y: specifies y float precision
- graph config attribute sizes_x: specifies valid sizes for the x axis (this is currently not properly
  supported, and currently will only respect the one size that actually matches the timestamp gap in the
  graph data)

### Fixed

- fixed an issue where using an id field other than "avg" would cause the graph not to render

##1.0.4
### Changed
- vodka minimum requirement changed to 2.0.3
- updated static urls in templates to work with vodka request env changes

##1.0.3
### Changed
- vodka minimum requirement changed to 2.0.2

##1.0.2
### Fixed
- fixed issue where graphs would not render on safari
