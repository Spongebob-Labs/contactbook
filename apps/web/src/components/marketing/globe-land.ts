/**
 * The land under the globe in `world-globe.tsx` — every land dot on the sphere, as run-lengths.
 *
 * GENERATED 2026-09-29 — do not hand-edit; regenerate instead. Source: the same
 * `countries.geo.json` (Natural Earth, via dotted-map 3.1.0, MIT) the flat map was cut from,
 * run once offline and never installed here. The flat map's own data could not be reused: it is
 * Mercator-projected and cropped to 128°W–156°E, 44°S–72°N, so a globe built from it has no
 * Pacific, no Alaska, no New Zealand and a hard edge through the Arctic.
 *
 * Construction (GitHub's globe): 113 rows of latitude 1.6° apart; each row carries dots in
 * proportion to its circumference, alternate rows offset half a step — the flat map's diagonal
 * grid, wrapped round the sphere. A row is `n:start.len,start.len…` in base 36, where `n` is the
 * row's dot count and each run is a stretch of consecutive land dots. 4656 dots in all.
 */

export const GLOBE_ROWS = 113;

const GLOBE_LAND = [
  "3:|9:|g:|m:0.1,2.k|s:3.o|y:2.9,d.j|14:4.8,f.1,h.l|1b:3.b,h.1,j.q|1h:5.c,n.s|1n:7.5,d.6,r.u|1",
  "t:e.1,h.2,k.2,u.y|1z:l.2,x.g,1e.j|25:o.2,16.2,19.9,1j.i|2a:1f.6,1n.g|2g:s.1,1l.2,1x.1,1z.2,2",
  "2.6|2m:u.1|2s:y.1|2x:|33:|38:|3d:|3j:|3o:14.2|3t:14.2|3y:16.2|42:16.4,2t.1|47:18.4|4c:19.4,4",
  "6.2|4g:1b.4,4b.2|4l:1c.5,45.1,4h.1|4p:1e.4,49.2,4m.2|4t:1f.6,4q.2|4x:1h.8,4e.3,4v.2|51:1i.8,",
  "4h.5|54:1k.7,4j.7|58:1l.9,2w.4,4a.5,4k.9|5b:1m.b,2y.6,4d.7,4m.b|5e:1n.b,2y.8,4f.l|5h:1o.c,30",
  ".9,4i.l|5k:1p.c,30.a,4j.m|5n:1q.d,32.b,3j.1,4m.m|5q:1r.e,33.c,3k.2,4o.m|5s:1s.g,35.c,3m.2,4r",
  ".k|5u:1s.h,35.c,3n.2,4u.i|5x:1t.j,36.e,3p.3,4z.f|5z:1t.j,37.f,3q.3,51.e|60:1s.l,38.h,3s.2,53",
  ".8,5d.3|62:1r.m,38.i,3u.1,55.1,57.4,5f.2|63:1r.o,3a.h,59.4,5g.1|65:1r.p,3b.g|66:1r.r,3c.g,55",
  ".1,58.1,5m.2,5u.1|67:1q.s,3c.g,50.3,5h.4,5m.1|68:1q.t,3c.h,4y.2,5j.5|68:1p.s,3b.h,4w.2,56.1,",
  "58.1,5h.6,5q.1|69:1r.p,3b.j,4x.2,53.3,57.1,59.1,5d.2,5g.1,5i.4|69:1q.m,3a.l,4v.3,51.4,57.2,5",
  "f.1|69:1r.i,3b.l,4v.3,51.5|69:1r.i,3a.n,4u.2,4x.1,51.5,5c.1|69:1s.h,3b.n,4u.1,4w.2,54.2|68:1",
  "s.g,2y.2,37.r,4r.2,4v.1,53.3|68:1s.d,2y.11,4i.1,4v.1,55.1,5a.1|67:1p.1,1r.c,2v.13,4h.1,4t.1,",
  "57.3|66:1n.2,1q.1,1t.2,1w.6,2v.14,4f.1,4s.1,4w.1,54.1,57.1|65:1m.1,1t.1,1v.1,2t.10,3w.2,4d.3",
  ",4r.1,4u.3,55.1|63:1l.2,2s.11,4c.3,4q.6,53.1,55.1|62:1h.6,2r.z,3r.4,4a.4,4o.7,52.1|60:1e.1,1",
  "g.3,1l.1,2r.x,3q.6,49.4,4l.1,4n.7,50.1|5z:1b.8,2q.x,3p.8,47.6,4k.7,4z.2|5x:19.5,1h.2,1s.2,2p",
  ".w,3n.a,46.7,4i.8,4r.1|5u:17.5,1g.2,1o.1,2n.w,3k.b,43.9,4f.8|5s:17.5,1l.2,2n.v,3j.c,41.c,4e.",
  "d|5q:16.5,1m.1,2m.t,3h.b,3y.s,4s.1|5n:15.6,1k.1,2m.r,3f.7,3p.1,3r.y|5k:10.2,13.7,1i.1,2l.q,3",
  "c.8,3m.11|5h:10.1,12.9,1i.1,2l.w,3j.13|5e:10.d,1f.2,2k.1y|5b:y.j,2j.d,2z.2,36.1b,4l.1|58:x.k",
  ",2i.a,34.19,4i.2|54:v.n,2h.9,2x.1,31.1,33.16,4d.1,4g.4|51:t.n,2f.1,2j.5,2x.1a,4a.2,4f.2|4x:s",
  ".n,2d.4,2r.2,2u.b,37.w,46.2|4t:r.o,2a.4,2o.1,2r.b,34.w,41.3,4a.1|4p:r.o,29.5,2j.2,2m.4,2s.2,",
  "2w.4,32.10|4l:p.p,26.6,2f.2,2i.5,2t.3,2y.12,43.2|4g:p.r,28.6,2f.6,2n.1,2p.4,2v.12,3z.1|4c:o.",
  "s,25.e,2k.1,2n.4,2t.11|47:p.o,1f.3,22.1o|42:n.n,1b.1,1d.2,20.1m,3n.1|3y:l.r,1y.1l|3t:k.h,13.",
  "8,1t.1,1v.2,1y.1h,3k.1|3o:j.h,11.9,1r.1,1t.1,1y.1,20.1a,3g.1|3j:6.1,h.g,10.6,1q.1,1u.3,1z.15",
  ",3a.3|3d:9.1,g.e,z.5,1n.1,1s.3,1w.14,36.2|38:6.3,d.f,x.3,11.1,1o.1,1q.2,1u.12,31.1|33:5.5,b.",
  "g,w.3,16.1,1m.4,1r.15,2y.3|2x:4.l,u.1,12.2,1i.4,1n.19|2s:6.j,q.1,v.1,10.3,19.1,1h.3,1l.17|2m",
  ":1.1,3.l,r.2,x.4,15.2,1e.3,1i.2,1l.11|2g:0.2,5.j,r.2,v.5,1c.e,1r.p|2a:3.c,g.1,j.3,o.2,t.6,19",
  ".5,1i.2,1l.p|25:4.4,e.3,i.1,l.3,r.7,17.2,1h.k|1z:b.4,i.3,o.7,1d.c,1r.2|1t:b.1,i.1,n.6,1c.6,1",
  "j.1,1m.1|1n:b.1,e.2,k.6,18.4,1g.1|1h:9.1,c.3,h.7,16.2|1b:c.1,e.7,p.2|14:a.2,d.5,m.1,v.1|y:8.",
  "8|s:8.2,b.2|m:|g:|9:|3:",
].join("");

const DEG = Math.PI / 180;

/**
 * Every land dot as a unit vector — x toward 90°E, y toward the north pole, z toward 0°, 0° —
 * packed `[x, y, z, x, y, z, …]`. Decoded once per page; the renderer only ever rotates these.
 */
export function globeLandVectors(): Float32Array {
  const rows = GLOBE_LAND.split("|");
  const out: number[] = [];
  rows.forEach((row, i) => {
    const [head = "", body = ""] = row.split(":");
    const n = Number.parseInt(head, 36);
    const lat = (-90 + ((i + 0.5) * 180) / GLOBE_ROWS) * DEG;
    const offset = i % 2 === 1 ? 0.5 : 0;
    const cosLat = Math.cos(lat);
    const sinLat = Math.sin(lat);
    for (const run of body ? body.split(",") : []) {
      const [s = "0", l = "0"] = run.split(".");
      const start = Number.parseInt(s, 36);
      const end = start + Number.parseInt(l, 36);
      for (let j = start; j < end; j++) {
        const lon = (-180 + ((j + offset) * 360) / n) * DEG;
        out.push(cosLat * Math.sin(lon), sinLat, cosLat * Math.cos(lon));
      }
    }
  });
  return new Float32Array(out);
}
