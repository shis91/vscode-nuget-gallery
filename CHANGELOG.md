# Change Log

All notable changes to the "vscode-nuget-gallery" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Support for Central Package Management (CPM)
  - Automatically detects and resolves package versions from `Directory.Packages.props`
  - Respects individual project opt-out via `<ManagePackageVersionsCentrally>false</ManagePackageVersionsCentrally>`
  - Prevents `--no-restore` bug that causes versions to be added to project files when CPM is enabled
  - Automatically refreshes all projects when updating packages in CPM-enabled solutions
- Package update functionality (remove and re-add with new version)

### Changed

- Forked from [pcislo/vscode-nuget-gallery](https://github.com/pcislo/vscode-nuget-gallery)
- Updated repository information and author details

### Removed

- Azure Pipelines CI/CD configuration
- Telemetry (temporarily disabled, pending new configuration)
- Sponsor functionality

**Note:** This fork is maintained by [@shis91](https://github.com/shis91). Special thanks to [Patryk Cisło](https://github.com/pcislo) for creating the original extension.

## [1.2.4]

### Fix

- Fix `Installed` tab error for Windows

## [1.2.3]

### Fix

- Respect proxy settings when making requests to repository endpoints
- Changed error handling to correctly log AxiosErrors
- Missing package versions

### Added

- Package info and dependencies
- Option to skip restore when adding package

## [1.1.0]

### Added

- Package info and dependencies

## [1.0.0]

- Initial release
