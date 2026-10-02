/**
 * Task 3.7 screenshots with REAL mouse events in headless Edge (Chrome DevTools Protocol), on the DEV chain fixtures
 * (the card pool the server knows has no Set card with an effect yet, so these use test-only FIX-* cards):
 *  - `?fixture=chain-reaction`: the AI attacks, reaction banner, "Bỏ qua" button, my activatable Set card outlined;
 *    tap the Set card (C13: no dialog) / press "Bỏ qua" -> the fixture logs "sẽ gửi: …".
 *  - `?fixture=chain-respond`: an ordinary chain banner, two activatable Set cards, effective ATK/DEF on the board and
 *    in the detail panel.
 *  - `?fixture=trigger-optional`: the TriggerActivation Yes/No overlay, choose a target, "Kích hoạt".
 * Needs the web dev server (:5173) and Edge; no API, no dependencies.
 *   node --experimental-strip-types tools/ui-chain-shots.ts
 * Logical coordinates are the 1280x720 duel frame (layout.ts); they are mapped onto the canvas as it sits in the page.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EDGE =
  process.env.EDGE ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const WEB = process.env.WEB_BASE ?? 'http://localhost:5173';
const OUT = process.env.OUT ?? 'docs/ai/review-packets/task-3.7-screens';
const PORT = 9338;
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
async function click(p: P): Promise<void> {
  await mouse('mouseMoved', p);
  await mouse('mousePressed', p);
  await mouse('mouseReleased', p);
  await sleep(300);
}
async function open(fixture: string, lang = 'vi'): Promise<void> {
  await cdp('Page.navigate', { url: `${WEB}/?fixture=${fixture}&lang=${lang}` });
  await sleep(3000);
  await measureCanvas();
}

// layout.ts: zone rows start at x=406, step 96, zone 84x104; own Spell/Trap row y=516, own monster row y=402,
// opponent monster row y=214. "Phase tiếp theo" / "Bỏ qua" button 1032,476 232x56; Confirm 702,354 / Cancel 862,354 (task 4.3b).
const selfSpellZone = (i: number): P => [406 + i * 96 + 42, 568];
const selfZone = (i: number): P => [406 + i * 96 + 42, 454];
const oppZone = (i: number): P => [406 + i * 96 + 42, 266];
const PASS: P = [1148, 504];
const CONFIRM: P = [777, 374]; // task 4.3b: the confirm bar moved under the turn/phase line (layout.overlay.confirm 702,354 150x40)

try {
  await cdp('Page.enable');
  await cdp('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 720,
    deviceScaleFactor: 1,
    mobile: false,
  });

  console.log('chain-reaction');
  await open('chain-reaction');
  await shot('01-reaction-banner-pass-outlined-trap');
  await mouse('mouseMoved', selfSpellZone(1));
  await sleep(200);
  await shot('02-hover-set-trap-detail');
  await click(selfSpellZone(1));
  await shot('03-tap-set-trap-sends-activate');
  await open('chain-reaction');
  await click(PASS);
  await shot('04-press-pass-sends-passpriority');

  console.log('chain-respond');
  await open('chain-respond');
  await shot('05-chain-banner-two-activatable-effective-stats');
  await mouse('mouseMoved', selfZone(3));
  await sleep(200);
  await shot('06-detail-effective-vs-printed');

  console.log('trigger-optional');
  await open('trigger-optional');
  await shot('07-trigger-yes-no-overlay');
  await click(oppZone(3));
  await shot('08-trigger-target-chosen');
  await click(CONFIRM);
  await shot('09-trigger-activate-sent');

  console.log('English');
  await open('chain-reaction', 'en');
  await shot('10-en-reaction-banner-pass');
  await open('trigger-optional', 'en');
  await shot('11-en-trigger-overlay');
} finally {
  ws.close();
  edge.kill();
}
process.exit(0);
