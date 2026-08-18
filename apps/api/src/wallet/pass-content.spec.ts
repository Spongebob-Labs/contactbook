import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildManifest,
  buildPassBundle,
  buildPassImages,
  buildPassJson,
  passInputFromSnapshot,
  type PassConfig,
  type PassInput,
} from "./pass-content";
import { hexToRgb, solidPng } from "./solid-png";

const CONFIG: PassConfig = {
  passTypeIdentifier: "pass.ai.shavastudios.contactbook",
  teamIdentifier: "ABCDE12345",
  organizationName: "ContactBook",
};

const INPUT: PassInput = {
  slug: "vansh-work-k7qm9x2r",
  shareUrl: "https://cb.app/c/vansh-work-k7qm9x2r",
  displayName: "Vansh Mehta",
  title: "SDE Intern",
  company: "Microsoft",
  backgroundHex: "#1B2430",
  foregroundHex: "#F8F7F4",
};

describe("passInputFromSnapshot", () => {
  const snapshot = {
    identity: { displayName: "Vansh Mehta", title: "SDE Intern", company: "Microsoft" },
    theme: { background: { kind: "solid", color: "#14342A" }, textColor: "#F1F6F2" },
  };

  it("reads the four fields the pass face needs", () => {
    const input = passInputFromSnapshot(snapshot, "s", "https://x/c/s");
    expect(input).toMatchObject({
      displayName: "Vansh Mehta",
      title: "SDE Intern",
      company: "Microsoft",
      backgroundHex: "#14342A",
      foregroundHex: "#F1F6F2",
    });
  });

  it("takes the first stop of a gradient background", () => {
    const input = passInputFromSnapshot(
      { theme: { background: { kind: "gradient", from: "#312E81", to: "#BE185D" } } },
      "s",
      "https://x/c/s",
    );
    expect(input.backgroundHex).toBe("#312E81");
  });

  it("degrades to a name-only pass on an unexpected shape", () => {
    for (const bad of [null, undefined, 42, "nope", {}, { identity: null }]) {
      const input = passInputFromSnapshot(bad, "s", "https://x/c/s");
      expect(input.displayName).toBe("Contact card");
      expect(input.backgroundHex).toBe("#1B2430");
    }
  });
});

describe("buildPassJson", () => {
  const pass = () => JSON.parse(buildPassJson(INPUT, CONFIG));

  it("carries the identifiers Wallet validates against the certificate", () => {
    expect(pass()).toMatchObject({
      formatVersion: 1,
      passTypeIdentifier: CONFIG.passTypeIdentifier,
      teamIdentifier: CONFIG.teamIdentifier,
      organizationName: "ContactBook",
    });
  });

  it("uses the slug as a stable serial so re-issuing replaces the pass", () => {
    expect(pass().serialNumber).toBe(INPUT.slug);
  });

  it("encodes the share URL as the QR barcode", () => {
    expect(pass().barcodes).toEqual([
      {
        format: "PKBarcodeFormatQR",
        message: INPUT.shareUrl,
        messageEncoding: "iso-8859-1",
      },
    ]);
  });

  it("converts theme hex into the rgb() strings Wallet expects", () => {
    expect(pass().backgroundColor).toBe("rgb(27, 36, 48)");
    expect(pass().foregroundColor).toBe("rgb(248, 247, 244)");
  });

  it("puts the name on the front and omits role fields when absent", () => {
    expect(pass().generic.primaryFields).toEqual([
      { key: "name", label: "", value: "Vansh Mehta" },
    ]);
    const bare = JSON.parse(
      buildPassJson({ ...INPUT, title: "", company: "" }, CONFIG),
    );
    expect(bare.generic.secondaryFields).toEqual([]);
  });

  it("never prints contact details, which would freeze at issue time", () => {
    const json = buildPassJson(INPUT, CONFIG);
    expect(json).not.toContain("+971");
    expect(json).not.toMatch(/TEL|EMAIL/);
  });
});

describe("buildManifest", () => {
  it("maps each file to its SHA-1", () => {
    const manifest = JSON.parse(
      buildManifest([{ name: "pass.json", data: Buffer.from("abc") }]),
    );
    // Known SHA-1 of "abc".
    expect(manifest["pass.json"]).toBe(
      "a9993e364706816aba3e25717850c26c9cd0d89d",
    );
  });

  it("covers every payload file, and neither itself nor the signature", () => {
    const { files, manifest } = buildPassBundle(INPUT, CONFIG);
    const parsed = JSON.parse(manifest.toString());
    expect(Object.keys(parsed).sort()).toEqual(
      files.map((f) => f.name).sort(),
    );
    expect(parsed["manifest.json"]).toBeUndefined();
    expect(parsed.signature).toBeUndefined();
  });

  it("includes icon.png, without which Wallet refuses the pass", () => {
    const { files } = buildPassBundle(INPUT, CONFIG);
    expect(files.map((f) => f.name)).toContain("icon.png");
  });
});

describe("solidPng", () => {
  it("emits the PNG signature and terminates with IEND", () => {
    const png = solidPng(29, hexToRgb("#C4A882"));
    expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(png.subarray(-8).toString("ascii")).toContain("IEND");
  });

  it("records the requested dimensions in IHDR", () => {
    const png = solidPng(58, hexToRgb("#000000"));
    // IHDR width/height sit at bytes 16..24, after signature + length + type.
    expect(png.readUInt32BE(16)).toBe(58);
    expect(png.readUInt32BE(20)).toBe(58);
  });

  it("falls back to a neutral colour on malformed hex", () => {
    expect(hexToRgb("nope")).toEqual({ r: 27, g: 36, b: 48 });
    expect(hexToRgb("#C4A882")).toEqual({ r: 196, g: 168, b: 130 });
  });

  it("produces images the icon set actually needs", () => {
    expect(buildPassImages(INPUT).map((f) => f.name)).toEqual([
      "icon.png",
      "icon@2x.png",
      "logo.png",
      "logo@2x.png",
    ]);
  });
});

describe("generated PNGs, validated by the system decoder", () => {
  let dir: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "cb-png-"));
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function decode(size: number): string | null {
    const path = join(dir, `icon-${size}.png`);
    writeFileSync(path, solidPng(size, hexToRgb("#C4A882")));
    try {
      return execFileSync("file", ["-b", path]).toString();
    } catch {
      return null;
    }
  }

  it("are recognised as valid PNGs at the right dimensions", () => {
    const described = decode(29);
    if (described === null) {
      return; // `file` unavailable; the structural assertions above still hold.
    }
    expect(described).toContain("PNG image data");
    expect(described).toContain("29 x 29");
  });
});
