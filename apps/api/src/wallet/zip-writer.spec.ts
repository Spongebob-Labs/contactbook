import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createZip, crc32 } from "./zip-writer";

/**
 * A hand-written binary format is only as good as an independent reader says it
 * is, so these assert against the system `unzip` rather than against our own
 * parser. Skipped where unzip is unavailable.
 */
function hasUnzip(): boolean {
  try {
    execFileSync("unzip", ["-v"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

const describeWithUnzip = hasUnzip() ? describe : describe.skip;

describe("crc32", () => {
  it("matches the known IEEE checksum for a standard vector", () => {
    // "123456789" -> 0xCBF43926 is the canonical CRC-32 check value.
    expect(crc32(Buffer.from("123456789"))).toBe(0xcbf43926);
  });

  it("returns zero for empty input", () => {
    expect(crc32(Buffer.alloc(0))).toBe(0);
  });
});

describe("createZip", () => {
  it("starts with the local file header signature", () => {
    const zip = createZip([{ name: "a.txt", data: Buffer.from("hi") }]);
    expect(zip.readUInt32LE(0)).toBe(0x04034b50);
  });

  it("records every entry in the central directory", () => {
    const zip = createZip([
      { name: "a.txt", data: Buffer.from("one") },
      { name: "b.txt", data: Buffer.from("two") },
    ]);
    // End-of-central-directory is the last 22 bytes with no comment.
    const end = zip.length - 22;
    expect(zip.readUInt32LE(end)).toBe(0x06054b50);
    expect(zip.readUInt16LE(end + 8)).toBe(2);
    expect(zip.readUInt16LE(end + 10)).toBe(2);
  });

  it("is deterministic for identical input", () => {
    const build = () =>
      createZip([{ name: "pass.json", data: Buffer.from('{"a":1}') }]);
    expect(build().equals(build())).toBe(true);
  });
});

describeWithUnzip("createZip, validated by the unzip CLI", () => {
  let dir: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "cb-zip-"));
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function writeZip(name: string, entries: Array<[string, Buffer]>): string {
    const path = join(dir, name);
    writeFileSync(
      path,
      createZip(entries.map(([n, data]) => ({ name: n, data }))),
    );
    return path;
  }

  it("passes an integrity check", () => {
    const path = writeZip("ok.zip", [
      ["pass.json", Buffer.from('{"formatVersion":1}')],
      ["manifest.json", Buffer.from('{"pass.json":"abc"}')],
    ]);
    expect(() =>
      execFileSync("unzip", ["-t", path], { stdio: "ignore" }),
    ).not.toThrow();
  });

  it("round-trips file contents byte for byte", () => {
    const payload = Buffer.from(
      JSON.stringify({ formatVersion: 1, description: "Contact card" }),
    );
    const path = writeZip("round.zip", [["pass.json", payload]]);
    const extracted = execFileSync("unzip", ["-p", path, "pass.json"]);
    expect(extracted.equals(payload)).toBe(true);
  });

  it("round-trips binary data, not just text", () => {
    const binary = Buffer.from(
      Array.from({ length: 4096 }, (_, i) => (i * 31) % 256),
    );
    const path = writeZip("binary.zip", [["icon.png", binary]]);
    expect(execFileSync("unzip", ["-p", path, "icon.png"]).equals(binary)).toBe(
      true,
    );
  });

  it("lists every entry with the right names", () => {
    const path = writeZip("many.zip", [
      ["pass.json", Buffer.from("{}")],
      ["manifest.json", Buffer.from("{}")],
      ["signature", Buffer.from([0x30, 0x82])],
      ["icon.png", Buffer.from([0x89, 0x50, 0x4e, 0x47])],
    ]);
    const listing = execFileSync("unzip", ["-Z1", path]).toString();
    expect(listing.split("\n").filter(Boolean).sort()).toEqual([
      "icon.png",
      "manifest.json",
      "pass.json",
      "signature",
    ]);
  });

  it("handles an empty file without corrupting the archive", () => {
    const path = writeZip("empty.zip", [
      ["pass.json", Buffer.from("{}")],
      ["blank", Buffer.alloc(0)],
    ]);
    expect(() =>
      execFileSync("unzip", ["-t", path], { stdio: "ignore" }),
    ).not.toThrow();
    expect(readFileSync(path).length).toBeGreaterThan(0);
  });
});
