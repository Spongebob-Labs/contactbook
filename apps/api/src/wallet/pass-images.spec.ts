import sharp from 'sharp';
import {
  BACKGROUND_FILES,
  fetchPhoto,
  renderBackgrounds,
  renderThumbnails,
  THUMBNAIL_FILES,
} from './pass-images';

const THEME = { inkHex: '#FFFFFF' };

async function photo(): Promise<Buffer> {
  // A 400x300 red JPEG: not square, so the crop is exercised.
  return sharp({
    create: {
      width: 400,
      height: 300,
      channels: 3,
      background: { r: 200, g: 30, b: 30 },
    },
  })
    .jpeg()
    .toBuffer();
}

async function pixel(buf: Buffer, x: number, y: number) {
  const { data, info } = await sharp(buf)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const i = (y * info.width + x) * 4;
  return { r: data[i], g: data[i + 1], b: data[i + 2], a: data[i + 3] };
}

describe('renderThumbnails', () => {
  it('produces the three Wallet sizes as real PNGs', async () => {
    const out = await renderThumbnails(await photo(), THEME);
    for (const [name, px] of Object.entries(THUMBNAIL_FILES)) {
      const meta = await sharp(
        out[name as keyof typeof THUMBNAIL_FILES],
      ).metadata();
      expect(meta.format).toBe('png');
      expect(meta.width).toBe(px);
      expect(meta.height).toBe(px);
      expect(meta.hasAlpha).toBe(true);
    }
  });

  it('is a circle: the corners are transparent and the centre is the photo', async () => {
    const out = await renderThumbnails(await photo(), THEME);
    const big = out['thumbnail@3x.png'];
    expect((await pixel(big, 2, 2)).a).toBe(0);
    expect((await pixel(big, 267, 267)).a).toBe(0);
    const centre = await pixel(big, 135, 135);
    expect(centre.a).toBe(255);
    expect(centre.r).toBeGreaterThan(150); // the red photo, not the silhouette
    expect(centre.g).toBeLessThan(80);
  });

  it('falls back to a silhouette (still a valid circle) with no photo', async () => {
    const out = await renderThumbnails(null, THEME);
    const meta = await sharp(out['thumbnail@2x.png']).metadata();
    expect(meta.width).toBe(180);
    expect((await pixel(out['thumbnail@3x.png'], 2, 2)).a).toBe(0);
  });

  it('falls back to the silhouette for bytes that are not an image', async () => {
    const out = await renderThumbnails(Buffer.from('not an image'), THEME);
    expect((await sharp(out['thumbnail.png']).metadata()).width).toBe(90);
  });
});

describe('fetchPhoto', () => {
  const ok = (body: Buffer, headers: Record<string, string> = {}) =>
    jest
      .fn()
      .mockResolvedValue(new Response(new Uint8Array(body), { headers }));

  it('returns the bytes of a clean https image', async () => {
    const bytes = await photo();
    const got = await fetchPhoto('https://cdn.example.test/p.jpg', ok(bytes));
    expect(got?.length).toBe(bytes.length);
  });

  it('refuses anything that is not https, without making a request', async () => {
    const f = ok(Buffer.from('x'));
    expect(await fetchPhoto('http://cdn.example.test/p.jpg', f)).toBeNull();
    expect(await fetchPhoto('file:///etc/passwd', f)).toBeNull();
    expect(await fetchPhoto('not a url', f)).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });

  it('does not follow redirects', async () => {
    const f = ok(Buffer.from('x'));
    await fetchPhoto('https://cdn.example.test/p.jpg', f);
    const [, init] = f.mock.calls[0] as [unknown, RequestInit];
    expect(init).toMatchObject({ redirect: 'error' });
  });

  it('returns null for an error status, an oversized body, or a network failure', async () => {
    expect(
      await fetchPhoto(
        'https://cdn.example.test/p.jpg',
        jest.fn().mockResolvedValue(new Response('no', { status: 404 })),
      ),
    ).toBeNull();
    expect(
      await fetchPhoto(
        'https://cdn.example.test/p.jpg',
        ok(Buffer.from('x'), { 'content-length': String(50 * 1024 * 1024) }),
      ),
    ).toBeNull();
    expect(
      await fetchPhoto(
        'https://cdn.example.test/p.jpg',
        jest.fn().mockRejectedValue(new Error('down')),
      ),
    ).toBeNull();
  });
});

describe('renderBackgrounds', () => {
  const THEME_BG = { gradientFromHex: '#1B3B80', gradientToHex: '#0C1D45' };

  it('renders the 180x220pt background at 1x, 2x and 3x', async () => {
    const out = await renderBackgrounds(THEME_BG);
    for (const [name, scale] of Object.entries(BACKGROUND_FILES)) {
      const meta = await sharp(
        out[name as keyof typeof BACKGROUND_FILES],
      ).metadata();
      expect(meta.format).toBe('png');
      expect(meta.width).toBe(180 * scale);
      expect(meta.height).toBe(220 * scale);
    }
  });

  it('is a real gradient: light stop near the top-left, deep stop near the bottom-right', async () => {
    const out = await renderBackgrounds(THEME_BG);
    const big = out['background@3x.png'];
    const topLeft = await pixel(big, 10, 10);
    const bottomRight = await pixel(big, 529, 649);
    const lum = (p: { r: number; g: number; b: number }) => p.r + p.g + p.b;
    expect(lum(topLeft)).toBeGreaterThan(lum(bottomRight));
    // The ends are the palette's own stops (Sapphire #1B3B80 -> #0C1D45), within a few levels.
    expect(Math.abs(topLeft.b - 0x80)).toBeLessThan(14);
    expect(Math.abs(bottomRight.b - 0x45)).toBeLessThan(14);
  });
});
