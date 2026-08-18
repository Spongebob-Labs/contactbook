import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import QRCode from "qrcode";
import { CardQr } from "@/components/cards/card-qr";

const URL_UNDER_TEST = "https://contactbook.app/c/vansh-work-k7qm9x2r";

function render(url: string, size = 160): string {
  return renderToStaticMarkup(<CardQr url={url} size={size} />);
}

function darkRectCount(svg: string): number {
  // The first rect is the white background; the rest are dark modules.
  return (svg.match(/<rect /g) ?? []).length - 1;
}

describe("CardQr", () => {
  it("renders an svg labelled for screen readers", () => {
    const svg = render(URL_UNDER_TEST);
    expect(svg).toContain("<svg");
    expect(svg).toContain('role="img"');
    expect(svg).toContain("QR code");
  });

  it("draws exactly the dark modules the encoder produced", () => {
    const { modules } = QRCode.create(URL_UNDER_TEST, {
      errorCorrectionLevel: "M",
    });
    const expected = modules.data.reduce<number>(
      (total, bit) => total + (bit ? 1 : 0),
      0,
    );
    expect(darkRectCount(render(URL_UNDER_TEST))).toBe(expected);
  });

  it("indexes modules row-major, matching the encoder's own accessor", () => {
    // A transposed grid still has finder patterns in all three corners, so
    // corner checks cannot catch it — but a mirrored QR does not scan. Compare
    // against the library's get(row, col) directly.
    const { modules } = QRCode.create(URL_UNDER_TEST, {
      errorCorrectionLevel: "M",
    });
    const size = modules.size;
    let asymmetric = 0;
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const rowMajor = modules.data[y * size + x];
        if (rowMajor !== modules.data[x * size + y]) {
          asymmetric += 1;
        }
      }
    }
    // Sanity: the code must not be symmetric, or this test proves nothing.
    expect(asymmetric).toBeGreaterThan(0);
    expect(modules.data[1 * size + 0]).toBe(modules.get(1, 0));
  });

  it("leaves a four-module quiet zone — scanners fail without it", () => {
    const size = 160;
    const svg = render(URL_UNDER_TEST, size);
    const { modules } = QRCode.create(URL_UNDER_TEST, {
      errorCorrectionLevel: "M",
    });
    const cell = size / (modules.size + 8);

    const firstDark = /<rect x="([\d.]+)" y="([\d.]+)"/.exec(svg);
    expect(firstDark).not.toBeNull();
    // Module (0,0) is dark (top-left finder), so the first drawn rect sits
    // exactly one quiet zone in from the edge.
    expect(Number(firstDark![1])).toBeCloseTo(4 * cell, 5);
    expect(Number(firstDark![2])).toBeCloseTo(4 * cell, 5);
  });

  it("scales module size to fill the requested dimension", () => {
    const { modules } = QRCode.create(URL_UNDER_TEST, {
      errorCorrectionLevel: "M",
    });
    const svg = render(URL_UNDER_TEST, 320);
    const expectedCell = 320 / (modules.size + 8);
    const width = /<rect x="[\d.]+" y="[\d.]+" width="([\d.]+)"/.exec(svg);
    expect(Number(width![1])).toBeCloseTo(expectedCell, 5);
  });

  it("encodes different urls differently", () => {
    expect(render("https://a.example/c/one")).not.toBe(
      render("https://a.example/c/two"),
    );
  });

  it("renders nothing for an empty url rather than an empty code", () => {
    expect(render("   ")).toBe("");
  });
});
