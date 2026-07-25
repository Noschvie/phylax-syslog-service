# Changelog

All notable changes to this project will be documented in this file.

The format is based on "Keep a Changelog" and aims to make it easy for
contributors and users to follow meaningful changes over time.

Unreleased
----------

### Added
- Integrated HeartbeatSender into the main application startup (src/index.js) to support periodic health monitoring via UDP heartbeat messages.

### Changed
- Updated ESLint configuration to use modern Flat Config format (eslint.config.js) with ESLint 10.8.0
- Migrated Prettier configuration to dedicated `.prettierrc` file for better tooling compatibility
- Removed legacy ESLint and Prettier configuration from package.json to avoid conflicts
- Enhanced `.prettierignore` to properly exclude build artifacts, config files, and Docker configurations
- Installed `eslint-plugin-import` to support import validation in Flat Config

Guidelines
----------
- Add a short, plain-language entry for each pull request or notable change.
- Use categories such as Added, Changed, Deprecated, Removed, Fixed, Security.
- Keep entries under Unreleased until you create a release tag, then move them
  under the release date/version.

Example entry
-------------
```markdown
### Fixed
- Prevent crash when X is missing on startup (PR #123)
```
