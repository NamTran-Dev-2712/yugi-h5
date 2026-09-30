/**
 * Plays one full solo-vs-ai duel over the REAL HTTP API as the human (seat 0) and checks what comes back: the server
 * plays the AI seat inside each response, control always returns to the human, the AI never surrenders, nothing about
 * the AI's hand/face-down cards leaks, and the AI seat cannot be controlled or viewed. Needs the API + Postgres running.
 *   node --experimental-strip-types tools/play-vs-ai.ts
 * The human plays a simple, legal-only policy taken from `legalActions` (attack directly, else attack, else summon,
 * else end the phase), so every action it sends must be accepted. After MAX_ACTIONS it surrenders to end the duel.
 * Task 3.8: `DECK=effect` plays both seats with `EFFECT_DEMO_DECK` (real effect cards; read from the BUILT shared
 * package, so run `pnpm build` or `pnpm dev` first). The human then also Sets Spells/Traps, activates in chain /
 * reaction windows (else passes) and accepts trigger prompts; the run must see real chain links and windows.
 * Task 4.1: `DECK=batch1` plays both seats with `BATCH1_DEMO_DECK` (card batch 1: basic Spells/Traps + vanilla);
 * the run must see real chain links (the human activates batch-1 Spells/Traps).
 * Task 4.2d: `DECK=mech` plays both seats with `MECH_DEMO_DECK` (SMP-044 OnFlip, SMP-111 Special Summon, SMP-112 Equip);
 * the human Sets SMP-044 and Flip Summons it later, and uses the two Spells; the run must see a Flip Summon, a
 * Special Summon or an Equip, and `equippedTo` on the wire whenever something was equipped.
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

const EFFECT_DECK = process.env.DECK === 'effect';
const BATCH1_DECK = process.env.DECK === 'batch1';
const MECH_DECK = process.env.DECK === 'mech';

/** Cards of the AI seat still hidden from the human in this very view (hand + face-down monsters and Spells/Traps). */
function aiHidden(view: ViewV): Set<string> {
  const p = view.players[1];
  const ids = new Set<string>(p.hand.filter((c) => c.hidden).map((c) => c.instanceId));
  for (const c of p.board.monsterZones) if (c?.hidden) ids.add(c.instanceId);
  for (const c of p.board.spellTrapZones ?? []) if (c?.hidden) ids.add(c.instanceId);
  return ids;
}

/** One of my hand cards is `definitionId` (the human sees its own hand). */
function isOwnCard(view: ViewV, instanceId: string, definitionId: string): boolean {
  return view.players[0].hand.some(
    (c) => c.instanceId === instanceId && c.definitionId === definitionId,
  );
}

