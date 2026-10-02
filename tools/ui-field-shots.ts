/**
 * Task 4.3b screenshots: the Field Zone and the cards that stay on the field, on the REAL Sandbox page against the REAL
 * API, with the real cards SMP-113 / SMP-114 / SMP-115 / SMP-208, driven by REAL mouse events in headless Edge:
 *  - `field-real`: drag the Field Spell from the hand → only my Field Zone lights up → drop → "Kích hoạt" / "Úp" →
 *    activate → face-up in the Field Zone, WIND monsters of both sides +300 → drag the second copy → it replaces mine.
 *  - `field-set-real`: the script Set it face-down → a tap activates it (C13).
 *  - `continuous-real-2`: the Continuous Spell from the hand and the Set Continuous Trap stay face-up ("in force" mark).
 *  - `normal-set-real`: a Normal Spell is Set, then activated from its zone on the same turn.
 *  - `special-summon-real`: the selection bar / graveyard picker no longer cover the turn / phase line.
 * Needs the API, the web dev server and Edge; no dependencies.
 *   WEB_BASE=http://localhost:5173 node --experimental-strip-types tools/ui-field-shots.ts
 * Logical coordinates are the 1280x720 duel frame (layout.ts), mapped onto the canvas as it sits in the page.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EDGE =
  process.env.EDGE ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const WEB = process.env.WEB_BASE ?? 'http://localhost:5173';
const OUT = process.env.OUT ?? 'docs/ai/review-packets/task-4.3b-screens';
const PORT = 9340;
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

/** Press on `from` and move to `to` WITHOUT releasing (to capture the drop-zone highlight); `drop` releases there. */
async function dragHold(from: P, to: P): Promise<void> {
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
  await sleep(300);
}
async function drop(at: P, wait = 800): Promise<void> {
  await mouse('mouseReleased', at);
  await sleep(wait);
}

// layout.ts: zone rows start at x=406, step 96, zone 84x104. Own Spell/Trap row y=516, own monsters y=402, opponent
// monsters y=214. The Field Zone is the slot LEFT of the monster row: x=310 (own y=402, opponent y=214). Menu entries
// (optionRects): 160x40 from the drop point, gap 4. Confirm 702,354 150x40. Hand of n cards: 64x90 at y=628, step 72,
// centred on x=640. Graveyard picker of 2 (pickerSlots): x0=572, step 72, y=222, 64x90.
const col = (i: number): number => 406 + i * 96 + 42;
const selfSpellZone = (i: number): P => [col(i), 568];
const selfZone = (i: number): P => [col(i), 454];
const FIELD_SELF: P = [352, 454];
const FIELD_OPP: P = [352, 266];
const menuEntry = (anchor: P, i: number): P => [anchor[0] + 80, anchor[1] + 20 + i * 44];
const hand = (count: number, i: number): P => [
  640 - (64 + 72 * (count - 1)) / 2 + i * 72 + 32,
  673,
];

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

  console.log('field-real');
  await load('field-real');
  await shot('01-field-in-hand-empty-field-zone');
  await dragHold(hand(3, 0), FIELD_SELF);
  await shot('02-field-drag-only-my-field-zone-lights-up');
  await drop(FIELD_SELF);
  await shot('03-field-drop-menu-activate-or-set');
  await click(menuEntry(FIELD_SELF, 0), 4000);
  await shot('04-field-face-up-wind-monsters-plus-300');
  await hover(FIELD_SELF);
  await shot('05-field-card-detail-in-force');
  await hover(selfZone(1));
  await shot('06-buffed-monster-detail-printed-vs-effective');
  await drag(hand(2, 0), FIELD_SELF);
  await click(menuEntry(FIELD_SELF, 0), 4000);
  await shot('07-field-replaced-old-one-in-graveyard');
  await press('Đóng ván');
  await sleep(500);

  console.log('field-set-real');
  await load('field-set-real');
  await hover(FIELD_SELF);
  await shot('08-field-set-face-down-known-to-me');
  await click(FIELD_SELF, 4000);
  await shot('09-field-set-activated-by-a-tap');
  await press('Đóng ván');
  await sleep(500);

  console.log('continuous-real-2');
  await load('continuous-real-2');
  await shot('10-continuous-before');
  await drag(hand(2, 0), selfSpellZone(1));
  await shot('11-continuous-spell-drop-menu');
  await click(menuEntry(selfSpellZone(1), 0), 4000);
  await shot('12-continuous-spell-face-up-buff-on-chain-waits-for-my-set-trap');
  await click(selfSpellZone(2), 4000);
  await shot('13-both-continuous-cards-stay-warriors-plus-300-opponent-minus-300');
  await hover(selfSpellZone(0));
  await shot('14-continuous-card-detail-in-force');
  await press('Đóng ván');
  await sleep(500);

  console.log('normal-set-real');
  await load('normal-set-real');
  await drag(hand(2, 0), selfSpellZone(2));
  await click(menuEntry(selfSpellZone(2), 1), 2500);
  await shot('15-normal-spell-set-this-turn');
  await click(selfSpellZone(2), 4000);
  await shot('16-normal-spell-activated-from-its-zone-same-turn');
  await press('Đóng ván');
  await sleep(500);

  console.log('special-summon-real (selection bar under the turn / phase line)');
  await load('special-summon-real');
  await drag(hand(3, 0), selfSpellZone(2));
  await click(menuEntry(selfSpellZone(2), 1), 1500);
  await shot('17-picker-and-selection-bar-leave-the-turn-line-readable');
  void FIELD_OPP;
} finally {
  ws.close();
  edge.kill();
}
process.exit(0);
