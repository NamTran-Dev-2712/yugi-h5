/**
 * Task 4.4b screenshots: Counter Trap / Negate on the REAL Sandbox page against the REAL API, with the real cards
 * SMP-201 / SMP-209 / SMP-210, driven by REAL mouse events in headless Edge:
 *  - `negate-attack-real`: the AI attacks → reaction window → tap the Set SMP-201 → the attack arrow stops under a cross,
 *    no LP lost.
 *  - `counter-summon-real`: the AI Normal Summons → Summon window → tap the Set SMP-210 → the monster is crossed out and
 *    goes to the graveyard.
 *  - `counter-spell-real`: the AI seat's Continuous Spell is on the chain (its Warriors already +300) → tap the Set
 *    SMP-209 (1000 LP) → the Spell is crossed out, its caption struck through, the bonus is gone.
 *  - a pasted scenario (my own Main Phase): a Set Counter Trap is not outlined and a tap does nothing; a Counter Trap
 *    dragged from the hand is Set at once (no "Kích hoạt" entry).
 * The page runs with `?slow=1` (animations 3× slower), and the "negated" step is caught by watching the screen: the
 * canvas is grabbed after the tap and the first frame showing the red cross is saved, so no timing is hard-coded.
 * Needs the API, the web dev server and Edge; no dependencies.
 *   WEB_BASE=http://localhost:5173 node --experimental-strip-types tools/ui-negate-shots.ts
 * Logical coordinates are the 1280x720 duel frame (layout.ts), mapped onto the canvas as it sits in the page.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';

const EDGE =
  process.env.EDGE ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const WEB = process.env.WEB_BASE ?? 'http://localhost:5173';
const OUT = process.env.OUT ?? 'docs/ai/review-packets/task-4.4b-screens';
const PORT = 9341;
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
  await sleep(14000); // load + the AI's opening actions at a third of the speed
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

/**
 * How many pixels of a PNG screenshot are the "negated" red (`theme.colors.negate`, 0xff4d4d, drawn opaque when the
 * step starts). Minimal PNG reader (8-bit RGB / RGBA, no interlace — what Edge produces); no dependency.
 */
function negateRedPixels(png: Buffer): number {
  let pos = 8;
  let width = 0;
  let channels = 4;
  const idat: Buffer[] = [];
  while (pos < png.length) {
    const len = png.readUInt32BE(pos);
    const type = png.toString('ascii', pos + 4, pos + 8);
    const data = png.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      channels = data[9] === 6 ? 4 : 3;
    }
    if (type === 'IDAT') idat.push(data);
    pos += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  let prev = Buffer.alloc(stride);
  let count = 0;
  for (let y = 0; (y + 1) * (stride + 1) <= raw.length; y++) {
    const filter = raw[y * (stride + 1)]!;
    const line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? line[i - channels]! : 0;
      const b = prev[i]!;
      const c = i >= channels ? prev[i - channels]! : 0;
      const p = a + b - c;
      const paeth =
        Math.abs(p - a) <= Math.abs(p - b) && Math.abs(p - a) <= Math.abs(p - c)
          ? a
          : Math.abs(p - b) <= Math.abs(p - c)
            ? b
            : c;
      const add =
        filter === 1
          ? a
          : filter === 2
            ? b
            : filter === 3
              ? (a + b) >> 1
              : filter === 4
                ? paeth
                : 0;
      line[i] = (line[i]! + add) & 0xff;
    }
    for (let x = 0; x < width; x++) {
      const r = line[x * channels]!;
      const g = line[x * channels + 1]!;
      const bl = line[x * channels + 2]!;
      if (r > 225 && g > 50 && g < 135 && bl > 50 && bl < 135) count++;
    }
    prev = line;
  }
  return count;
}

let missed = 0;
/**
 * Tap `at`, then watch the duel canvas while the animation plays and save the first frame in which the red "negated"
 * cross is drawn, whatever the timing of this machine; then wait for the rest (the AI finishes its turn). Only the
 * canvas is grabbed (a small PNG is quick to take, so the 0.5 s step is not missed); the saved frame is that grab.
 */
