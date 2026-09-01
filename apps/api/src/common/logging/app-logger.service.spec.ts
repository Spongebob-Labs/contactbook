import { AppLogger } from './app-logger.service';

interface LoggedPayload {
  message: string;
  context?: string;
  trace?: string;
  [key: string]: unknown;
}

/**
 * Regression coverage for a real bug: this class is wired as Nest's own
 * internal logger (main.ts's app.useLogger(logger)), and Nest calls
 * .log(message, context) with a bare STRING in the second position —
 * different from every call site in this app's own code, which always
 * passes an object: logger.info('event', {field: value}). Only visible in
 * production JSON mode; only caught by actually booting NODE_ENV=production
 * in a real container, not by any dev-mode run this whole project.
 */
describe('AppLogger', () => {
  function captureOutput(fn: () => void): string {
    const chunks: string[] = [];
    const capture = ((chunk: string) => {
      chunks.push(chunk);
      return true;
    }) as typeof process.stdout.write;
    const originalStdout = process.stdout.write.bind(process.stdout);
    const originalStderr = process.stderr.write.bind(process.stderr);
    process.stdout.write = capture;
    process.stderr.write = capture;
    try {
      fn();
    } finally {
      process.stdout.write = originalStdout;
      process.stderr.write = originalStderr;
    }
    return chunks.join('');
  }

  function parsePayload(raw: string): LoggedPayload {
    return JSON.parse(raw.trim()) as LoggedPayload;
  }

  it('keeps the app-code (message, meta object) shape intact', () => {
    const logger = new AppLogger(false, 'info');
    const out = captureOutput(() =>
      logger.info('broadcast.enqueued', { cardId: 'abc123' }),
    );
    const payload = parsePayload(out);
    expect(payload.message).toBe('broadcast.enqueued');
    expect(payload.cardId).toBe('abc123');
    expect(payload['0']).toBeUndefined();
  });

  it('treats a bare string second argument as Nest’s context, not meta to spread', () => {
    const logger = new AppLogger(false, 'info');
    const out = captureOutput(() =>
      logger.log('Starting Nest application...', 'NestFactory'),
    );
    const payload = parsePayload(out);
    expect(payload.context).toBe('NestFactory');
    // The historical bug: spreading a string as an object explodes it into
    // character-indexed keys instead of a single `context` field.
    expect(payload['0']).toBeUndefined();
    expect(payload['1']).toBeUndefined();
  });

  it('folds Nest’s error(message, trace, context) 3-arg form into meta.trace', () => {
    const logger = new AppLogger(false, 'info');
    const out = captureOutput(() =>
      logger.error(
        'Something broke',
        'Error: boom\n  at x.ts:1:1',
        'SomeService',
      ),
    );
    const payload = parsePayload(out);
    expect(payload.context).toBe('SomeService');
    expect(payload.trace).toContain('Error: boom');
    expect(payload['0']).toBeUndefined();
  });
});
