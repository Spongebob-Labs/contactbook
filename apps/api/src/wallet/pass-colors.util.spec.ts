import {
  contrastRatio,
  resolveBackgroundHex,
  resolvePassTheme,
} from './pass-colors.util';

/**
 * The pass must be the same colours as the card on screen. These values are the web's
 * `template-palettes.ts` (ground / ink / inkSoft); a palette edited there needs the same edit
 * here, and this spec is what makes forgetting visible.
 */
describe('resolvePassTheme', () => {
  it('uses the web palette, not the old approximations (Ivory is gold-cream, Sapphire is deep blue)', () => {
    expect(resolvePassTheme(null, 'ivory', null).backgroundHex).toBe('#E7D6BA');
    expect(resolvePassTheme(null, 'sapphire', null).backgroundHex).toBe(
      '#142C63',
    );
    expect(resolvePassTheme(null, 'mint', null).backgroundHex).toBe('#BFF6EC');
  });

  it('gives every palette its authored two-tone ink', () => {
    const sapphire = resolvePassTheme(null, 'sapphire', null);
    expect(sapphire.inkHex).toBe('#FFFFFF');
    expect(sapphire.inkSoftHex).toBe('#A2ABC1');
    expect(sapphire.foregroundColor).toBe('rgb(255, 255, 255)');
    expect(sapphire.labelColor).toBe('rgb(162, 171, 193)');

    const ivory = resolvePassTheme(null, 'ivory', null);
    expect(ivory.inkHex).toBe('#0F1114');
    expect(ivory.inkSoftHex).toBe('#4F4229');
  });

  it("carries the web palette's gradient stops (the pass background is that gradient)", () => {
    const sapphire = resolvePassTheme(null, 'sapphire', null);
    expect(sapphire.gradientFromHex).toBe('#1B3B80');
    expect(sapphire.gradientToHex).toBe('#0C1D45');
    const free = resolvePassTheme('#336699', null, null);
    expect(free.gradientFromHex).not.toBe(free.gradientToHex);
  });

  it('keeps both inks readable (>= 4.5:1) on every palette', () => {
    for (const id of [
      'onyx',
      'sapphire',
      'emerald',
      'oxblood',
      'rust',
      'amber',
      'clay',
      'pistachio',
      'periwinkle',
      'mint',
      'ivory',
    ]) {
      const t = resolvePassTheme(null, id, null);
      expect(contrastRatio(t.backgroundHex, t.inkHex)).toBeGreaterThanOrEqual(
        4.5,
      );
      expect(
        contrastRatio(t.backgroundHex, t.inkSoftHex),
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('follows the web precedence: groundHex > paletteId > the template palette', () => {
    expect(resolveBackgroundHex('#112233', 'ivory', 'marigold')).toBe(
      '#112233',
    );
    expect(resolveBackgroundHex(null, 'ivory', 'marigold')).toBe('#E7D6BA');
    expect(resolveBackgroundHex(null, null, 'marigold')).toBe('#E1AA40'); // amber
    expect(resolveBackgroundHex(null, null, 'meridian')).toBe('#142C63'); // sapphire
    expect(resolveBackgroundHex(null, 'nope', 'nope')).toBe('#142C63');
  });

  it('derives readable inks for a free colour (no authored pair)', () => {
    const dark = resolvePassTheme('#101820', null, null);
    expect(dark.inkHex).toBe('#FFFFFF');
    const light = resolvePassTheme('#F2E7D3', null, null);
    expect(light.inkHex).toBe('#0F1114');
    for (const t of [dark, light]) {
      expect(
        contrastRatio(t.backgroundHex, t.inkSoftHex),
      ).toBeGreaterThanOrEqual(4.5);
    }
  });
});
