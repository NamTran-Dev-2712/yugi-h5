/**
 * Task 3.2b screenshots with REAL mouse events in headless Edge (Chrome DevTools Protocol):
 *  1. Sandbox page (/dev/sandbox.html) against the REAL API: a scenario with SMP-101 (Spell) and SMP-201 (Trap) in
 *     hand -> drag the Trap onto a Spell/Trap Zone (Set), drag the Spell (menu Kích hoạt / Úp), activate it (animation,
 *     then the drawn card, the Spell in the graveyard and the new log lines).
 *  2. DEV fixture `?fixture=effect-target` (no sample card opens a target prompt yet): the target selection overlay.
 * Needs API (:3000), web dev server (:5173) and Edge; no dependencies.
 *   node --experimental-strip-types tools/ui-spell-shots.ts
 * Logical coordinates are the 1280x720 duel frame (layout.ts); they are mapped onto the canvas as it sits in the page.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EDGE =
  process.env.EDGE ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const WEB = process.env.WEB_BASE ?? 'http://localhost:5173';
const OUT = process.env.OUT ?? 'docs/ai/review-packets/task-3.2b-screens';
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
/** Logical frame point -> page point, from where the canvas is drawn right now. */
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
  await mouse('mousePressed', p);
  await mouse('mouseReleased', p);
  await sleep(250);
}
async function drag(from: P, to: P, shotName?: string): Promise<void> {
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

// layout.ts: zone rows start at x=406, step 96, zone 84x104; own Spell/Trap row y=516, own monster row y=402;
// hand band x 260..1020, y 628 (cards 64x90, step 72, centred).
const selfSpellZone = (i: number): P => [406 + i * 96 + 42, 568];
const oppZone = (i: number): P => [406 + i * 96 + 42, 266];
const handCard = (i: number, n: number): P => {
  const total = 64 + 72 * (n - 1);
  return [260 + (760 - total) / 2 + i * 72 + 32, 673];
};
const firstOption = (drop: P): P => [drop[0] + 80, drop[1] + 20];
const CONFIRM: P = [555, 371];

const SCENARIO = {
  name: 'spell-trap-shots',
  seed: 'task-3.2b-shots',
  players: [
    {
      lp: 8000,
      hand: ['SMP-101', 'SMP-201', 'SMP-001'],
      deck: ['SMP-005', 'SMP-006', 'SMP-007', 'SMP-008', 'SMP-009', 'SMP-010'],
      field: {
        monsters: [{ card: 'SMP-006', zone: 2, position: 'Attack', summonedTurn: 1 }],
        spellTraps: [],
      },
      gy: [],
    },
    {
      lp: 8000,
      hand: ['SMP-007', 'SMP-004'],
      deck: ['SMP-004', 'SMP-005', 'SMP-009', 'SMP-010', 'SMP-012', 'SMP-014'],
      field: {
        monsters: [{ card: 'SMP-008', zone: 2, position: 'Attack', summonedTurn: 1 }],
        spellTraps: [{ card: 'SMP-201', zone: 1, position: 'DefenseDown' }],
      },
      gy: [],
    },
  ],
  turn: { count: 3, player: 0 },
  phase: 'Main1',
};

try {
  await cdp('Page.enable');
  await cdp('Emulation.setDeviceMetricsOverride', {
    width: 1300,
    height: 1240,
    deviceScaleFactor: 1,
    mobile: false,
  });

  console.log('sandbox (real API)');
  await cdp('Page.navigate', { url: `${WEB}/dev/sandbox.html` });
  await sleep(2500);
  await run(`(() => {
    const t = document.querySelector('textarea');
    t.value = ${JSON.stringify(JSON.stringify(SCENARIO, null, 2))};
    [...document.querySelectorAll('button')].find((b) => b.textContent === 'Nạp').click();
  })()`);
  await sleep(3500);
  await measureCanvas();
  await shot('01-loaded-spell-trap-in-hand');

  // Trap (Set only): lit Spell/Trap Zones while dragging, sent at once on drop.
  await drag(handCard(1, 3), selfSpellZone(3), '02-drag-trap-zones-lit');
  await sleep(1500);
  await shot('03-trap-set-face-down');

  // Spell: menu Kích hoạt / Úp at the drop point.
  await drag(handCard(0, 2), selfSpellZone(1));
  await sleep(200);
  await shot('04-spell-menu-activate-or-set');
  await click(firstOption(selfSpellZone(1)));
  await sleep(350);
  await shot('05-activate-animation');
  await sleep(4000);
  await shot('06-activated-drew-card-log');

  console.log('fixture effect-target (DEV)');
  await cdp('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 720,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await cdp('Page.navigate', { url: `${WEB}/?fixture=effect-target` });
  await sleep(3000);
  await measureCanvas();
  await shot('07-target-prompt-select');
  await click(oppZone(3)); // the face-down candidate, known only by position
  await shot('08-target-chosen');
  await click(CONFIRM);
  await shot('09-target-sent-fixture');

  console.log('fixture spell (DEV, English)');
  await cdp('Page.navigate', { url: `${WEB}/?fixture=spell&lang=en` });
  await sleep(3000);
  await measureCanvas();
  await drag(handCard(1, 3), selfSpellZone(2));
  await sleep(200);
  await shot('10-en-spell-menu');
} finally {
  ws.close();
  edge.kill();
}
process.exit(0);
