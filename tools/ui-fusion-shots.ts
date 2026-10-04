/**
 * Task 4.5b screenshots: Fusion on the REAL Sandbox page against the REAL API, with the real cards SMP-116 (fusion
 * Spell), SMP-045 / SMP-047 (Fusion Monsters), SMP-202 and SMP-209, driven by REAL mouse events in headless Edge:
 *  - `fusion-success-real`: the board before, the fusion Spell dragged from the hand → "Kích hoạt", the prompt "Chọn mục
 *    tiêu dung hợp" (2 candidates, "Chọn"), the prompt "Chọn 2 nguyên liệu dung hợp" (labels "Bài trên tay" / "Trên
 *    sân", "Đồng ý" lit only with 2 chosen), the Fusion Summon animation, the board after it and the Fusion Monster's
 *    own "when Summoned" effect (500 damage);
 *  - `fusion-material-destroyed-real`: the AI's Set Trap destroys the material on my field in response → no fusion;
 *  - `fusion-negated-real`: the AI seat's fusion Spell is on the chain → tap my Set Counter Trap → negated, crossed out;
 *  - the two prompts in English: the DEV fixtures fusion-monster / fusion-material on the game page with ?lang=en
 *    (the Sandbox page is Vietnamese only and never reads ?lang; a fixture needs no server).
 * The Sandbox page runs with ?slow=1 (animations 3x slower); the Fusion steps and the negation are caught by watching
 * the canvas for their colour (theme.colors.fusion / negate) inside a region of the board, so no timing is hard-coded
 * for those frames.
 * Needs the API, the web dev server and Edge; no dependencies.
 *   WEB_BASE=http://localhost:5173 node --experimental-strip-types tools/ui-fusion-shots.ts
 * Logical coordinates are the 1280x720 duel frame (layout.ts), mapped onto the canvas as it sits in the page.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';

const EDGE =
  process.env.EDGE ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const WEB = process.env.WEB_BASE ?? 'http://localhost:5173';
const OUT = process.env.OUT ?? 'docs/ai/review-packets/task-4.5b-screens';
const PORT = 9342;
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
async function click(p: P, wait = 900): Promise<void> {
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
/** Load a shipped sample by name and wait for the board (and whatever the script / the AI did first). */
async function load(name: string, wait = 6000): Promise<void> {
  await run(`(() => {
    const s = document.querySelector('select');
    s.value = ${JSON.stringify(name)};
    s.dispatchEvent(new Event('change'));
  })()`);
  await press('Nạp');
  await sleep(wait);
  await measureCanvas();
}
async function close(): Promise<void> {
  await press('Đóng ván');
  await sleep(500);
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

type Rgb = (r: number, g: number, b: number) => boolean;
/** A region of the duel frame, as fractions of its width / height. */
interface Box {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}
const WHOLE: Box = { x0: 0, y0: 0, x1: 1, y1: 1 };
/** Logical 1280x720 rectangle → Box. */
const box = (x: number, y: number, w: number, h: number): Box => ({
  x0: x / 1280,
  y0: y / 720,
  x1: (x + w) / 1280,
  y1: (y + h) / 720,
});
/** My hand band (y 628, 90 high) and the surroundings of my Monster Zone 0 (the swirl turns around its centre). */
const HAND_BAND = box(260, 620, 760, 100);
const ZONE_0_SWIRL = box(366, 392, 164, 124);
/** `theme.colors.negate` (0xff4d4d), drawn opaque when the step starts. */
const NEGATE_RED: Rgb = (r, g, b) => r > 225 && g > 50 && g < 135 && b > 50 && b < 135;
/**
 * `theme.colors.fusion` (0xb07cff = 176, 124, 255), drawn opaque when a Fusion step starts and then faded out. The range
 * is wide enough to still match at about three quarters of the opacity (a strict match only lasts the first ~150 ms).
 */
const FUSION_PURPLE: Rgb = (r, g, b) =>
  r > 135 && r < 195 && g > 92 && g < 145 && b > 195 && b - g > 85;
/**
 * The same colour down to about half its opacity over the dark board: the material step lasts 0.6 s here and fades
 * from its first frame, so the stricter match above would often fall between two grabs.
 */
const FUSION_FADING: Rgb = (r, g, b) =>
  r > 85 && r < 195 && g > 70 && g < 145 && b > 135 && b - g > 50 && b - r > 40;

/**
 * How many pixels of a PNG screenshot match `isColour` inside `region`. Minimal PNG reader (8-bit RGB / RGBA, no
 * interlace — what Edge produces); no dependency.
 */
function countPixels(png: Buffer, tests: readonly PixelTest[]): number[] {
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
  const counts = tests.map(() => 0);
  const rows = raw.length / (stride + 1);
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
    for (const [t, test] of tests.entries()) {
      const region = test.box ?? WHOLE;
      if (y < region.y0 * rows || y >= region.y1 * rows) continue;
      for (let x = Math.floor(region.x0 * width); x < region.x1 * width; x++) {
        if (test.isColour(line[x * channels]!, line[x * channels + 1]!, line[x * channels + 2]!)) {
          counts[t]!++;
        }
      }
    }
    prev = line;
  }
  return counts;
}

