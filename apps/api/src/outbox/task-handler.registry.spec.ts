import { TaskHandlerRegistry } from './task-handler.registry';

describe('TaskHandlerRegistry', () => {
  it('returns the registered handler for its kind', () => {
    const registry = new TaskHandlerRegistry();
    const handler = jest.fn().mockResolvedValue(undefined);
    registry.register('send_whatsapp_otp', handler);
    expect(registry.get('send_whatsapp_otp')).toBe(handler);
  });

  it('returns undefined for an unregistered kind rather than throwing', () => {
    const registry = new TaskHandlerRegistry();
    expect(registry.get('nonexistent')).toBeUndefined();
  });

  it('refuses to register the same kind twice', () => {
    const registry = new TaskHandlerRegistry();
    registry.register('send_whatsapp_otp', jest.fn());
    expect(() => registry.register('send_whatsapp_otp', jest.fn())).toThrow(
      /already registered/,
    );
  });
});
