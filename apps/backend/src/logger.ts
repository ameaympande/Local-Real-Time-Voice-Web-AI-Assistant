import winston from 'winston';
import { serverConfig } from './config.js';

const { combine, timestamp, printf, colorize } = winston.format;

const logFormat = printf(({ level, message, timestamp, module, ...meta }) => {
  const mod = module ? `[${module}]` : '';
  const extra = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
  return `${timestamp} ${level} ${mod} ${message}${extra}`;
});

export const logger = winston.createLogger({
  level: serverConfig.debug ? 'debug' : 'info',
  format: combine(
    timestamp({ format: 'HH:mm:ss.SSS' }),
    logFormat,
  ),
  transports: [
    new winston.transports.Console({
      format: combine(colorize(), logFormat),
    }),
  ],
});

export function createLogger(module: string) {
  return logger.child({ module });
}