interface PixelTest {
  readonly isColour: Rgb;
  readonly box?: Box;
}
interface Catch extends PixelTest {
  readonly name: string;
  readonly threshold: number;
}

let missed = 0;
/**
 * Tap `at`, then watch the duel canvas while the animation plays and save the first frame that shows each wanted
 * colour in its region (a material lighting up, the Fusion swirl, the red cross…), whatever the timing of this
 * machine; then wait `after` ms for the rest. Only the canvas is grabbed (a small PNG is quick to take, so a short step
 * is not missed); the saved frame is that grab.
 */
async function tapAndCatch(at: P, wanted: readonly Catch[], after: number): Promise<void> {
  const clipOf = (region: Box): Record<string, number> => {
    const [x, y] = toPage([region.x0 * 1280, region.y0 * 720]);
    const [x2, y2] = toPage([region.x1 * 1280, region.y1 * 720]);
    return { x, y, width: x2 - x, height: y2 - y, scale: 1 };
  };
  const grab = async (region: Box): Promise<Buffer> => {
    const r = (await cdp('Page.captureScreenshot', {
      format: 'png',
      clip: clipOf(region),
    })) as { data: string };
    return Buffer.from(r.data, 'base64');
  };
  // Each wanted colour is looked for in a grab of ITS region only (a small PNG is taken and read much faster than the
  // whole canvas, so a 0.6 s step is not missed); the frame that is saved is the whole canvas, grabbed right after.
  const probe = async (w: Catch): Promise<number> =>
    countPixels(await grab(w.box ?? WHOLE), [{ isColour: w.isColour }])[0]!;
  const quiet: number[] = [];
  for (const w of wanted) quiet.push(await probe(w));
  await mouse('mouseMoved', at);
  await mouse('mousePressed', at);
  await mouse('mouseReleased', at);
  const saved = new Set<string>();
  for (let i = 0; i < 400 && saved.size < wanted.length; i++) {
    for (const [k, w] of wanted.entries()) {
      if (saved.has(w.name)) continue;
      const seen = (await probe(w)) - quiet[k]!;
      if (seen <= w.threshold) continue;
      writeFileSync(join(OUT, `${w.name}.png`), await grab(WHOLE));
      console.log(`  saved ${w.name}.png (probe ${i}, ${seen} matching pixels)`);
      saved.add(w.name);
    }
  }
  for (const w of wanted) {
    if (saved.has(w.name)) continue;
    missed++;
    console.log(`  MISSED ${w.name}: the step was never seen`);
  }
  await sleep(after);
}

// layout.ts: zone rows start at x=406, step 96, zone 84x104. Own Spell/Trap row y=516, own monsters y=402. Hand of n
// cards: 64x90 at y=628, step 72, centred on x=640. The selection bar's first button ("Chọn" / "Đồng ý") is at (777, 374).
// A Fusion picker of n cards: 64x90 cards, step 72, centred on x=640, at y=204 (a label line under each card).
// The option menu opens at the drop point: 160x40 entries stacked from there ("Kích hoạt" first).
const col = (i: number): number => 406 + i * 96 + 42;
const selfSpellZone = (i: number): P => [col(i), 568];
const hand = (count: number, i: number): P => [
  640 - (64 + 72 * (count - 1)) / 2 + i * 72 + 32,
  673,
];
const picker = (count: number, i: number): P => [
  640 - (64 + 72 * (count - 1)) / 2 + i * 72 + 32,
  249,
];
const CONFIRM: P = [777, 374];
const menuEntry = (drop: P, i: number): P => [drop[0] + 80, drop[1] + 20 + i * 44];

