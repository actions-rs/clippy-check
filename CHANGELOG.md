# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
