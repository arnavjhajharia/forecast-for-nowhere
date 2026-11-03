// Offline re-creation of the in-game radio mix along a scripted dial path (mirrors index.html's audio graph).
// node tools/mixdown.mjs video/path.json out.wav
import { execFileSync } from "node:child_process"; import fs from "node:fs";
const [pj, out] = process.argv.slice(2); const P = JSON.parse(fs.readFileSync(pj, "utf8"));
const src = fs.readFileSync("stations.js", "utf8"); const window = {}; eval(src);
const ST = window.STATIONS, K = window.KEEPER, ALL = [...ST, K], SR = 44100, N = Math.round(P.total * SR);
for (const s of ALL) {
  const raw = execFileSync("ffmpeg", ["-v", "error", "-i", s.audio, "-f", "f32le", "-ac", "1", "-ar", String(SR), "-"], { maxBuffer: 1 << 28 });
  s.buf = new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4); s.len = Math.ceil((s.buf.length / SR + 3.5) * SR);
  s.hp = 0; s.hpx = 0; s.lp = 0; s.base = 70 + (s.hue % 90);
}
const pathF = t => { const p = P.path; if (t <= p[0][0]) return p[0][1]; for (let i = 1; i < p.length; i++) if (t < p[i][0]) { const [ta, fa] = p[i - 1], [tb, fb] = p[i]; let u = (t - ta) / (tb - ta); u = u * u * (3 - 2 * u); return fa + (fb - fa) * u; } return p[p.length - 1][1]; };
const W = 0.5, KW = 0.16;
const str = (s, f) => s === K ? Math.exp(-Math.pow((f - s.f) / KW, 2)) : 1 / (1 + Math.pow((f - s.f) / W, 2));
const shape = x => 2.5 * x / (1 + 1.5 * Math.abs(x));
const outb = new Float32Array(N); let b0 = 0, b1 = 0, b2 = 0, a1 = 0, a2 = 0, x1 = 0, x2 = 0, y1 = 0, y2 = 0, wph = 0;
const BLK = 256;
for (let i0 = 0; i0 < N; i0 += BLK) {
  const t = i0 / SR, f = pathF(t), unlocked = t >= P.unlockAt, live = unlocked ? ALL : ST;
  const ss = live.map(s => ({ s, v: str(s, f) })).sort((a, b) => b.v - a.v), a = ss[0], b = ss[1];
  const sig = Math.min(1, a.v + b.v * 0.5), gapK = unlocked ? 0 : str(K, f);
  const statGain = 0.05 + 0.32 * (1 - sig) + 0.08 * Math.min(a.v, b.v) * 4;
  // bandpass biquad for static (RBJ, constant 0 dB peak)
  const fc = 900 + f * 220, w0 = 2 * Math.PI * fc / SR, al = Math.sin(w0) / (2 * 0.6), a0 = 1 + al;
  b0 = al / a0; b1 = 0; b2 = -al / a0; a1 = -2 * Math.cos(w0) / a0; a2 = (1 - al) / a0;
  const wf = 180 + Math.abs(f - a.s.f) * 5200, wg = a.v * (1 - a.v) * 0.18;
  for (const s of live) { s.v = str(s, f); s.g = Math.pow(s.v, 1.3) * 1.1; s.lpa = 1 - Math.exp(-2 * Math.PI * (500 + 5200 * s.v * s.v) / SR); }
  for (let i = i0; i < Math.min(N, i0 + BLK); i++) {
    const tt = i / SR; let y = 0;
    for (const s of live) {
      const p = (i + Math.floor(s.phase * s.len)) % s.len; const x = p < s.buf.length ? s.buf[p] : 0;
      s.hp = 0.963 * (s.hp + x - s.hpx); s.hpx = x; s.lp += s.lpa * (s.hp - s.lp);
      y += shape(s.lp) * s.g;
      if (s.v > 0.01) { const ph = 2 * Math.PI * s.base * tt; y += s.v * 0.035 * (0.4 * (2 / Math.PI) * Math.asin(Math.sin(ph)) + 0.25 * Math.sin(ph * 1.5) + 0.25 * Math.sin(ph * 2.01)); }
    }
    const n = Math.random() * 2 - 1, sy = b0 * n + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = n; y2 = y1; y1 = sy;
    y += sy * Math.max(0, statGain + 0.06 * Math.sin(2 * Math.PI * 0.23 * tt));
    wph += 2 * Math.PI * wf / SR; y += Math.sin(wph) * wg;
    if (gapK > 0.001 && tt > 0.9) { const c = (tt - 0.9) % 7, k = Math.floor(c / 0.45); if (k < 6 && c - k * 0.45 < 0.12) y += (Math.sin(2 * Math.PI * 880 * tt) > 0 ? 0.18 : -0.18) * gapK * 0.5; }
    outb[i] = Math.tanh(y * 0.9 * 1.2) / 1.1;
  }
}
const pcm = Buffer.from(outb.buffer);
execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "f32le", "-ar", String(SR), "-ac", "1", "-i", "-", "-ac", "2", out], { input: pcm, maxBuffer: 1 << 28 });
console.log("wrote", out, P.total, "s");