/** Drag the fusion Spell (hand card 0 of `count`) onto my Spell/Trap Zone 0 and choose "Kích hoạt" in the menu. */
async function activateFusionSpell(
  count: number,
  wait: number,
  shots?: [string, string],
): Promise<void> {
  const zone = selfSpellZone(0);
  await dragHold(hand(count, 0), zone);
  if (shots) await shot(shots[0]);
  await drop(zone, 700);
  if (shots) await shot(shots[1]);
  await click(menuEntry(zone, 0), wait);
}

try {
  await cdp('Page.enable');
  await cdp('Emulation.setDeviceMetricsOverride', {
    width: 1300,
    height: 1240,
    deviceScaleFactor: 1,
    mobile: false,
  });
  // Headless Edge: a page opened by a later navigation does not count as focused, and Phaser then ignores the pointer.
  await cdp('Emulation.setFocusEmulationEnabled', { enabled: true });
  await cdp('Page.navigate', { url: `${WEB}/dev/sandbox.html?slow=1` });
  await sleep(2500);

  console.log('fusion-success-real');
  await load('fusion-success-real');
  await hover(hand(4, 0));
  await shot('01-board-before-fusion-spell-in-hand-extra-deck-3');
  await activateFusionSpell(4, 9000, [
    '02-dragging-the-fusion-spell-spell-zones-light-up',
    '03-menu-activate-or-set',
  ]);
  await shot('04-prompt-choose-the-fusion-monster-2-candidates-button-off');
  await hover(picker(2, 1));
  await click(picker(2, 1), 600);
  await shot('05-fusion-monster-chosen-button-chon-lit');
  await click(CONFIRM, 2500);
  await shot('06-prompt-choose-2-materials-labels-hand-and-field-button-off');
  await click(picker(2, 0), 500);
  await shot('07-one-material-chosen-button-still-off');
  await click(picker(2, 1), 500);
  await shot('08-both-materials-chosen-button-dong-y-lit');
  await tapAndCatch(
    CONFIRM,
    [
      // The first material leaves my hand (the hand band lights up), then the swirl on Monster Zone 0.
      {
        name: '09-fusion-material-leaves-the-hand',
        isColour: FUSION_FADING,
        threshold: 500,
        box: HAND_BAND,
      },
      {
        name: '10-fusion-summon-swirl-on-monster-zone-0',
        isColour: FUSION_PURPLE,
        threshold: 150,
        box: ZONE_0_SWIRL,
      },
    ],
    26000,
  );
  await shot('11-after-fusion-monster-on-field-materials-in-graveyard-trigger-500-damage-log');
  await close();

  console.log('fusion-material-destroyed-real');
  await load('fusion-material-destroyed-real');
  await shot('12-before-the-ai-has-a-set-trap-my-material-on-the-field');
  await activateFusionSpell(3, 55000); // two chain links at a third of the speed, the AI's answer included
  await shot('13-material-destroyed-in-response-no-fusion-spell-in-graveyard-log');
  await close();

  console.log('fusion-negated-real');
  await load('fusion-negated-real', 14000);
  await hover(selfSpellZone(2));
  await shot('14-ai-fusion-spell-on-the-chain-my-counter-trap-outlined-its-extra-deck-is-a-number');
  await tapAndCatch(
    selfSpellZone(2),
    [{ name: '15-fusion-spell-negated-crossed-out', isColour: NEGATE_RED, threshold: 300 }],
    30000,
  );
  await shot('16-negated-no-material-used-ai-extra-deck-still-1-log');
  await close();

  console.log('English (?lang=en): the DEV fixtures on the game page (no server involved)');
  await cdp('Page.navigate', { url: `${WEB}/?fixture=fusion-monster&lang=en` });
  await sleep(3500);
  await cdp('Page.bringToFront');
  await measureCanvas();
  await hover(picker(2, 0));
  await click(picker(2, 0), 600);
  await shot('17-en-fixture-choose-the-fusion-target-choose-lit');
  await cdp('Page.navigate', { url: `${WEB}/?fixture=fusion-material&lang=en` });
  await sleep(3500);
  await cdp('Page.bringToFront');
  await measureCanvas();
  await hover(picker(3, 0));
  await click(picker(3, 0), 500);
  await click(picker(3, 2), 500);
  await shot('18-en-fixture-choose-2-fusion-materials-in-hand-on-the-field-ok-lit');
} finally {
  ws.close();
  edge.kill();
}
process.exit(missed === 0 ? 0 : 1);
