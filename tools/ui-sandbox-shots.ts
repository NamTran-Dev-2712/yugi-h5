/**
 * Real Sandbox page (/dev/sandbox.html) in headless Edge against the REAL API: picks each sample scenario, presses
 * "Nạp", screenshots the loaded duel; also screenshots a JSON error and a server refusal (unknown card id).
 * Needs API (:3000), web dev server (:5173) and Edge; no dependencies.
 *   node --experimental-strip-types tools/ui-sandbox-shots.ts
 */
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EDGE =
  process.env.EDGE ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const WEB = process.env.WEB_BASE ?? 'http://localhost:5173';
const OUT = process.env.OUT ?? 'docs/ai/review-packets/task-2.11-screens';
const PORT = 9336;
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
const run = (expression: string): Promise<unknown> =>
  cdp('Runtime.evaluate', { expression, awaitPromise: true });
async function shot(name: string): Promise<void> {
  const r = (await cdp('Page.captureScreenshot', { format: 'png' })) as { data: string };
  writeFileSync(join(OUT, `${name}.png`), Buffer.from(r.data, 'base64'));
  console.log(`  saved ${name}.png`);
}
/** Types `text` into the textarea (bypassing the picker) and presses Nạp. */
const loadText = (text: string): Promise<unknown> =>
  run(`(() => {
    const t = document.querySelector('textarea');
    t.value = ${JSON.stringify(text)};
    [...document.querySelectorAll('button')].find((b) => b.textContent === 'Nạp').click();
  })()`);
const pick = (name: string): Promise<unknown> =>
  run(`(() => {
    const s = document.querySelector('select');
    s.value = ${JSON.stringify(name)};
    s.dispatchEvent(new Event('change'));
  })()`);
const press = (label: string): Promise<unknown> =>
  run(
    `[...document.querySelectorAll('button')].find((b) => b.textContent === ${JSON.stringify(label)}).click()`,
  );

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
  await shot('01-empty-page');
  for (const [i, name] of ['tribute-summon', 'attack-defense', 'chain-basic'].entries()) {
    await pick(name);
    await press('Nạp');
    await sleep(3500);
    await shot(`0${i + 2}-${name}`);
    await press('Đóng ván');
    await sleep(300);
  }
  await loadText('{ "name": ');
  await sleep(300);
  await shot('05-json-error');
  await pick('tribute-summon');
  await run(
    `(() => { const t = document.querySelector('textarea'); t.value = t.value.replace('SMP-003', 'NOPE-1'); })()`,
  );
  await press('Nạp');
  await sleep(1500);
  await shot('06-server-refusal');
} finally {
  ws.close();
  edge.kill();
}
process.exit(0);
