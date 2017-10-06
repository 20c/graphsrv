
# graphsrv Change Log

## [Unreleased]

### Added
### Fixed
### Changed
### Deprecated
### Removed
### Security

## 1.2.0

### Added

- Index layouts can now have manually built layouts

### Fixed

- Fixed (#22) graphserv does not default to "index" layout if any other layout name is present

## 1.1.3

### Added

- Loss percentage for smokestack graphs (#15)

### Fixed

- Sometimes grid lines are drawn over graph lines (#16)
- When resizing on the y axis, first plot is unaffected (#17)
- First plot in multitarget graph does not scale properly (#18)

## 1.1.2

### Fixed

- formatting of graph labels during packet loss in smokestack graph (#14)

## 1.1.1

### Added

- plugin API (#12)

### Fixed

- Smokestack graphs always showing 0 / 0 for loss and count (#13)

## 1.1.0

### Added

- py3 support
- visiual indicator when data feed has stopped
- graphsrv addons may now supply their own media (js / css)

### Fixed

- NaN format issues on ms formatted labels
- legend sorting stabilized to alphapetical sort

### Changed

- removed the black underlay from graph labels and substituted a text shadow effect instead

### Deprecated
### Removed
### Security

## 1.0.6
### Fixed

- fix remote graph embedding

## 1.0.5

### Added

- documentation
- graph config attribute size_y: specifies y tick size
- graph config attribute precision_y: specifies y float precision
- graph config attribute sizes_x: specifies valid sizes for the x axis (this is currently not properly
  supported, and currently will only respect the one size that actually matches the timestamp gap in the
  graph data)

### Fixed

- fixed an issue where using an id field other than "avg" would cause the graph not to render

## 1.0.4

### Changed

- vodka minimum requirement changed to 2.0.3
- updated static urls in templates to work with vodka request env changes

## 1.0.3

### Changed
- vodka minimum requirement changed to 2.0.2

## 1.0.2

### Fixed
- fixed issue where graphs would not render on safari
