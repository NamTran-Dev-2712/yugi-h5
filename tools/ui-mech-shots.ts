/**
 * Task 4.2d screenshots: Flip Summon, Equip and Special Summon (hand / graveyard picker) on the REAL Sandbox page
 * against the REAL API, with the real cards SMP-044 / SMP-111 / SMP-112, driven by REAL mouse events in headless Edge:
 *  - `flip-real`: tap my face-down SMP-044 → menu "Lật ngửa" → Flip Summon → its OnFlip asks me (Kích hoạt / Không) →
 *    pick an opponent monster → destroyed.
 *  - `equip-real`: the script equipped SMP-112 to my SMP-001 → equip line + outlines, effective ATK 1700 (detail panel).
 *  - `special-summon-real`: drag SMP-111 onto my Spell/Trap Zone → one menu entry per effect + "Úp" → effect 2
 *    (graveyard) → "Chọn từ mộ" picker → pick SMP-003 → confirm → it lands on the field.
 * Needs the API, the web dev server and Edge; no dependencies.
 *   WEB_BASE=http://localhost:5173 node --experimental-strip-types tools/ui-mech-shots.ts
 * Logical coordinates are the 1280x720 duel frame (layout.ts), mapped onto the canvas as it sits in the page.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EDGE =
  process.env.EDGE ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const WEB = process.env.WEB_BASE ?? 'http://localhost:5173';
const OUT = process.env.OUT ?? 'docs/ai/review-packets/task-4.2d-screens';
const PORT = 9339;
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
async function run<T>(expression: string): Promise<T> {
  const r = (await cdp('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  })) as { result: { value: T } };
  return r.result.value;
}
async function shot(name: string): Promise<void> {
  const r = (await cdp('Page.captureScreenshot', { format: 'png' })) as { data: string };
  writeFileSync(join(OUT, `${name}.png`), Buffer.from(r.data, 'base64'));
  console.log(`  saved ${name}.png`);
}

type P = readonly [number, number];
let toPage = (p: P): P => p;
async function measureCanvas(): Promise<void> {
  const r = await run<{ x: number; y: number; w: number; h: number }>(
    `(() => { const c = document.querySelector('canvas').getBoundingClientRect();
      return { x: c.left, y: c.top, w: c.width, h: c.height }; })()`,
  );
  toPage = ([x, y]) => [r.x + (x * r.w) / 1280, r.y + (y * r.h) / 720];
}
const mouse = (type: 'mousePressed' | 'mouseMoved' | 'mouseReleased', p: P): Promise<unknown> => {
  const [x, y] = toPage(p);
  return cdp('Input.dispatchMouseEvent', {
    type,
    x,
    y,
    button: type === 'mouseMoved' ? 'none' : 'left',
    buttons: type === 'mouseReleased' ? 0 : 1,
    clickCount: type === 'mouseMoved' ? 0 : 1,
  });
};
async function click(p: P, wait = 2500): Promise<void> {
  await mouse('mouseMoved', p);
  await mouse('mousePressed', p);
  await mouse('mouseReleased', p);
  await sleep(wait);
}
async function hover(p: P): Promise<void> {
  await mouse('mouseMoved', p);
  await sleep(300);
}
const press = (label: string): Promise<unknown> =>
  run(
    `[...document.querySelectorAll('button')].find((b) => b.textContent === ${JSON.stringify(label)})?.click()`,
  );
async function load(name: string): Promise<void> {
  await run(`(() => {
    const s = document.querySelector('select');
    s.value = ${JSON.stringify(name)};
    s.dispatchEvent(new Event('change'));
  })()`);
  await press('Nạp');
  await sleep(5000); // load + the AI's opening actions (fast=1)
  await measureCanvas();
}

async function drag(from: P, to: P, wait = 800): Promise<void> {
  await mouse('mouseMoved', from);
  await mouse('mousePressed', from);
  const steps = 6;
  for (let i = 1; i <= steps; i++) {
    const p: P = [
      from[0] + ((to[0] - from[0]) * i) / steps,
      from[1] + ((to[1] - from[1]) * i) / steps,
    ];
    await mouse('mouseMoved', p);
    await sleep(30);
  }
  await mouse('mouseReleased', to);
  await sleep(wait);
}

// layout.ts: zone rows start at x=406, step 96, zone 84x104. Own Spell/Trap row y=516, own monsters y=402, opponent
// monsters y=214. Menu entries (optionRects): 160x40 from the click point, gap 4. Confirm 480,350 150x42. Hand of 3
// cards: x0=536, step 72, y=628, 64x90. Graveyard picker of 2 (pickerSlots): x0=572, step 72, y=222, 64x90.
const col = (i: number): number => 406 + i * 96 + 42;
const selfSpellZone = (i: number): P => [col(i), 568];
const selfZone = (i: number): P => [col(i), 454];
const oppZone = (i: number): P => [col(i), 266];
const menuEntry = (anchor: P, i: number): P => [anchor[0] + 80, anchor[1] + 20 + i * 44];
const hand3 = (i: number): P => [536 + i * 72 + 32, 673];
const picker2 = (i: number): P => [572 + i * 72 + 32, 267];
const CONFIRM: P = [555, 371];

try {
  await cdp('Page.enable');
  await cdp('Emulation.setDeviceMetricsOverride', {
    width: 1300,
    height: 1240,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await cdp('Page.navigate', { url: `${WEB}/dev/sandbox.html?fast=1` });
  await sleep(2500);

  console.log('flip-real');
  await load('flip-real');
  await shot('01-flip-face-down-smp044');
  await click(selfZone(1), 600);
  await shot('02-flip-menu-lat-ngua');
  await click(menuEntry(selfZone(1), 0), 4000);
  await shot('03-flip-summoned-onflip-asks');
  await click(oppZone(2), 600);
  await click(CONFIRM, 4000);
  await shot('04-onflip-destroyed-opponent-monster');
  await press('Đóng ván');
  await sleep(500);

  console.log('equip-real');
  await load('equip-real');
  await shot('05-equip-link-and-effective-atk');
  await hover(selfZone(0));
  await shot('06-equip-detail-printed-vs-effective');
  await hover(selfSpellZone(0));
  await shot('07-equip-card-detail');
  await press('Đóng ván');
  await sleep(500);

  console.log('special-summon-real');
  await load('special-summon-real');
  await drag(hand3(0), selfSpellZone(2));
  await shot('08-ss-drop-menu-one-entry-per-effect');
  await click(menuEntry(selfSpellZone(2), 1), 1500);
  await shot('09-ss-graveyard-picker');
  await click(picker2(0), 600);
  await shot('10-ss-picker-selected');
  await click(CONFIRM, 5000);
  await shot('11-ss-monster-from-graveyard-on-field');
} finally {
  ws.close();
  edge.kill();
}
process.exit(0);
