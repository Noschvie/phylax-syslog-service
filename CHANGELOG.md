# Changelog

All notable changes to this project will be documented in this file.

The format is based on "Keep a Changelog" and aims to make it easy for
contributors and users to follow meaningful changes over time.

Unreleased
----------

### Fixed
- Docker health check was always failing: `docker-compose.yml` used a TCP check on port 514 (which is UDP) via `net.createConnection`, overriding the correct `curl`-based HTTP check defined in the Dockerfile. Fixed by replacing the health check in `docker-compose.yml` with `curl -fsS http://127.0.0.1:8080/health`, consistent with the Dockerfile.

### Changed
- Removed redundant `stop_signal: SIGTERM` from `docker-compose.yml` (Docker default).

2026-07-25
----------

### Added
- Integrated HeartbeatSender into the main application startup (src/index.js) to support periodic health monitoring via UDP heartbeat messages.
- Local time support in log files with timezone configuration via TZ environment variable
  - New `formatLocalDateTime()` utility function for proper local timezone handling
  - New `getLocalDateString()` utility for local date calculations
  - TZ variable support in both `.env` and Docker configurations
- Environment configuration best practices documentation:
  - ENV_CONFIGURATION.md - Best practices for managing environment variables
  - ENV_CONSOLIDATION_SUMMARY.md - Summary of .env file consolidation
- Environment-based configuration for Docker:
  - docker-compose.yml and docker-compose_dev.yml now use `${VARIABLE}` syntax for all settings
  - All configuration now comes from `.env` file (single source of truth)
  - Support for environment-specific `.env` files (.env.dev, .env.staging, .env.prod)
- Consolidated `.env.example` template with setup guides for 4 scenarios:
  - Local development (npm start)
  - Docker development (docker-compose)
  - Docker production (docker-compose)
  - Multiple environments (CI/CD with --env-file)

### Changed
- Updated ESLint configuration to use modern Flat Config format (eslint.config.js) with ESLint 10.8.0
- Migrated Prettier configuration to dedicated `.prettierrc` file for better tooling compatibility
- Removed legacy ESLint and Prettier configuration from package.json to avoid conflicts
- Enhanced `.prettierignore` to properly exclude build artifacts, config files, and Docker configurations
- Installed `eslint-plugin-import` to support import validation in Flat Config
- Log timestamps now display in local time instead of UTC for better readability
- syslogMessage.js: `getFormattedLine()` and `getExtendedFormattedLine()` now use local time formatting
- syslogLogger.js: `_getCurrentDate()` now uses local time for file rotation logic
- Dockerfile: Added `tzdata` package to support timezone configuration in Docker containers
- docker-compose.yml: Environment variables now reference `.env` file for centralized configuration
- docker-compose_dev.yml: Environment variables now reference `.env` file for centralized configuration
- `.env.example`: Enhanced with detailed comments and 4 setup scenario guides
- `.env`: Added SYSLOG_LOG_FORMAT and TZ variables
- README.md: Updated with notes about local time and environment configuration

### Removed
- Deprecated `.env.docker.example` (consolidated into `.env.example` with scenario-based documentation)

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
