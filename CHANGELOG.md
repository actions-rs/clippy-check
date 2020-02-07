# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

### [1.0.6] - 2020-02-07

### Fixed

- Correctly passing `toolchain` input to the cargo invocation (#31)

### [1.0.5] - 2019-10-29

### Added

- Input `name` to rename created Check result (#11)

### Fixed

- Multiple Action executions in one workflow were not displayed,
    use `name` input to separate them (#11)

## [1.0.4] - 2019-10-04

### Added

- Falling back to the stdout report if token permissions are not allowing to post Check annotations (#2)

## [1.0.3] - 2019-10-01

### Fixed

- Properly sending check annotations in the Check Update calls (#1)

## [1.0.2] - 2019-09-27

### Added

- Action will fail if clippy exits with a non-zero code
- Clippy output is added to the Action logs (JSON format)

### Fixed

- Usually used `-- -D warnings` parameter in the `args` input will not break Action execution

## [1.0.1] - 2019-09-27

### Fixed

- Successful check without any warnings or errors was not terminated properly

## [1.0.0] - 2019-09-27

### Added

- First public version
