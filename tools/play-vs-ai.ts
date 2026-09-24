/**
 * Plays one full solo-vs-ai duel over the REAL HTTP API as the human (seat 0) and checks what comes back: the server
 * plays the AI seat inside each response, control always returns to the human, the AI never surrenders, nothing about
 * the AI's hand/face-down cards leaks, and the AI seat cannot be controlled or viewed. Needs the API + Postgres running.
 *   node --experimental-strip-types tools/play-vs-ai.ts
 * The human plays a simple, legal-only policy taken from `legalActions` (attack directly, else attack, else summon,
 * else end the phase), so every action it sends must be accepted. After MAX_ACTIONS it surrenders to end the duel.
 */
import {
  BASE,
  call,
  findLeaks,
  type CardV,
  type EventV,
  type Seat,
  type ViewV,
} from './lib/http.ts';

interface Action {
  type: string;
  payload: { playerIndex: Seat; [k: string]: unknown };
}
interface AiStep {
  action: Action;
  eventsFrom: number;
  eventsTo: number;
}
interface Response {
  view: ViewV;
  events: EventV[];
  legalActions: Action[];
  aiActions?: AiStep[];
  duelId?: string;
  mode?: string;
  aiSeat?: Seat;
  viewer?: Seat;
}

const MAX_ACTIONS = 400;
const results: { name: string; ok: boolean; detail: string }[] = [];
const say = (s: string): void => console.log(s);
function check(name: string, ok: boolean, detail = ''): void {
  results.push({ name, ok, detail });
  if (!ok) say(`   FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
}

/** Cards of the AI seat still hidden from the human in this very view (hand + face-down monsters). */
function aiHidden(view: ViewV): Set<string> {
  const p = view.players[1];
  const ids = new Set<string>(p.hand.filter((c) => c.hidden).map((c) => c.instanceId));
  for (const c of p.board.monsterZones) if (c?.hidden) ids.add(c.instanceId);
  return ids;
}

function chooseHuman(view: ViewV, legal: Action[]): Action {
  const rank = (a: Action): number => {
    if (a.type === 'ResolvePendingPrompt') return 0;
    if (a.type === 'DeclareAttack') return a.payload.targetInstanceId == null ? 1 : 2;
    if (a.type === 'NormalSummon') return 3;
    if (a.type === 'EndPhase') return 9;
    return 99; // Surrender/SetMonster/ChangePosition only if nothing better
  };
  const sorted = [...legal].sort((a, b) => rank(a) - rank(b));
  const pick = sorted.find((a) => a.type !== 'Surrender') ?? sorted[0];
  if (!pick) throw new Error(`no legal action at ${view.phase}`);
  return pick;
}

async function main(): Promise<void> {
  say(`play-vs-ai against ${BASE}`);
  const guest = await call('POST', '/auth/guest');
  const token = (guest.json as { accessToken: string }).accessToken;
  const created = await call('POST', '/duels/solo', { token, body: { mode: 'solo-vs-ai' } });
  check('POST /duels/solo mode solo-vs-ai → 201', created.status === 201, `${created.status}`);
  let res = created.json as Response;
  const duelId = res.duelId ?? '';
  check('mode/aiSeat/viewer', res.mode === 'solo-vs-ai' && res.aiSeat === 1 && res.viewer === 0);
  check('opening response has no leak', findLeaks(res, aiHidden(res.view)).length === 0);

  const look = await call('GET', `/duels/${duelId}?viewer=1`, { token });
  check('GET ?viewer=AI seat → 403', look.status === 403, `${look.status}`);
  const act = await call('POST', `/duels/${duelId}/actions`, {
    token,
    body: { playerIndex: 1, action: { type: 'EndPhase', payload: { playerIndex: 1 } } },
  });
  check('POST action for the AI seat → 403', act.status === 403, `${act.status}`);
  const bad = await call('POST', '/duels/solo', { token, body: { mode: 'solo-vs-ai', viewer: 1 } });
  check('create with viewer=AI seat → 400', bad.status === 400, `${bad.status}`);

  let humanActions = 0;
  let aiActions = 0;
  let aiTurns = 0;
  let lastVersion = res.view.version;
  let surrendered = false;
  while (res.view.winnerIndex === null) {
    if (humanActions >= MAX_ACTIONS && !surrendered) {
      surrendered = true;
      say(`   ${MAX_ACTIONS} actions reached: the human surrenders to end the duel`);
    }
    const action = surrendered
      ? ({ type: 'Surrender', payload: { playerIndex: 0 } } as Action)
      : chooseHuman(res.view, res.legalActions);
    const listed = res.legalActions.some((a) => JSON.stringify(a) === JSON.stringify(action));
    check(`human action ${action.type} is in legalActions`, listed || surrendered);
    const r = await call('POST', `/duels/${duelId}/actions`, {
      token,
      body: { playerIndex: 0, action },
    });
    humanActions++;
    if (r.status !== 200) {
      check(
        `human action #${humanActions} ${action.type} accepted`,
        false,
        `${r.status} ${r.text}`,
      );
      break;
    }
    res = r.json as Response;
    const leaks = findLeaks(res, aiHidden(res.view));
    if (leaks.length > 0) check(`no leak after #${humanActions}`, false, leaks.join('; '));
    const steps = res.aiActions ?? [];
    aiActions += steps.length;
    if (steps.length > 0) aiTurns++;
    if (steps.some((s) => s.action.type === 'Surrender')) check('AI never surrenders', false);
    if (steps.some((s) => s.action.payload.playerIndex !== 1))
      check('AI acts only as seat 1', false);
    if (!steps.every((s) => s.eventsFrom <= s.eventsTo && s.eventsTo <= res.events.length)) {
      check(
        'aiActions slices lie inside events',
        false,
        JSON.stringify(steps.map((s) => [s.eventsFrom, s.eventsTo])),
      );
    }
    if (res.view.version <= lastVersion)
      check('version grows', false, `${lastVersion} → ${res.view.version}`);
    lastVersion = res.view.version;
    if (res.view.winnerIndex === null) {
      const prompt = res.view.pendingPrompt;
      const humanToAct = prompt ? prompt.playerIndex === 0 : res.view.turnPlayerIndex === 0;
      if (!humanToAct)
        check('control is back with the human', false, `turnPlayer ${res.view.turnPlayerIndex}`);
      if (!res.legalActions.every((a) => a.payload.playerIndex === 0)) {
        check('legalActions belong to the human seat', false);
      }
    }
    if (results.some((x) => !x.ok)) break;
  }
  check('AI never surrenders (final)', surrendered ? res.view.winnerIndex === 1 : true);
  check('duel ended', res.view.winnerIndex !== null, `winner ${String(res.view.winnerIndex)}`);
  const after = await call('POST', `/duels/${duelId}/actions`, {
    token,
    body: { playerIndex: 0, action: { type: 'EndPhase', payload: { playerIndex: 0 } } },
  });
  check('actions after the end are refused (409)', after.status === 409, `${after.status}`);

  const failed = results.filter((r) => !r.ok);
  say(
    `\nhuman actions ${humanActions}, AI actions ${aiActions} over ${aiTurns} responses, winner ${String(res.view.winnerIndex)}, ` +
      `turns ${res.view.turnCount}`,
  );
  say(`${results.length - failed.length}/${results.length} checks passed`);
  for (const f of failed) say(`  FAIL ${f.name} ${f.detail}`);
  if (failed.length > 0) process.exit(1);
}

void main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});

export type { CardV };
