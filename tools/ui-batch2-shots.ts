/**
 * Task 4.7 screenshots: card batch 2 on the REAL Sandbox page against the REAL API, driven by REAL mouse events in
 * headless Edge, through the three batch-2 scenarios:
 *  - `equip-opponent-real`: drag SMP-122 (Equip Spell) from the hand → it equips to the AI monster (ATK 1800 → 1200),
 *    card details with the long effect texts;
 *  - `beast-pack-real`: Normal Summon SMP-057 (other Beasts +200 ATK), then the Field Spell SMP-124 (EARTH +200 / +200);
 *  - `revive-on-destroyed-real`: SMP-054 attacks a stronger monster, is destroyed, its trigger asks for a monster in my
 *    graveyard, SMP-048 comes back in Defense and heals 500.
 * Needs the API, the web dev server and Edge; no dependencies.
 *   WEB_BASE=http://localhost:5173 node --experimental-strip-types tools/ui-batch2-shots.ts
 * Logical coordinates are the 1280x720 duel frame (layout.ts), mapped onto the canvas as it sits in the page.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EDGE =
  process.env.EDGE ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const WEB = process.env.WEB_BASE ?? 'http://localhost:5173';
const OUT = process.env.OUT ?? 'docs/ai/review-packets/task-4.7-screens';
const PORT = 9347;
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
/** Load a shipped sample by name, or (with `text`) a scenario pasted into the textarea. */
async function load(name: string, text?: string): Promise<void> {
  if (text === undefined) {
    await run(`(() => {
      const s = document.querySelector('select');
      s.value = ${JSON.stringify(name)};
      s.dispatchEvent(new Event('change'));
    })()`);
  } else {
    await run(`(() => { document.querySelector('textarea').value = ${JSON.stringify(text)}; })()`);
  }
  await press('Nạp');
  await sleep(5000); // load + the first render
  await measureCanvas();
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
// monsters y=214, Field Zones at x=352. Hand of n cards: 64x90 at y=628, step 72, centred on x=640.
const col = (i: number): number => 406 + i * 96 + 42;
const selfSpellZone = (i: number): P => [col(i), 568];
const selfZone = (i: number): P => [col(i), 454];
const oppZone = (i: number): P => [col(i), 266];
const FIELD_SELF: P = [352, 454];
const menuEntry = (anchor: P, i: number): P => [anchor[0] + 80, anchor[1] + 20 + i * 44];
const hand = (count: number, i: number): P => [
  640 - (64 + 72 * (count - 1)) / 2 + i * 72 + 32,
  673,
];
const CONFIRM: P = [777, 374];
/** The picker row over the middle of the table (one card: centred). */
const picker = (count: number, i: number): P => [
  640 - (64 + 72 * (count - 1)) / 2 + i * 72 + 32,
  267,
];

try {
  await cdp('Page.enable');
  await cdp('Emulation.setDeviceMetricsOverride', {
    width: 1300,
    height: 1240,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await cdp('Page.navigate', { url: `${WEB}/dev/sandbox.html` });
  await sleep(2500);

  console.log('equip-opponent-real: SMP-122, an Equip Spell on the opponent`s monster');
  await load('equip-opponent-real');
  await hover(hand(3, 0));
  await shot('01-hand-detail-smp122-equip-on-opponent-long-text');
  await dragHold(hand(3, 0), selfSpellZone(0));
  await shot('02-drag-equip-drop-zones');
  await drop(selfSpellZone(0));
  await shot('03-drop-menu');
  await click(menuEntry(selfSpellZone(0), 0), 5000);
  await shot('04-equipped-to-the-opponent-monster-atk-1200');
  await hover(oppZone(2));
  await shot('05-opponent-monster-detail-printed-vs-effective');
  await hover(selfSpellZone(0));
  await shot('06-equip-card-detail-in-my-zone');
  await press('Đóng ván');
  await sleep(500);

  console.log('beast-pack-real: SMP-057 (Continuous by race) and the Field Spell SMP-124');
  await load('beast-pack-real');
  await hover(hand(4, 0));
  await shot('07-hand-detail-smp057-continuous-text');
  await dragHold(hand(4, 0), selfZone(0));
  await drop(selfZone(0));
  await shot('08-summon-drop-menu');
  await click(menuEntry(selfZone(0), 0), 5000);
  await shot('09-smp057-summoned-other-beast-plus-200');
  await dragHold(hand(3, 0), FIELD_SELF);
  await drop(FIELD_SELF);
  await click(menuEntry(FIELD_SELF, 0), 5000);
  await shot('10-field-spell-smp124-earth-monsters-plus-200');
  await hover(FIELD_SELF);
  await shot('11-field-spell-detail');
  await press('Đóng ván');
  await sleep(500);

  console.log('revive-on-destroyed-real: SMP-054 destroyed in battle brings SMP-048 back');
  await load('revive-on-destroyed-real');
  await hover(selfZone(0));
  await shot('12-smp054-detail-longest-monster-text');
  await dragHold(selfZone(0), oppZone(0));
  await drop(oppZone(0), 6000);
  await shot('13-destroyed-trigger-prompt-pick-from-graveyard');
  await click(picker(1, 0), 800);
  await shot('14-picker-selected');
  await click(CONFIRM, 20000); // two chains are animated; the board only shows the result once they are done
  await shot('15-smp048-back-in-defense-then-heals-500-log');
} finally {
  ws.close();
  edge.kill();
}
process.exit(0);
