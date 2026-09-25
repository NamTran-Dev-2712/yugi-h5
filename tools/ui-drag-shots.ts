/**
 * Drives the REAL Phaser page in headless Edge with real mouse events (Chrome DevTools Protocol) and takes screenshots
 * of each interaction state on the dev fixtures: drag highlight, option menu, tribute overlay, attack arrow, toast.
 * Needs the web dev server (`pnpm dev`, http://localhost:5173) and Edge. No dependencies (Node 22 global WebSocket).
 *   node --experimental-strip-types tools/ui-drag-shots.ts
 * Coordinates are the logical 1280x720 frame (the page is emulated at exactly that size, so 1 px = 1 unit).
 */
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EDGE =
  process.env.EDGE ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const WEB = process.env.WEB_BASE ?? 'http://localhost:5173';
const OUT = process.env.OUT ?? 'docs/ai/review-packets/task-2.8-screens/interaction';
const PORT = 9333;
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
const mouse = (
  type: 'mousePressed' | 'mouseMoved' | 'mouseReleased',
  [x, y]: P,
): Promise<unknown> =>
  cdp('Input.dispatchMouseEvent', {
    type,
    x,
    y,
    button: type === 'mouseMoved' ? 'none' : 'left',
    buttons: type === 'mouseReleased' ? 0 : 1,
    clickCount: type === 'mouseMoved' ? 0 : 1,
  });

async function shot(name: string): Promise<void> {
  const r = (await cdp('Page.captureScreenshot', { format: 'png' })) as { data: string };
  writeFileSync(join(OUT, `${name}.png`), Buffer.from(r.data, 'base64'));
  console.log(`  saved ${name}.png`);
}
async function click(p: P): Promise<void> {
  await mouse('mousePressed', p);
  await mouse('mouseReleased', p);
  await sleep(250);
}
async function dragTo(from: P, to: P, shotName?: string): Promise<void> {
  await mouse('mouseMoved', from);
  await mouse('mousePressed', from);
  for (let i = 1; i <= 8; i++) {
    await mouse('mouseMoved', [
      from[0] + ((to[0] - from[0]) * i) / 8,
      from[1] + ((to[1] - from[1]) * i) / 8,
    ]);
    await sleep(30);
  }
  await sleep(200);
  if (shotName) await shot(shotName);
  await mouse('mouseReleased', to);
  await sleep(300);
}
async function open(fixture: string): Promise<void> {
  await cdp('Page.navigate', { url: `${WEB}/?fixture=${fixture}` });
  await sleep(3000);
}

// Logical-frame coordinates (see layout.ts): own monster row centre y=454, opponent row centre y=266.
const selfZone = (i: number): P => [406 + i * 96 + 42, 454];
const oppZone = (i: number): P => [406 + i * 96 + 42, 266];
const OPP_LP: P = [130, 50];
const CONFIRM: P = [555, 371];

try {
  await cdp('Page.enable');
  await cdp('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 720,
    deviceScaleFactor: 1,
    mobile: false,
  });

  console.log('summon-choice');
  await open('summon-choice');
  await dragTo([568, 673], selfZone(0), 'summon-1-dragging'); // hand card 0 -> zone 0, shot while dragging
  await shot('summon-2-menu'); // Summon / Set menu at the drop point
  await click([selfZone(0)[0] + 80, 454 + 20]); // "Triệu hồi"
  await shot('summon-3-sent'); // fixture: log shows "sẽ gửi: ..." and the board did not change

  console.log('tribute');
  await open('tribute');
  await dragTo([604, 673], selfZone(0), 'tribute-1-dragging');
  await click([selfZone(0)[0] + 80, 454 + 20]); // "Triệu hồi"
  await shot('tribute-2-select'); // candidates lit, Xác nhận disabled
  await click(selfZone(1));
  await shot('tribute-3-chosen'); // one chosen, Xác nhận enabled
  await click(CONFIRM);
  await shot('tribute-4-sent');

  console.log('attack');
  await open('attack');
  await dragTo(selfZone(1), oppZone(2), 'attack-1-arrow'); // arrow to the face-down monster (position only)
  await shot('attack-2-sent');

  console.log('attack-direct');
  await open('attack-direct');
  await dragTo(selfZone(3), OPP_LP, 'direct-1-arrow');
  await shot('direct-2-sent');

  console.log('drag-illegal');
  await open('drag-illegal');
  await dragTo([604, 673], selfZone(2), 'illegal-1-dragging');
  await shot('illegal-2-toast');
} finally {
  ws.close();
  edge.kill();
}
process.exit(0);
