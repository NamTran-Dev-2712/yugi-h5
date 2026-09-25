/**
 * Real Phaser page in headless Edge against the REAL API: starts a duel vs AI, presses "Kết thúc lượt" and takes a
 * screenshot every ~400 ms while the animation of the human's phases and the AI's moves plays (captions, effects,
 * old board), then one when it settles. Needs API (:3000), web dev server (:5173) and Edge; no dependencies.
 *   node --experimental-strip-types tools/ui-anim-shots.ts
 * Env: OUT (dir), SHOTS (count, default 24), INTERVAL (ms, default 400).
 */
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EDGE =
  process.env.EDGE ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const WEB = process.env.WEB_BASE ?? 'http://localhost:5173';
const OUT = process.env.OUT ?? 'docs/ai/review-packets/task-2.9-screens';
const SHOTS = Number(process.env.SHOTS ?? 24);
const INTERVAL = Number(process.env.INTERVAL ?? 400);
const PORT = 9334;
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
  await cdp('Page.navigate', { url: WEB });
  await sleep(3000);
  await click([640, 320]); // "Đấu với AI"
  await sleep(4000); // guest + createSolo + scene start
  await shot('00-start');
  await click([1032 + 116, 544 + 28]); // "Kết thúc lượt": EndPhase requests, AI plays, each response is animated
  for (let i = 1; i <= SHOTS; i++) {
    await sleep(INTERVAL);
    await shot(`${String(i).padStart(2, '0')}-anim`);
  }
  await sleep(3000);
  await shot('99-settled');
} finally {
  ws.close();
  edge.kill();
}
process.exit(0);
