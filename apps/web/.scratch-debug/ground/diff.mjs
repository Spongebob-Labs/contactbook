import { PNG } from "pngjs";
import fs from "node:fs";
const dir = process.argv[2];
for (const n of ["proof-desktop", "proof-mobile"]) {
  const a = PNG.sync.read(fs.readFileSync(`${dir}/${n}-before.png`));
  const b = PNG.sync.read(fs.readFileSync(`${dir}/${n}-after.png`));
  let diff = 0, max = 0, samples = [];
  for (let i = 0; i < a.data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const d = Math.abs(a.data[i + c] - b.data[i + c]);
      if (d > 0) { diff++; if (d > max) max = d; if (samples.length < 6) samples.push({ px: i / 4, c, a: a.data[i + c], b: b.data[i + c] }); }
    }
  }
  console.log(n, { channels: a.data.length / 4 * 3, differing: diff, maxDelta: max, samples });
}
