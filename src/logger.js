const pino = require('pino');
const fs = require('fs');
const path = require('path');
const config = require('./config');

/**
 * Logger Singleton
 * Following Pino best practices - create once, use everywhere
 * Logs to separate files: error.log, info.log, combined.log
 */

// Ensure logs directory exists
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Create write streams for each log file
const errorStream = fs.createWriteStream(path.join(logsDir, 'error.log'), { flags: 'a' });
const infoStream = fs.createWriteStream(path.join(logsDir, 'info.log'), { flags: 'a' });
const combinedStream = fs.createWriteStream(path.join(logsDir, 'combined.log'), { flags: 'a' });

// Custom stream that routes logs to appropriate files
const streams = [
  // Combined log - all levels
  { stream: combinedStream },
  // Info log - info level and above (info, warn, error, fatal)
  { level: 'info', stream: infoStream },
  // Error log - error level and above (error, fatal)
  { level: 'error', stream: errorStream }
];

// Add console output in development
if (config.logging.pretty && config.server.env === 'development') {
  streams.push({
    stream: pino.transport({
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname'
      }
    })
  });
}

const logger = pino(
  { level: config.logging.level },
  pino.multistream(streams)
);

module.exports = logger;
