# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-10-13

### Changed

- First stable release. The public API is now covered by semantic versioning: breaking changes only in a new major version.

## [0.1.1] - 2026-10-12

### Fixed

- Republish so the npm package page shows the README.

## [0.1.0] - 2026-10-12

### Added

- CLI: `breakhound <package or path>` analyzes an npm package or a local folder.
- TypeScript signature extraction to discover the exported functions and their parameter types.
- Edge case inputs generated from edgegoat for each parameter type.
- Isolated child process runner with per call timeouts, so a hanging or crashing library cannot take down the analysis.
- Oracles:
  - lone surrogate output
  - time zone dependent output
  - unexpected crash
  - NaN leak
  - roundtrip
  - idempotence
  - negative zero sign
  - nondeterminism
- Terminal and JSON output.
- `--fail-on` option to make breakhound exit with a non zero code in CI.

[Unreleased]: https://github.com/kwy404/breakhound/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/kwy404/breakhound/compare/v0.1.1...v1.0.0
[0.1.1]: https://github.com/kwy404/breakhound/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/kwy404/breakhound/releases/tag/v0.1.0
