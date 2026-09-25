/**
 * Plays one short solo-debug duel over the REAL HTTP API and checks what comes back (phase order, draws, LP, damage
 * vs the rule sheet, error codes, hidden-information leaks). It only catches obvious bugs before a human plays; it is
 * NOT a substitute for the manual session in docs/design/debug-ui.md.
 *   node --experimental-strip-types tools/play-duel.ts
 * P0 is aggressive (summon, attack, direct attack); P1 only sets one monster and passes, so the duel ends by LP 0.
 * A second short duel ends by Surrender.
 */
import {
  BASE,
  call,
  findLeaks,
  hiddenFrom,
  type CardV,
  type EventV,
  type Seat,
  type ViewV,
} from './lib/http.ts';

interface CardDef {
  id: string;
  kind: string;
  name: string;
  level?: number;
  atk?: number;
  def?: number;
}
interface Act {
  status: number;
  view?: ViewV;
  events: EventV[];
  code?: string;
  engineCode?: string;
}

const PHASES = ['Draw', 'Standby', 'Main1', 'Battle', 'Main2', 'End'];
const defs = new Map<string, CardDef>();
const results: { name: string; ok: boolean; detail: string }[] = [];
const findings: string[] = [];
const views: [ViewV | null, ViewV | null] = [null, null];
let token = '';
let duelId = '';
let leakProblems = 0;

