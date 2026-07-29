export default async function () {
  // Use an unprivileged port for tests (port 514 requires root)
  process.env.SYSLOG_PORT = process.env.SYSLOG_PORT || '5514';
}