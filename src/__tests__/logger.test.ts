import { describe, test, expect } from 'bun:test';
import { logger } from '../logger.js';

describe('logger', () => {
  test('exports a pino logger instance with expected methods', () => {
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.fatal).toBe('function');
    expect(typeof logger.trace).toBe('function');
  });

  test('defaults to debug level in non-production', () => {
    expect(logger.level).toBe('debug');
  });

  test('can create child loggers with bound context', () => {
    const child = logger.child({ module: 'test' });
    expect(typeof child.info).toBe('function');
    expect(typeof child.error).toBe('function');
  });

  test('uses level labels via formatters', () => {
    const formatters = (logger as any)[Symbol.for('pino.formatters')];
    if (formatters?.level) {
      expect(formatters.level('info')).toEqual({ level: 'info' });
      expect(formatters.level('error')).toEqual({ level: 'error' });
    }
  });
});
