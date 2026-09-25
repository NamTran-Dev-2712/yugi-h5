/**
 * Real Phaser page in headless Edge against the REAL API: plays one turn (so the log holds turn / field / combat
 * lines), then screenshots the log panel: all lines, one category off, only one left, hidden (tab only), shown again.
 * Needs API (:3000), web dev server (:5173) and Edge; no dependencies.
 *   node --experimental-strip-types tools/ui-log-shots.ts
 */
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EDGE =
  process.env.EDGE ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const WEB = process.env.WEB_BASE ?? 'http://localhost:5173';
const OUT = process.env.OUT ?? 'docs/ai/review-packets/task-2.10-screens';
const SHOTS = Number(process.env.SHOTS ?? 24);
const INTERVAL = Number(process.env.INTERVAL ?? 400);
const PORT = 9335;
mkdirSync(OUT, { recursive: true });

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const profile = mkdtempSync(join(tmpdir(), 'yugi-edge-'));
const edge = spawn(
  EDGE,
  [
    '--headless=new',
    '--disable-gpu',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    'about:blank',
  ],
  { stdio: 'ignore' },
);

async function pageSocket(): Promise<WebSocket> {
  for (let i = 0; i < 50; i++) {
    try {
      const list = (await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()) as {
        type: string;
        webSocketDebuggerUrl: string;
      }[];
      const page = list.find((t) => t.type === 'page');
      if (page) {
        const ws = new WebSocket(page.webSocketDebuggerUrl);
        await new Promise<void>((res, rej) => {
          ws.onopen = () => res();
          ws.onerror = () => rej(new Error('ws error'));
        });
        return ws;
      }
    } catch {
      /* Edge not ready yet */
    }
    await sleep(200);
  }
  throw new Error('Edge devtools not reachable');
}

const ws = await pageSocket();
let nextId = 1;
const waiting = new Map<number, (v: unknown) => void>();
ws.onmessage = (m) => {
  const msg = JSON.parse(String(m.data)) as { id?: number; result?: unknown };
  if (msg.id !== undefined) waiting.get(msg.id)?.(msg.result);
};
function cdp(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
  const id = nextId++;
  return new Promise((res) => {
    waiting.set(id, res);
    ws.send(JSON.stringify({ id, method, params }));
  });
}
type P = readonly [number, number];
async function click([x, y]: P): Promise<void> {
  for (const type of ['mousePressed', 'mouseReleased'] as const) {
    await cdp('Input.dispatchMouseEvent', {
      type,
      x,
      y,
      button: 'left',
      buttons: type === 'mouseReleased' ? 0 : 1,
      clickCount: 1,
    });
  }
}
async function shot(name: string): Promise<void> {
  const r = (await cdp('Page.captureScreenshot', { format: 'png' })) as { data: string };
  writeFileSync(join(OUT, `${name}.png`), Buffer.from(r.data, 'base64'));
  console.log(`  saved ${name}.png`);
}

try {
  await cdp('Page.enable');
  await cdp('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 720,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await cdp('Page.navigate', { url: `${WEB}/?fast=1` });
  await sleep(3000);
  await click([640, 320]); // "Đấu với AI"
  await sleep(4000);
  await click([1032 + 116, 544 + 28]); // "Kết thúc lượt"
  await sleep(6000); // fast animation + AI turn settle
  await shot('01-all');
  await click([1147, 55]); // chip "Đánh" off
  await sleep(200);
  await shot('02-combat-off');
  await click([1147, 55]); // back on
  await click([1194, 55]); // "Lượt" off
  await click([1100, 55]); // "Sân" off
  await click([1241, 55]); // "Lỗi" off -> only combat left
  await sleep(200);
  await shot('03-combat-only');
  await click([1053, 55]); // "Tất cả"
  await click([1242, 28]); // collapse
  await sleep(300);
  await shot('04-hidden');
  await click([1242, 28]); // tab again
  await sleep(300);
  await shot('05-shown-again');
} finally {
  ws.close();
  edge.kill();
}
process.exit(0);