function chooseHuman(view: ViewV, legal: Action[]): Action {
  const inWindow = view.chainWindow?.priorityPlayer === 0;
  const rank = (a: Action): number => {
    if (a.type === 'ResolvePendingPrompt') return a.payload.decline === true ? 0.5 : 0;
    if (inWindow) return a.type === 'ActivateEffect' ? 0 : a.type === 'PassPriority' ? 1 : 99;
    if (a.type === 'DeclareAttack') return a.payload.targetInstanceId == null ? 1 : 2;
    // Task 4.2d (DECK=mech): Flip Summon a Set monster, and Set SMP-044 rather than Summoning it (to flip it later).
    if (a.type === 'FlipSummon') return 2.5;
    if (
      a.type === 'SetMonster' &&
      MECH_DECK &&
      isOwnCard(view, a.payload.cardInstanceId, 'SMP-044')
    )
      return 2.8;
    if (a.type === 'NormalSummon') return 3;
    // DECK=mech: the Special Summon / Equip Spells are worth activating, not Setting (a Set Normal Spell is dead).
    if (a.type === 'ActivateEffect' && MECH_DECK) return 3.9;
    if (a.type === 'SetSpellTrap') return 4;
    if (a.type === 'ActivateEffect') return 5;
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
  let deck: readonly string[] | undefined;
  if (EFFECT_DECK) {
    const shared = (await import('../packages/shared/dist/index.js')) as {
      EFFECT_DEMO_DECK: readonly string[];
    };
    deck = shared.EFFECT_DEMO_DECK;
    say(`   deck: EFFECT_DEMO_DECK (${deck.length} cards)`);
  } else if (BATCH1_DECK) {
    const shared = (await import('../packages/shared/dist/index.js')) as {
      BATCH1_DEMO_DECK: readonly string[];
    };
    deck = shared.BATCH1_DEMO_DECK;
    say(`   deck: BATCH1_DEMO_DECK (${deck.length} cards)`);
  } else if (MECH_DECK) {
    const shared = (await import('../packages/shared/dist/index.js')) as {
      MECH_DEMO_DECK: readonly string[];
    };
    deck = shared.MECH_DEMO_DECK;
    say(`   deck: MECH_DEMO_DECK (${deck.length} cards)`);
  }
  const created = await call('POST', '/duels/solo', {
    token,
    body: { mode: 'solo-vs-ai', ...(deck ? { deck } : {}) },
  });
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
  const seen = {
    chainLinks: 0,
    humanWindows: 0,
    humanTriggerPrompts: 0,
    aiChainActs: 0,
    effAtk: 0,
    flipSummons: 0,
    specialSummons: 0,
    equips: 0,
    equippedToOnWire: 0,
  };
  while (res.view.winnerIndex === null) {
    if (res.view.chainWindow?.priorityPlayer === 0) seen.humanWindows++;
    if (res.view.pendingPrompt?.kind === 'TriggerActivation') seen.humanTriggerPrompts++;
    const board = res.view.players.flatMap((p) => p.board.monsterZones);
    if (board.some((c) => c?.effectiveStats !== undefined)) seen.effAtk++;
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
    seen.chainLinks += res.events.filter((e) => e.type === 'ChainLinkAdded').length;
    seen.flipSummons += res.events.filter((e) => e.type === 'FlipSummoned').length;
    seen.specialSummons += res.events.filter((e) => e.type === 'MonsterSpecialSummoned').length;
    seen.equips += res.events.filter((e) => e.type === 'CardEquipped').length;
    const backrow = res.view.players.flatMap((p) => p.board.spellTrapZones ?? []);
    if (backrow.some((c) => c?.equippedTo !== undefined)) seen.equippedToOnWire++;
    seen.aiChainActs += steps.filter(
      (s) => s.action.type === 'PassPriority' || s.action.type === 'ActivateEffect',
    ).length;
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
      // Same "who acts" as the server: prompt, then chain priority, then the turn player.
      const actor =
        res.view.pendingPrompt?.playerIndex ??
        res.view.chainWindow?.priorityPlayer ??
        res.view.turnPlayerIndex;
      const humanToAct = actor === 0;
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
  say(`   effect stats: ${JSON.stringify(seen)}`);
  if (EFFECT_DECK) {
    check('real chain links were added over HTTP', seen.chainLinks > 0, JSON.stringify(seen));
    check('the human held a chain / reaction window', seen.humanWindows > 0, JSON.stringify(seen));
    check('effective ATK/DEF reached the wire', seen.effAtk > 0, JSON.stringify(seen));
  }
  if (BATCH1_DECK) {
    check('batch-1 chain links were added over HTTP', seen.chainLinks > 0, JSON.stringify(seen));
  }
  if (MECH_DECK) {
    check('a Flip Summon happened over HTTP', seen.flipSummons > 0, JSON.stringify(seen));
    check(
      'a Special Summon or an Equip happened over HTTP',
      seen.specialSummons + seen.equips > 0,
      JSON.stringify(seen),
    );
    check(
      'equippedTo reached the wire whenever something was equipped',
      seen.equips === 0 || seen.equippedToOnWire > 0,
      JSON.stringify(seen),
    );
  }

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
