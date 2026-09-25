/**
 * Task 2.12: the same screens in both languages (?lang=vi|en) on the real Phaser page in headless Edge, against the REAL
 * API for duels: menu, mid-duel with the log panel, a rejected-drag toast (DEV fixture drag-illegal), surrender
 * confirm and the loss banner. Needs API (:3000), web dev server (:5173) and Edge; no dependencies.
 *   node --experimental-strip-types tools/ui-i18n-shots.ts
 */
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EDGE =
  process.env.EDGE ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const WEB = process.env.WEB_BASE ?? 'http://localhost:5173';
const OUT = process.env.OUT ?? 'docs/ai/review-packets/task-2.12-screens';
const SHOTS = Number(process.env.SHOTS ?? 24);
const INTERVAL = Number(process.env.INTERVAL ?? 400);
const PORT = 9337;
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

async function open(lang: string, query = ''): Promise<void> {
  await cdp('Page.navigate', { url: `${WEB}/?lang=${lang}${query}` });
  await sleep(3000);
}
async function dragTo(from: P, to: P): Promise<void> {
  const ev = (type: string, x: number, y: number, buttons: number) =>
    cdp('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons, clickCount: 1 });
  await ev('mouseMoved', from[0], from[1], 0);
  await ev('mousePressed', from[0], from[1], 1);
  for (let i = 1; i <= 8; i++) {
    await ev(
      'mouseMoved',
      from[0] + ((to[0] - from[0]) * i) / 8,
      from[1] + ((to[1] - from[1]) * i) / 8,
      1,
    );
    await sleep(30);
  }
  await ev('mouseReleased', to[0], to[1], 0);
  await sleep(300);
}

try {
  await cdp('Page.enable');
  await cdp('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 720,
    deviceScaleFactor: 1,
    mobile: false,
  });
  for (const lang of ['vi', 'en']) {
    console.log(lang);
    await open(lang, '&fast=1');
    await shot(`${lang}-1-menu`);
    await click([640, 320]); // "Duel the AI"
    await sleep(4000);
    await click([1032 + 116, 544 + 28]); // End turn: the AI plays, the log fills
    await sleep(6000);
    await shot(`${lang}-2-duel-log`);
    await open(lang, '&fixture=drag-illegal');
    await dragTo([604, 673], [406 + 2 * 96 + 42, 454]); // hand card -> illegal zone
    await shot(`${lang}-3-toast`);
    await open(lang, '&fast=1');
    await click([640, 320]);
    await sleep(4000);
    await click([1032 + 116, 640 + 28]); // Surrender (asks to confirm)
    await sleep(300);
    await shot(`${lang}-4-surrender-confirm`);
    await click([1032 + 116, 640 + 28]); // confirm
    await sleep(2500);
    await shot(`${lang}-5-gameover`);
  }
} finally {
  ws.close();
  edge.kill();
}
process.exit(0);
