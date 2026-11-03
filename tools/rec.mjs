// node tools/rec.mjs <url> <outdir> <script.json> [shots]  -- CDP capture. Steps: {wait}|{eval}|{shot:"name"}. Prints t0 epoch + page t0wall.
import { spawn } from "node:child_process"; import fs from "node:fs";
const [url, out, scriptPath, mode] = process.argv.slice(2); const steps = JSON.parse(fs.readFileSync(scriptPath, "utf8"));
fs.mkdirSync(out, { recursive: true });
const W = +(process.env.W || 1280), H = +(process.env.H || 720), PORT = 9334;
const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", ["--headless=new", `--remote-debugging-port=${PORT}`, `--window-size=${W},${H}`,
  "--user-data-dir=/tmp/rec-ffn-" + Date.now(), "--autoplay-policy=no-user-gesture-required", "--hide-scrollbars", "about:blank"], { stdio: "ignore" });
const sleep = ms => new Promise(r => setTimeout(r, ms)); let ws;
for (let i = 0; i < 50; i++) { try { const t = (await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()).find(x => x.type === "page"); if (t) { ws = new WebSocket(t.webSocketDebuggerUrl); break; } } catch {} await sleep(200); }
await new Promise(r => ws.onopen = r);
let id = 0; const pending = new Map();
ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d.result); pending.delete(d.id); }
  if (d.method === "Runtime.consoleAPICalled") console.error("console:", d.params.args.map(a => a.value).join(" "));
  if (d.method === "Runtime.exceptionThrown") console.error("EXC:", JSON.stringify(d.params.exceptionDetails).slice(0, 400)); };
const send = (method, params = {}) => new Promise((r, j) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); setTimeout(() => { if (pending.has(i)) { pending.delete(i); r(null); } }, 4000); });
await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: W < 700 });
await send("Runtime.enable"); await send("Page.enable"); await send("Page.navigate", { url }); await sleep(2500);
let n = 0; const t0 = Date.now(); const times = []; let recording = mode !== "shots";
const rec = (async () => { while (recording) { const r = await send("Page.captureScreenshot", { format: "jpeg", quality: 88 }); if (r) { fs.writeFileSync(`${out}/f${String(n).padStart(5, "0")}.jpg`, Buffer.from(r.data, "base64")); times.push(Date.now() - t0); n++; } await sleep(30); } })();
for (const s of steps) {
  if (s.wait) await sleep(s.wait);
  if (s.eval) { const r = await send("Runtime.evaluate", { expression: s.eval, awaitPromise: true, returnByValue: true }); if (s.print) console.log(s.eval, "=>", JSON.stringify(r?.result?.value)); }
  if (s.shot) { const r = await send("Page.captureScreenshot", { format: "jpeg", quality: 80 }); fs.writeFileSync(`${out}/${s.shot}.jpg`, Buffer.from(r.data, "base64")); }
}
recording = false; await rec;
const tw = await send("Runtime.evaluate", { expression: "window.__radio && __radio.t0wall", returnByValue: true });
if (n) { let list = ""; for (let i = 0; i < n; i++) { const d = ((times[i + 1] ?? times[i] + 100) - times[i]) / 1000; list += `file 'f${String(i).padStart(5, "0")}.jpg'\nduration ${d.toFixed(3)}\n`; }
  list += `file 'f${String(n - 1).padStart(5, "0")}.jpg'\n`; fs.writeFileSync(`${out}/list.txt`, list); }
console.log(JSON.stringify({ frames: n, seconds: (times[n - 1] || 0) / 1000, recT0: t0, pageT0: tw?.result?.value, audioOffset: ((tw?.result?.value || 0) - t0) / 1000 }));
ws.close(); chrome.kill();