const say = (s: string): void => console.log(s);
function check(name: string, ok: boolean, detail = ''): void {
  results.push({ name, ok, detail });
  say(`   ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) findings.push(`${name}${detail ? ` — ${detail}` : ''}`);
}

const cardDef = (c: CardV | null | undefined): CardDef | undefined =>
  c?.definitionId ? defs.get(c.definitionId) : undefined;
const own = (v: ViewV, seat: Seat): CardV[] =>
  v.players[seat].board.monsterZones.filter((c): c is CardV => c !== null);
const view = (seat: Seat): ViewV => {
  const v = views[seat];
  if (!v) throw new Error(`no view for seat ${seat}`);
  return v;
};

async function refresh(seat: Seat): Promise<ViewV> {
  const r = await call('GET', `/duels/${duelId}?viewer=${seat}`, { token });
  if (r.status !== 200) throw new Error(`GET view ${seat} → ${r.status} ${r.text}`);
  const v = (r.json as { view: ViewV }).view;
  views[seat] = v;
  return v;
}

/** Hidden ids of the OTHER seat that a response to `sender` must not expose (minus cards the events just revealed). */
function hiddenFromOpponent(sender: Seat, events: EventV[]): Set<string> {
  const opp = (1 - sender) as Seat;
  const oppView = views[opp];
  if (!oppView) return new Set();
  const revealed = new Set(
    events
      .filter((e) => e.type === 'MonsterFlipped' || e.type === 'MonsterDestroyed')
      .map((e) => String(e.instanceId)),
  );
  return new Set([...hiddenFrom(oppView, opp)].filter((id) => !revealed.has(id)));
}

/** Same action, one spelling: sorted keys, null/undefined fields dropped (a direct attack has no target). */
function canon(type: string, payload: Record<string, unknown>): string {
  const keys = Object.keys(payload)
    .filter((k) => payload[k] !== null && payload[k] !== undefined)
    .sort();
  return JSON.stringify([type, keys.map((k) => [k, payload[k]])]);
}

let legalChecks = 0;

/**
 * Cross-check with the server's legalActions: an action is accepted (200) exactly when it is listed. Every action this
 * script sends goes through here, both the intended ones (must be listed) and the deliberately illegal ones (must not).
 */
async function legalityBefore(
  seat: Seat,
  type: string,
  payload: Record<string, unknown>,
): Promise<boolean> {
  const r = await call('GET', `/duels/${duelId}?viewer=${seat}`, { token });
  const list = (r.json as { legalActions?: { type: string; payload: Record<string, unknown> }[] })
    .legalActions;
  if (!Array.isArray(list)) throw new Error(`GET view ${seat} has no legalActions: ${r.text}`);
  const want = canon(type, payload);
  return list.some((a) => canon(a.type, a.payload) === want);
}

async function act(seat: Seat, type: string, extra: Record<string, unknown> = {}): Promise<Act> {
  const payload = { playerIndex: seat, ...extra };
  const body = { playerIndex: seat, action: { type, payload } };
  const listed = await legalityBefore(seat, type, payload);
  const r = await call('POST', `/duels/${duelId}/actions`, { token, body });
  legalChecks++;
  if (listed !== (r.status === 200)) {
    check(
      `legalActions agrees with the server for P${seat} ${type}`,
      false,
      `listed=${listed} but status=${r.status} ${JSON.stringify(extra)}`,
    );
  }
  const tag = `P${seat} ${type}${Object.keys(extra).length ? ` ${JSON.stringify(extra)}` : ''}`;
  if (r.status !== 200) {
    const e = r.json as { code?: string; engineCode?: string };
    say(`   ${tag} → ${r.status} ${e.code ?? ''} ${e.engineCode ?? ''}`);
    const out: Act = { status: r.status, events: [] };
    if (e.code) out.code = e.code;
    if (e.engineCode) out.engineCode = e.engineCode;
    return out;
  }
  const b = r.json as { view: ViewV; events: EventV[] };
  const leaks = findLeaks(b, hiddenFromOpponent(seat, b.events));
  if (leaks.length) {
    leakProblems += leaks.length;
    check(`no hidden-card leak in response to ${tag}`, false, leaks.join('; '));
  }
  views[seat] = b.view;
  const brief = b.events.map((e) => e.type).join(',');
  say(`   ${tag} → 200 [${b.view.phase}] ${brief}`);
  return { status: 200, view: b.view, events: b.events };
}

/** Resolves a hand-limit prompt if the last response left one open for `seat`. */
async function resolvePrompt(seat: Seat, a: Act): Promise<Act> {
  const p = a.view?.pendingPrompt;
  if (!a.view || !p || p.playerIndex !== seat || p.kind !== 'DiscardToHandLimit') return a;
  const count = p.payload.count ?? 0;
  const before = a.view.players[seat].handCount;
  const ids = a.view.players[seat].hand.slice(0, count).map((c) => c.instanceId);
  say(`   (hand ${before} > limit: discarding ${count})`);
  const wrong = await act(seat, 'ResolvePendingPrompt', {
    promptId: p.promptId,
    cardInstanceIds: ids.slice(0, Math.max(0, count - 1)),
  });
  check(
    'discarding the wrong number of cards is rejected (INVALID_DISCARD)',
    wrong.engineCode === 'INVALID_DISCARD',
    `${wrong.status} ${wrong.engineCode}`,
  );
  const done = await act(seat, 'ResolvePendingPrompt', {
    promptId: p.promptId,
    cardInstanceIds: ids,
  });
  check(
    'discard prompt resolves and hand ends at the limit (6)',
    done.status === 200 &&
      (done.view?.players[seat].handCount ?? 99) === before - count &&
      before - count <= 6,
    `hand ${before} → ${done.view?.players[seat].handCount}`,
  );
  return done;
}

async function advanceTo(seat: Seat, target: string): Promise<void> {
  for (let i = 0; i < 8 && view(seat).phase !== target; i++) {
    const before = view(seat);
    const idx = PHASES.indexOf(before.phase);
    const a = await act(seat, 'EndPhase');
    if (a.status !== 200 || !a.view)
      throw new Error(`EndPhase failed while advancing to ${target}: ${a.engineCode}`);
    if (a.view.pendingPrompt) {
      await resolvePrompt(seat, a);
      continue;
    }
    if (a.view.turnPlayerIndex === seat) {
      check(
        `phase order ${before.phase} → ${a.view.phase}`,
        PHASES.indexOf(a.view.phase) === idx + 1,
        `${PHASES[idx + 1]} expected`,
      );
    }
    if (before.phase === 'Draw') {
      const drew = before.turnCount === 1 ? 0 : 1;
      const p = a.view.players[seat];
      check(
        `turn ${before.turnCount}: leaving Draw phase ${drew ? 'draws 1 card' : 'draws nothing (first turn)'}`,
        before.players[seat].deckCount - p.deckCount === drew &&
          p.handCount - before.players[seat].handCount === drew,
        `deck ${before.players[seat].deckCount}→${p.deckCount}, hand ${before.players[seat].handCount}→${p.handCount}`,
      );
      const own = a.events.filter((e) => e.type === 'CardDrawn');
      check(
        'draw event shows the drawer their own card in full',
        own.every((e) => (e.card as CardV).hidden === false),
      );
    }
  }
}

function firstEmptyZone(v: ViewV, seat: Seat): number {
  return v.players[seat].board.monsterZones.findIndex((c) => c === null);
}

let doneOnce: Record<string, boolean> = {};
const summonedThisTurn = new Set<string>();

async function p0Main(turn: number): Promise<void> {
  let v = view(0);
  // Bring back any monster we put in defense on an earlier turn.
  for (const m of own(v, 0)) {
    if (m.position === 'DefenseUp' && !summonedThisTurn.has(m.instanceId)) {
      const a = await act(0, 'ChangePosition', {
        cardInstanceId: m.instanceId,
        toPosition: 'Attack',
      });
      check(
        'ChangePosition DefenseUp → Attack on a later turn is allowed',
        a.status === 200,
        `${a.status} ${a.engineCode ?? ''}`,
      );
    }
  }
  v = view(0);
  const hand = v.players[0].hand.filter((c) => cardDef(c)?.kind === 'Monster');
  const low = hand
    .filter((c) => (cardDef(c)?.level ?? 99) <= 4)
    .sort((a, b) => (cardDef(b)?.atk ?? 0) - (cardDef(a)?.atk ?? 0));
  const mid = hand.find((c) => [5, 6].includes(cardDef(c)?.level ?? 0));
  const zone = firstEmptyZone(v, 0);

  if (mid && !doneOnce.noTribute) {
    doneOnce.noTribute = true;
    const a = await act(0, 'NormalSummon', {
      cardInstanceId: mid.instanceId,
      zoneIndex: Math.max(0, zone),
    });
    check(
      'Level 5+ without tribute is rejected (TRIBUTE_COUNT_MISMATCH)',
      a.engineCode === 'TRIBUTE_COUNT_MISMATCH',
      `${a.status} ${a.engineCode}`,
    );
  }
  const mons = own(v, 0);
  let summoned = false;
  if (mid && mons.length >= 1 && !doneOnce.tribute) {
    doneOnce.tribute = true;
    const weakest = [...mons].sort((a, b) => (cardDef(a)?.atk ?? 0) - (cardDef(b)?.atk ?? 0))[0]!;
    const tooMany = await act(0, 'NormalSummon', {
      cardInstanceId: mid.instanceId,
      zoneIndex: v.players[0].board.monsterZones.indexOf(weakest),
      tributeInstanceIds: mons
        .slice(0, 2)
        .map((c) => c.instanceId)
        .concat(mons.length < 2 ? ['nope'] : []),
    });
    check(
      'Level 5-6 with the wrong number of tributes is rejected',
      tooMany.status === 409,
      `${tooMany.status} ${tooMany.engineCode}`,
    );
    const a = await act(0, 'NormalSummon', {
      cardInstanceId: mid.instanceId,
      zoneIndex: v.players[0].board.monsterZones.indexOf(weakest),
      tributeInstanceIds: [weakest.instanceId],
    });
    check(
      'Tribute Summon of a Level 5-6 with 1 tribute succeeds',
      a.status === 200 &&
        a.events.some((e) => e.type === 'MonsterTributed') &&
        a.events.some((e) => e.type === 'NormalSummoned'),
      `${a.status} ${a.engineCode ?? ''}`,
    );
    if (a.status === 200) {
      summoned = true;
      summonedThisTurn.add(mid.instanceId);
      check(
        'tributed monster went to the graveyard',
        (a.view?.players[0].graveyard ?? []).some((c) => c.instanceId === weakest.instanceId),
      );
    }
  }
  if (!summoned && low.length > 0 && firstEmptyZone(view(0), 0) >= 0) {
    const pick = low[0]!;
    const a = await act(0, 'NormalSummon', {
      cardInstanceId: pick.instanceId,
      zoneIndex: firstEmptyZone(view(0), 0),
    });
    check(
      `turn ${turn}: Normal Summon ${cardDef(pick)?.name.en} succeeds`,
      a.status === 200 && a.events.some((e) => e.type === 'NormalSummoned'),
      `${a.status} ${a.engineCode ?? ''}`,
    );
    if (a.status === 200) {
      summoned = true;
      summonedThisTurn.add(pick.instanceId);
    }
  }
  if (summoned && !doneOnce.second) {
    const another = view(0).players[0].hand.find(
      (c) => (cardDef(c)?.level ?? 99) <= 4 && cardDef(c)?.kind === 'Monster',
    );
    if (another && firstEmptyZone(view(0), 0) >= 0) {
      doneOnce.second = true;
      const a = await act(0, 'NormalSummon', {
        cardInstanceId: another.instanceId,
        zoneIndex: firstEmptyZone(view(0), 0),
      });
      check(
        'a second Normal Summon in the same turn is rejected (NORMAL_SUMMON_USED)',
        a.engineCode === 'NORMAL_SUMMON_USED',
        `${a.status} ${a.engineCode}`,
      );
    }
  }
  if (turn >= 3 && !doneOnce.change) {
    const target = own(view(0), 0).find(
      (m) => m.position === 'Attack' && !summonedThisTurn.has(m.instanceId),
    );
    if (target) {
      doneOnce.change = true;
      const a = await act(0, 'ChangePosition', {
        cardInstanceId: target.instanceId,
        toPosition: 'DefenseUp',
      });
      check(
        'ChangePosition Attack → DefenseUp succeeds',
        a.status === 200 && a.events.some((e) => e.type === 'PositionChanged'),
        `${a.status} ${a.engineCode ?? ''}`,
      );
      const back = await act(0, 'ChangePosition', {
        cardInstanceId: target.instanceId,
        toPosition: 'Attack',
      });
      check(
        'changing the same monster back in the same turn is rejected',
        back.status === 409,
        `${back.status} ${back.engineCode}`,
      );
    }
  }
}

interface Expected {
  destroyed: Set<string>;
  damage: [number, number];
}

function expectBattle(
  attacker: CardV,
  target: CardV | null,
  targetPos: string,
  targetDef: CardDef | undefined,
  seat: Seat,
): Expected | null {
  const a = cardDef(attacker);
  const exp: Expected = { destroyed: new Set(), damage: [0, 0] };
  if (!a || a.atk === undefined) return null;
  const opp = (1 - seat) as Seat;
  if (target === null) {
    exp.damage[opp] = a.atk;
    return exp;
  }
  if (!targetDef || targetDef.atk === undefined || targetDef.def === undefined) return null;
  if (targetPos === 'Attack') {
    if (a.atk > targetDef.atk) {
      exp.destroyed.add(target.instanceId);
      exp.damage[opp] = a.atk - targetDef.atk;
    } else if (a.atk < targetDef.atk) {
      exp.destroyed.add(attacker.instanceId);
      exp.damage[seat] = targetDef.atk - a.atk;
    } else {
      exp.destroyed.add(target.instanceId).add(attacker.instanceId);
    }
  } else if (a.atk > targetDef.def) {
    exp.destroyed.add(target.instanceId);
  } else if (a.atk < targetDef.def) {
    exp.damage[seat] = targetDef.def - a.atk;
  }
  return exp;
}

async function p0Battle(turn: number): Promise<void> {
  if (turn === 1) {
    const m = own(view(0), 0)[0];
    await advanceTo(0, 'Battle');
    if (m) {
      const a = await act(0, 'DeclareAttack', {
        attackerInstanceId: m.instanceId,
        targetInstanceId: null,
      });
      check('turn 1: attacking is rejected', a.status === 409, `${a.status} ${a.engineCode}`);
    }
    return;
  }
  await advanceTo(0, 'Battle');
  for (const m of own(view(0), 0)) {
    if (view(0).winnerIndex !== null) return;
    const v = view(0);
    if (m.position !== 'Attack' || summonedThisTurn.has(m.instanceId)) continue;
    const targets = own(v, 1);
    const target = targets[0] ?? null;
    const targetPos =
      target === null ? '' : target.hidden ? 'DefenseDown' : (target.position ?? '');
    const lpBefore: [number, number] = [v.players[0].lifePoints, v.players[1].lifePoints];
    const a = await act(0, 'DeclareAttack', {
      attackerInstanceId: m.instanceId,
      targetInstanceId: target ? target.instanceId : null,
    });
    if (a.status !== 200 || !a.view) {
      check(`attack by ${cardDef(m)?.name.en} accepted`, false, `${a.status} ${a.engineCode}`);
      continue;
    }
    const flipped = a.events.find((e) => e.type === 'MonsterFlipped');
    const tDef =
      target === null
        ? undefined
        : (cardDef(target) ?? (flipped ? defs.get(String(flipped.definitionId)) : undefined));
    if (target?.hidden) {
      check(
        'attacking a face-down monster flips it first',
        flipped !== undefined &&
          a.events.findIndex((e) => e.type === 'MonsterFlipped') <
            (a.events.findIndex((e) => e.type === 'DamageDealt') === -1
              ? 99
              : a.events.findIndex((e) => e.type === 'DamageDealt')),
      );
    }
    const exp = expectBattle(m, target, targetPos, tDef, 0);
    const destroyed = new Set(
      a.events.filter((e) => e.type === 'MonsterDestroyed').map((e) => String(e.instanceId)),
    );
    const dmg: [number, number] = [0, 0];
    for (const e of a.events.filter((x) => x.type === 'DamageDealt'))
      dmg[e.playerIndex as Seat] += Number(e.amount);
    const lpAfter: [number, number] = [a.view.players[0].lifePoints, a.view.players[1].lifePoints];
    const label = `attack ${cardDef(m)?.name.en}(${cardDef(m)?.atk}) → ${target ? `${tDef?.name.en ?? '?'} (${targetPos})` : 'direct'}`;
    check(
      `${label}: LP change equals DamageDealt events`,
      lpAfter[0] === Math.max(0, lpBefore[0] - dmg[0]) &&
        lpAfter[1] === Math.max(0, lpBefore[1] - dmg[1]),
      `LP ${lpBefore} → ${lpAfter}, events ${dmg}`,
    );
    if (exp) {
      check(
        `${label}: matches RULES-REVIEW-SHEET (destroyed + damage)`,
        [...exp.destroyed].sort().join() === [...destroyed].sort().join() &&
          exp.damage[0] === dmg[0] &&
          exp.damage[1] === dmg[1],
        `expected destroyed=[${[...exp.destroyed]}] dmg=${exp.damage}; got destroyed=[${[...destroyed]}] dmg=${dmg}`,
      );
    }
    await refresh(1);
    if (a.view.winnerIndex !== null) return;
  }
}

async function p1Turn(turn: number): Promise<void> {
  await advanceTo(1, 'Main1');
  if (!doneOnce.set) {
    const v = view(1);
    const low = v.players[1].hand
      .filter((c) => cardDef(c)?.kind === 'Monster' && (cardDef(c)?.level ?? 99) <= 4)
      .sort((a, b) => (cardDef(b)?.def ?? 0) - (cardDef(a)?.def ?? 0));
    if (low[0]) {
      doneOnce.set = true;
      const a = await act(1, 'SetMonster', { cardInstanceId: low[0].instanceId, zoneIndex: 0 });
      check(
        `turn ${turn}: Set a monster face-down`,
        a.status === 200 && a.events.some((e) => e.type === 'MonsterSet'),
        `${a.status} ${a.engineCode ?? ''}`,
      );
      check(
        'MonsterSet event does not reveal the card',
        a.events.filter((e) => e.type === 'MonsterSet').every((e) => !('definitionId' in e)),
      );
      const p0 = await refresh(0);
      check(
        'P0 sees P1 set monster as hidden',
        (p0.players[1].board.monsterZones[0] as CardV | null)?.hidden === true,
      );
    }
  }
}

async function endTurn(seat: Seat): Promise<void> {
  for (let i = 0; i < 8; i++) {
    const v = view(seat);
    if (v.winnerIndex !== null || v.turnPlayerIndex !== seat) return;
    const a = await act(seat, 'EndPhase');
    if (a.status !== 200) throw new Error(`EndPhase failed: ${a.engineCode}`);
    await resolvePrompt(seat, a);
  }
}

async function playTurn(seat: Seat): Promise<void> {
  await refresh(0);
  await refresh(1);
  const v = view(seat);
  const turn = v.turnCount;
  say(
    `\n== Turn ${turn} — P${seat}  (LP ${v.players[0].lifePoints} / ${v.players[1].lifePoints}, hand ${v.players[seat].handCount}, deck ${v.players[seat].deckCount})`,
  );
  check(
    `turn ${turn} starts in Draw phase with the right player`,
    v.phase === 'Draw' && v.turnPlayerIndex === seat,
    `${v.phase}, P${v.turnPlayerIndex}`,
  );
  summonedThisTurn.clear();
  if (turn === 1) {
    const early = await act(1, 'EndPhase');
    check(
      'turn 1: the other seat cannot act (NOT_TURN_PLAYER)',
      early.engineCode === 'NOT_TURN_PLAYER',
      `${early.status} ${early.engineCode}`,
    );
  }
  if (seat === 0) {
    await advanceTo(0, 'Main1');
    await p0Main(turn);
    await p0Battle(turn);
    if (view(0).winnerIndex !== null) return;
  } else {
    await p1Turn(turn);
  }
  await endTurn(seat);
  await refresh(0);
  await refresh(1);
  const v0 = view(0);
  const v1 = view(1);
  const leaks = [...findLeaks(v0, hiddenFrom(v1, 1)), ...findLeaks(v1, hiddenFrom(v0, 0))];
  leakProblems += leaks.length;
  check(
    `turn ${turn} end: both views hide the other seat's hand and face-down monsters`,
    leaks.length === 0,
    leaks.join('; '),
  );
  check(
    `turn ${turn} end: turn passed to the other player`,
    v0.winnerIndex !== null || v0.turnPlayerIndex === 1 - seat,
    `turn player P${v0.turnPlayerIndex}`,
  );
}