async function tapAndCatch(at: P, name: string): Promise<void> {
  const [x, y] = toPage([0, 0]);
  const [x2, y2] = toPage([1280, 720]);
  const clip = { x, y, width: x2 - x, height: y2 - y, scale: 1 };
  const grab = async (): Promise<Buffer> => {
    const r = (await cdp('Page.captureScreenshot', { format: 'png', clip })) as { data: string };
    return Buffer.from(r.data, 'base64');
  };
  const quiet = negateRedPixels(await grab());
  await mouse('mouseMoved', at);
  await mouse('mousePressed', at);
  await mouse('mouseReleased', at);
  let saved = false;
  for (let i = 0; i < 120 && !saved; i++) {
    const png = await grab();
    const red = negateRedPixels(png) - quiet;
    if (red > 300) {
      writeFileSync(join(OUT, `${name}.png`), png);
      console.log(`  saved ${name}.png (frame ${i}, ${red} red pixels)`);
      saved = true;
    }
  }
  if (!saved) {
    missed++;
    console.log(`  MISSED ${name}: the negate step was never seen`);
  }
  await sleep(26000);
}

// layout.ts: zone rows start at x=406, step 96, zone 84x104. Own Spell/Trap row y=516, own monsters y=402, opponent
// monsters y=214. Hand of n cards: 64x90 at y=628, step 72, centred on x=640.
const col = (i: number): number => 406 + i * 96 + 42;
const selfSpellZone = (i: number): P => [col(i), 568];
const hand = (count: number, i: number): P => [
  640 - (64 + 72 * (count - 1)) / 2 + i * 72 + 32,
  673,
];

/** My own Main Phase with a Set Counter Trap and one in the hand (counter-summon-real, my turn). */
function myMainPhaseScenario(): string {
  const base = JSON.parse(
    readFileSync('packages/shared/scenarios/counter-summon-real.json', 'utf8'),
  ) as {
    name: string;
    players: { hand: string[] }[];
    turn: { count: number; player: number };
  };
  base.name = 'counter-main-phase';
  base.players[0]!.hand = ['SMP-209', 'SMP-006'];
  base.turn = { count: 5, player: 0 };
  return JSON.stringify(base, null, 2);
}

try {
  await cdp('Page.enable');
  await cdp('Emulation.setDeviceMetricsOverride', {
    width: 1300,
    height: 1240,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await cdp('Page.navigate', { url: `${WEB}/dev/sandbox.html?slow=1` });
  await sleep(2500);

  console.log('negate-attack-real');
  await load('negate-attack-real');
  await shot('01-ai-attacks-reaction-window-my-set-trap-outlined');
  await hover(selfSpellZone(2));
  await shot('02-set-trap-detail-negate-an-attack');
  await tapAndCatch(selfSpellZone(2), '03-attack-negated-arrow-stops-under-a-cross');
  await shot('04-attack-negated-no-lp-lost-monster-still-there-log');
  await press('Đóng ván');
  await sleep(500);

  console.log('counter-summon-real');
  await load('counter-summon-real');
  await shot('05-ai-summons-summon-window-counter-trap-outlined');
  await tapAndCatch(selfSpellZone(2), '06-summon-negated-monster-crossed-out');
  await shot('07-summon-negated-monster-in-graveyard-no-second-summon-log');
  await press('Đóng ván');
  await sleep(500);

  console.log('counter-spell-real');
  await load('counter-spell-real');
  await shot('08-ai-continuous-spell-on-the-chain-warriors-plus-300');
  await tapAndCatch(selfSpellZone(2), '09-spell-negated-crossed-out-caption-struck');
  await shot('10-spell-negated-in-graveyard-bonus-gone-1000-lp-paid-log');
  await press('Đóng ván');
  await sleep(500);

  console.log('my Main Phase (pasted scenario): a Set Counter Trap, and one in the hand');
  await load('', myMainPhaseScenario());
  await hover(selfSpellZone(2));
  await shot('11-main-phase-set-counter-trap-not-outlined');
  await click(selfSpellZone(2), 1200);
  await shot('12-main-phase-tap-on-it-does-nothing');
  await dragHold(hand(2, 0), selfSpellZone(0));
  await shot('13-counter-trap-from-hand-only-free-zones-light-up');
  await drop(selfSpellZone(0), 2500);
  await shot('14-counter-trap-set-at-once-no-activate-entry');
} finally {
  ws.close();
  edge.kill();
}
process.exit(missed === 0 ? 0 : 1);
