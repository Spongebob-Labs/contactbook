import { generateShareToken } from './share-token.util';

describe('generateShareToken', () => {
  it('is always exactly 22 characters', () => {
    for (let i = 0; i < 200; i++) {
      expect(generateShareToken()).toHaveLength(22);
    }
  });

  it('uses only URL-safe base62 characters', () => {
    const token = generateShareToken();
    expect(token).toMatch(/^[0-9A-Za-z]{22}$/);
  });

  it('does not repeat across many calls', () => {
    const tokens = new Set(Array.from({ length: 5000 }, generateShareToken));
    expect(tokens.size).toBe(5000);
  });
});