/** HEAVY=1: a legal deck rich in Level 5+ monsters so the Tribute branches actually get exercised. */
function heavyDeck(): string[] {
  const monsters = [...defs.values()].filter((c) => c.kind === 'Monster');
  const high = monsters.filter((c) => (c.level ?? 0) >= 5);
  const low = monsters.filter((c) => (c.level ?? 0) < 5);
  return [...high, ...low].flatMap((c) => [c.id, c.id, c.id]).slice(0, 45);
}

async function newDuel(): Promise<void> {
  const body = process.env.HEAVY ? { deck: heavyDeck() } : {};
  const r = await call('POST', '/duels/solo', { token, body });
  if (r.status !== 201) throw new Error(`create duel failed ${r.status} ${r.text}`);
  const b = r.json as { duelId: string; view: ViewV };
  duelId = b.duelId;
  views[0] = b.view;
  await refresh(1);
  doneOnce = {};
}

async function main(): Promise<void> {
  const cards = (await call('GET', '/cards')).json as CardDef[];
  for (const c of cards) defs.set(c.id, c);
  const g = await call('POST', '/auth/guest');
  token = (g.json as { accessToken: string }).accessToken;

  say(`API ${BASE}\n\n### Duel 1: play until LP 0`);
  await newDuel();
  let ended: Act | null = null;
  for (let i = 0; i < 40 && view(0).winnerIndex === null; i++) {
    const v = await refresh(0);
    const seat = v.turnPlayerIndex;
    await playTurn(seat);
    const latest = await refresh(0);
    if (latest.winnerIndex !== null) break;
  }
  const fin = await refresh(0);
  await refresh(1);
  say('\n== Result of duel 1');
  check(
    'duel 1 ended with a winner',
    fin.winnerIndex !== null,
    `winner=${String(fin.winnerIndex)} turn=${fin.turnCount} LP=${fin.players[0].lifePoints}/${fin.players[1].lifePoints}`,
  );
  if (fin.winnerIndex === 0) check('winner is P0 and P1 LP is 0', fin.players[1].lifePoints === 0);
  ended = await act(0, 'EndPhase');
  check(
    'any action after the duel ended is rejected (DUEL_ENDED)',
    ended.engineCode === 'DUEL_ENDED',
    `${ended.status} ${ended.engineCode}`,
  );

  say('\n### Duel 2: Surrender');
  await newDuel();
  const s = await act(1, 'Surrender');
  check(
    'Surrender by P1 (even out of turn) → P0 wins with reason SURRENDER',
    s.status === 200 &&
      s.view?.winnerIndex === 0 &&
      s.events.some((e) => e.type === 'DuelEnded' && e.reason === 'SURRENDER'),
    `${s.status}`,
  );
  const after = await act(0, 'EndPhase');
  check(
    'action after Surrender is rejected (DUEL_ENDED)',
    after.engineCode === 'DUEL_ENDED',
    `${after.status} ${after.engineCode}`,
  );

  // Disagreements were already recorded as FAILs inside act(); this line records that the cross-check really ran.
  check(
    'every action sent agreed with legalActions (listed ⇔ accepted)',
    legalChecks > 0 && !results.some((r) => !r.ok && r.name.startsWith('legalActions agrees')),
    `${legalChecks} actions cross-checked`,
  );

  const failed = results.filter((r) => !r.ok);
  say(
    `\n${results.length - failed.length}/${results.length} checks passed; hidden-info leaks: ${leakProblems}`,
  );
  if (failed.length) {
    say('FAILED CHECKS (possible bugs — read, do not assume):');
    for (const f of failed) say(` - ${f.name} — ${f.detail}`);
  }
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(2);
});
