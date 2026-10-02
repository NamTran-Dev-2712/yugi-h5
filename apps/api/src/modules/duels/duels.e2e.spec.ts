import type { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { createRng, nextInt } from '@yugi/game-engine';
import {
  FIELD_DEMO_DECK,
  MECH_DEMO_DECK,
  NEGATE_DEMO_DECK,
  PlayerActionSchema,
  SAMPLE_CARDS,
  STARTER_DECK,
  isNegateOperationKind,
  type PlayerAction,
  type StateView,
} from '@yugi/shared';
import { LoggerModule } from 'nestjs-pino';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AllExceptionsFilter } from '../../common/filters/all-exceptions.filter';
import { validateEnv } from '../../config/env.schema';
import { configureApp } from '../../configure-app';
import { AuthModule } from '../auth/auth.module';
import { DUEL_STORE, DuelService } from './duel.service';
import type { DuelStore } from './duel-store';
import { DuelsModule } from './duels.module';
import { findLeaks } from './testing/leak-check';

const SECRET = 'e2e-secret-e2e-secret-1234';
const ALLOWED_ORIGIN = 'http://localhost:5173';
const ENV = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://user:pass@localhost:5433/db',
  JWT_ACCESS_SECRET: SECRET,
  JWT_REFRESH_SECRET: 'r'.repeat(20),
};

let app: INestApplication;
let jwt: JwtService;
const http = () => request(app.getHttpServer());

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        ignoreEnvFile: true,
        validate: () => validateEnv(ENV),
      }),
      LoggerModule.forRoot({ pinoHttp: { level: 'silent' } }),
      AuthModule,
      DuelsModule,
    ],
    providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }],
  }).compile();
  const nest = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false });
  configureApp(nest, `${ALLOWED_ORIGIN}, http://localhost:4173`);
  await nest.init();
  app = nest;
  jwt = new JwtService({ secret: SECRET });
});

afterAll(async () => {
  await app.close();
});

interface Guest {
  guestId: string;
  auth: { Authorization: string };
}

async function newGuest(): Promise<Guest> {
  const res = await http().post('/auth/guest').expect(201);
  return { guestId: res.body.guestId, auth: { Authorization: `Bearer ${res.body.accessToken}` } };
}

interface Duel {
  guest: Guest;
  duelId: string;
}

async function newDuel(body: object = {}): Promise<Duel> {
  const guest = await newGuest();
  const res = await http().post('/duels/solo').set(guest.auth).send(body).expect(201);
  return { guest, duelId: res.body.duelId };
}

const act = (d: Duel, playerIndex: 0 | 1, type: string, extra: object = {}) =>
  http()
    .post(`/duels/${d.duelId}/actions`)
    .set(d.guest.auth)
    .send({ playerIndex, action: { type, payload: { playerIndex, ...extra } } });

const viewOf = async (d: Duel, viewer: 0 | 1): Promise<StateView> =>
  (await http().get(`/duels/${d.duelId}?viewer=${viewer}`).set(d.guest.auth).expect(200)).body.view;

const legalOf = async (d: Duel, viewer: 0 | 1): Promise<{ type: string }[]> =>
  (await http().get(`/duels/${d.duelId}?viewer=${viewer}`).set(d.guest.auth).expect(200)).body
    .legalActions;

describe('POST /auth/guest', () => {
  it('issues a JWT whose sub is a fresh guest id', async () => {
    const a = await http().post('/auth/guest').expect(201);
    const b = await http().post('/auth/guest').expect(201);
    expect(a.body.guestId).not.toBe(b.body.guestId);
    const payload = await jwt.verifyAsync<{ sub: string }>(a.body.accessToken);
    expect(payload.sub).toBe(a.body.guestId);
  });
});

describe('authentication', () => {
  it.each([
    ['no header', undefined],
    ['wrong scheme', 'Basic abc'],
    ['garbage token', 'Bearer not-a-jwt'],
    ['empty bearer', 'Bearer '],
  ])('rejects %s with 401 on every duel route', async (_name, header) => {
    const set = (t: request.Test) => (header === undefined ? t : t.set('Authorization', header));
    await set(http().post('/duels/solo').send({})).expect(401);
    await set(http().get('/duels/x')).expect(401);
    await set(http().post('/duels/x/actions').send({})).expect(401);
  });

  it('rejects a token signed with another secret', async () => {
    const forged = await new JwtService({ secret: 'someone-elses-secret-1234' }).signAsync({
      sub: 'g',
      kind: 'guest',
    });
    await http().post('/duels/solo').set('Authorization', `Bearer ${forged}`).send({}).expect(401);
  });

  it('rejects an expired token', async () => {
    const expired = await jwt.signAsync({ sub: 'g', kind: 'guest' }, { expiresIn: -10 });
    await http().post('/duels/solo').set('Authorization', `Bearer ${expired}`).send({}).expect(401);
  });

  it('rejects a validly signed token that is not a guest token', async () => {
    const other = await jwt.signAsync({ sub: 'g' });
    await http().post('/duels/solo').set('Authorization', `Bearer ${other}`).send({}).expect(401);
  });
});

describe('POST /duels/solo', () => {
  it('creates a duel with the starter deck and returns the opening view + events for viewer 0', async () => {
    const guest = await newGuest();
    const res = await http().post('/duels/solo').set(guest.auth).expect(201); // no body at all
    expect(res.body).toMatchObject({ mode: 'solo-debug', viewer: 0 });
    expect(typeof res.body.duelId).toBe('string');
    const view: StateView = res.body.view;
    expect(view.viewerIndex).toBe(0);
    expect(view.players[0].hand).toHaveLength(5);
    expect(view.players[0].hand.every((c) => !c.hidden)).toBe(true);
    expect(view.players[1].hand.every((c) => c.hidden)).toBe(true);
    const types = (res.body.events as { type: string }[]).map((e) => e.type);
    expect(types[0]).toBe('DuelStarted');
    const draws = (res.body.events as { type: string; card: { hidden: boolean } }[]).filter(
      (e) => e.type === 'CardDrawn',
    );
    expect(draws).toHaveLength(10); // both seats' opening draws are announced...
    expect(draws.filter((e) => e.card.hidden)).toHaveLength(5); // ...but the opponent's cards are hidden
  });

  it('returns the other seat when asked (viewer: 1)', async () => {
    const guest = await newGuest();
    const res = await http().post('/duels/solo').set(guest.auth).send({ viewer: 1 }).expect(201);
    expect(res.body.viewer).toBe(1);
    expect(res.body.view.viewerIndex).toBe(1);
    expect(res.body.view.players[0].hand.every((c: { hidden: boolean }) => c.hidden)).toBe(true);
  });

  it('never leaks the raw state (rng, deck contents)', async () => {
    const guest = await newGuest();
    const res = await http().post('/duels/solo').set(guest.auth).send({}).expect(201);
    const text = JSON.stringify(res.body);
    expect(text).not.toContain('"rng"');
    expect(text).not.toContain('actionLog');
    expect(res.body.view.players[0].deckCount).toBe(STARTER_DECK.length - 5);
  });

  it('does not reveal the opponent opening hand in the creation response', async () => {
    // Two different decks; ids only in deck B must not appear for viewer 0 (nothing is public at the start).
    const guest = await newGuest();
    const a = SAMPLE_CARDS.slice(0, 14).flatMap((c) => [c.id, c.id, c.id]);
    const b = SAMPLE_CARDS.slice(4, 18).flatMap((c) => [c.id, c.id, c.id]);
    const onlyB = SAMPLE_CARDS.slice(14, 18).map((c) => c.id);
    const onlyA = SAMPLE_CARDS.slice(0, 4).map((c) => c.id);
    const v0 = await http()
      .post('/duels/solo')
      .set(guest.auth)
      .send({ decks: [a, b], viewer: 0 })
      .expect(201);
    const v1 = await http()
      .post('/duels/solo')
      .set(guest.auth)
      .send({ decks: [a, b], viewer: 1 })
      .expect(201);
    for (const id of onlyB) expect(JSON.stringify(v0.body)).not.toContain(id);
    for (const id of onlyA) expect(JSON.stringify(v1.body)).not.toContain(id);
  });

  it.each([
    ['deck too short', { deck: ['SMP-001'] }, 'TOO_FEW'],
    ['unknown card', { deck: [...STARTER_DECK.slice(0, 40), 'NOPE-1'] }, 'UNKNOWN_CARD'],
    ['4 copies', { deck: [...STARTER_DECK, 'SMP-001'] }, 'TOO_MANY_COPIES'],
  ])('rejects an invalid deck (%s) with 400 INVALID_DECK', async (_n, body, code) => {
    const guest = await newGuest();
    const res = await http().post('/duels/solo').set(guest.auth).send(body).expect(400);
    expect(res.body.code).toBe('INVALID_DECK');
    expect(res.body.errors.map((e: { code: string }) => e.code)).toContain(code);
  });

  it('reports which seat has the bad deck', async () => {
    const guest = await newGuest();
    const res = await http()
      .post('/duels/solo')
      .set(guest.auth)
      .send({ decks: [[...STARTER_DECK], ['SMP-001']] })
      .expect(400);
    expect(res.body.errors.every((e: { seat: number }) => e.seat === 1)).toBe(true);
  });

  it.each([
    ['unknown key', { hax: 1 }],
    ['deck is not an array', { deck: 'SMP-001' }],
    ['deck holds non-strings', { deck: [1, 2, 3] }],
    ['viewer out of range', { viewer: 2 }],
    [
      'deck and decks together',
      { deck: [...STARTER_DECK], decks: [[...STARTER_DECK], [...STARTER_DECK]] },
    ],
    ['decks of wrong arity', { decks: [[...STARTER_DECK]] }],
    ['deck far too large', { deck: Array(201).fill('SMP-001') }],
  ])('rejects a malformed body (%s) with 400', async (_n, body) => {
    const guest = await newGuest();
    const res = await http().post('/duels/solo').set(guest.auth).send(body).expect(400);
    expect(res.body.statusCode).toBe(400);
  });

  it('rejects malformed JSON with 400 (not 500)', async () => {
    const guest = await newGuest();
    await http()
      .post('/duels/solo')
      .set(guest.auth)
      .set('Content-Type', 'application/json')
      .send('{"deck": [')
      .expect(400);
  });

  it('rejects a body over the size limit with 413', async () => {
    const guest = await newGuest();
    const huge = JSON.stringify({ deck: [], pad: 'x'.repeat(150 * 1024) });
    await http()
      .post('/duels/solo')
      .set(guest.auth)
      .set('Content-Type', 'application/json')
      .send(huge)
      .expect(413);
  });
});

describe('POST /duels/solo legalActions', () => {
  it('returns the legalActions of the requested viewer seat', async () => {
    const guest = await newGuest();
    const types = async (viewer: 0 | 1) => {
      const res = await http().post('/duels/solo').set(guest.auth).send({ viewer }).expect(201);
      expect(res.body.view.viewerIndex).toBe(viewer);
      return (res.body.legalActions as { type: string }[]).map((a) => a.type);
    };
    const first = await types(0);
    expect(first).toEqual(['EndPhase', 'Surrender']);
    expect(await types(1)).toEqual(['Surrender']);
  });
});

describe('GET /duels/:id', () => {
  it('returns each seat view to the owner', async () => {
    const d = await newDuel();
    expect((await viewOf(d, 0)).viewerIndex).toBe(0);
    expect((await viewOf(d, 1)).viewerIndex).toBe(1);
  });

  it('defaults to viewer 0', async () => {
    const d = await newDuel();
    const res = await http().get(`/duels/${d.duelId}`).set(d.guest.auth).expect(200);
    expect(res.body.view.viewerIndex).toBe(0);
  });

  it('returns the viewer seat legalActions, all of which parse as player actions', async () => {
    const d = await newDuel();
    const turn = (await viewOf(d, 0)).turnPlayerIndex;
    const idle = (1 - turn) as 0 | 1;
    const mine = await legalOf(d, turn);
    expect(mine.map((a) => a.type)).toEqual(['EndPhase', 'Surrender']);
    for (const a of mine) expect(PlayerActionSchema.safeParse(a).success).toBe(true);
    // The seat that is not on turn can only concede.
    expect((await legalOf(d, idle)).map((a) => a.type)).toEqual(['Surrender']);
  });

  it('answers 403 NOT_OWNER to another guest, for both seats', async () => {
    const d = await newDuel();
    const intruder = await newGuest();
    for (const viewer of [0, 1]) {
      const res = await http()
        .get(`/duels/${d.duelId}?viewer=${viewer}`)
        .set(intruder.auth)
        .expect(403);
      expect(res.body.code).toBe('NOT_OWNER');
      expect(JSON.stringify(res.body)).not.toContain('hand');
    }
  });

  it('answers 404 for an unknown duel and 400 for a bad viewer', async () => {
    const guest = await newGuest();
    const res = await http().get('/duels/does-not-exist').set(guest.auth).expect(404);
    expect(res.body.code).toBe('DUEL_NOT_FOUND');
    const d = await newDuel();
    await http().get(`/duels/${d.duelId}?viewer=2`).set(d.guest.auth).expect(400);
    await http().get(`/duels/${d.duelId}?viewer=abc`).set(d.guest.auth).expect(400);
  });
});

describe('POST /duels/:id/actions', () => {
  it('applies a legal action and returns the sender view + filtered events', async () => {
    const d = await newDuel();
    const res = await act(d, 0, 'EndPhase').expect(200);
    expect(res.body.view.viewerIndex).toBe(0);
    expect(res.body.view.phase).toBe('Standby');
    expect(res.body.events[0]).toMatchObject({ type: 'PhaseChanged' });
    expect(res.body.eventsByViewer).toBeUndefined();
    // legalActions belong to the sender seat, computed on the state AFTER the action (Standby → EndPhase again).
    expect(res.body.legalActions.map((a: { type: string }) => a.type)).toEqual([
      'EndPhase',
      'Surrender',
    ]);
  });

  it('answers 409 DUEL_ENDED for any action after a Surrender', async () => {
    const d = await newDuel();
    await act(d, 0, 'Surrender').expect(200);
    const res = await act(d, 1, 'EndPhase').expect(409);
    expect(res.body.engineCode).toBe('DUEL_ENDED');
  });

  it('shows the sender their own draw in full (events are the sender view, not the opponent one)', async () => {
    const d = await newDuel();
    let r = await act(d, 0, 'EndPhase').expect(200);
    while (r.body.view.turnPlayerIndex === 0) r = await act(d, 0, 'EndPhase').expect(200);
    expect(r.body.view.phase).toBe('Draw');
    r = await act(d, 1, 'EndPhase').expect(200); // leaving Draw phase draws for seat 1
    const draw = r.body.events.find((e: { type: string }) => e.type === 'CardDrawn');
    expect(draw.playerIndex).toBe(1);
    expect(draw.card.hidden).toBe(false);
    expect(typeof draw.card.definitionId).toBe('string');
  });

  it('answers 403 NOT_OWNER to another guest and changes nothing', async () => {
    const d = await newDuel();
    const intruder = await newGuest();
    const before = await viewOf(d, 0);
    const res = await http()
      .post(`/duels/${d.duelId}/actions`)
      .set(intruder.auth)
      .send({ playerIndex: 0, action: { type: 'Surrender', payload: { playerIndex: 0 } } })
      .expect(403);
    expect(res.body.code).toBe('NOT_OWNER');
    expect(await viewOf(d, 0)).toEqual(before);
  });

  it('answers 404 for an unknown duel', async () => {
    const guest = await newGuest();
    await http()
      .post('/duels/nope/actions')
      .set(guest.auth)
      .send({ playerIndex: 0, action: { type: 'EndPhase', payload: { playerIndex: 0 } } })
      .expect(404);
  });

  it('answers 409 with engineCode for an illegal action and leaves the state untouched', async () => {
    const d = await newDuel();
    const before = await viewOf(d, 0);
    const res = await act(d, 1, 'EndPhase').expect(409); // turn 1 belongs to seat 0
    expect(res.body).toMatchObject({
      statusCode: 409,
      code: 'ACTION_REJECTED',
      engineCode: 'NOT_TURN_PLAYER',
    });
    expect(res.body.stack).toBeUndefined();
    const after = await viewOf(d, 0);
    expect(after.version).toBe(before.version);
    expect(after).toEqual(before);
  });

  it('answers 403 FORBIDDEN_ACTION for Draw and StartDuel', async () => {
    const d = await newDuel();
    const draw = await act(d, 0, 'Draw', { count: 1 }).expect(403);
    expect(draw.body.code).toBe('FORBIDDEN_ACTION');
    const start = await act(d, 0, 'StartDuel').expect(403);
    expect(start.body.code).toBe('FORBIDDEN_ACTION');
  });

  it('answers 403 PLAYER_MISMATCH when the envelope seat and the payload seat differ', async () => {
    const d = await newDuel();
    const res = await http()
      .post(`/duels/${d.duelId}/actions`)
      .set(d.guest.auth)
      .send({ playerIndex: 0, action: { type: 'EndPhase', payload: { playerIndex: 1 } } })
      .expect(403);
    expect(res.body.code).toBe('PLAYER_MISMATCH');
  });

  it.each([
    ['missing action', { playerIndex: 0 }],
    [
      'unknown action type',
      { playerIndex: 0, action: { type: 'Nuke', payload: { playerIndex: 0 } } },
    ],
    [
      'playerIndex out of range',
      { playerIndex: 2, action: { type: 'EndPhase', payload: { playerIndex: 2 } } },
    ],
    ['missing payload', { playerIndex: 0, action: { type: 'EndPhase' } }],
    [
      'extra top-level key',
      { playerIndex: 0, action: { type: 'EndPhase', payload: { playerIndex: 0 } }, x: 1 },
    ],
    ['non-object body', [1, 2, 3]],
  ])('rejects a malformed body (%s) with 400', async (_n, body) => {
    const d = await newDuel();
    await http().post(`/duels/${d.duelId}/actions`).set(d.guest.auth).send(body).expect(400);
  });

  it.each([
    ['summon without cardInstanceId', 'NormalSummon', { zoneIndex: 0 }],
    ['summon zone out of range', 'NormalSummon', { cardInstanceId: 'p0-1', zoneIndex: 9 }],
    [
      'set with tributes that are not strings',
      'SetMonster',
      { cardInstanceId: 'p0-1', zoneIndex: 0, tributeInstanceIds: [1] },
    ],
    [
      'position DefenseDown',
      'ChangePosition',
      { cardInstanceId: 'p0-1', toPosition: 'DefenseDown' },
    ],
    ['attack without attacker', 'DeclareAttack', {}],
    [
      'prompt answer not an array',
      'ResolvePendingPrompt',
      { promptId: 'x', cardInstanceIds: 'p0-1' },
    ],
    ['unknown payload key', 'EndPhase', { hax: true }],
    [
      'decline that is not a boolean',
      'ResolvePendingPrompt',
      { promptId: 'x', cardInstanceIds: [], decline: 'yes' },
    ],
    ['PassPriority with an extra key', 'PassPriority', { hax: 1 }],
  ])(
    'rejects a malformed payload (%s) with 400, not 500, and changes nothing',
    async (_n, type, extra) => {
      const d = await newDuel();
      const before = await viewOf(d, 0);
      const res = await act(d, 0, type, extra).expect(400);
      expect(res.body.statusCode).toBe(400);
      expect(await viewOf(d, 0)).toEqual(before);
    },
  );
});

describe('chain on the wire over HTTP (task 3.4b)', () => {
  it('every view carries the public chain fields (empty outside a chain)', async () => {
    const d = await newDuel();
    const view = await viewOf(d, 1);
    expect(view.chain).toEqual([]);
    expect(view.chainWindow).toBeNull();
  });

  it('PassPriority passes the schema: with no window the engine refuses it (409), not the server (403/400)', async () => {
    const d = await newDuel();
    const before = await viewOf(d, 0);
    const res = await act(d, 0, 'PassPriority').expect(409);
    expect(res.body.engineCode).toBe('NO_CHAIN_WINDOW');
    expect(await viewOf(d, 0)).toEqual(before);
  });

  it('a well-formed decline passes the schema and reaches the engine (409 NO_PENDING_PROMPT)', async () => {
    const d = await newDuel();
    const res = await act(d, 0, 'ResolvePendingPrompt', {
      promptId: 'x',
      cardInstanceIds: [],
      decline: true,
    }).expect(409);
    expect(res.body.engineCode).toBe('NO_PENDING_PROMPT');
  });
});

describe('a short duel over HTTP never leaks hidden information', () => {
  /** Every object that names one of these instance ids must not carry a definitionId. */
  function findLeaks(node: unknown, hidden: ReadonlySet<string>, path = '$'): string[] {
    if (Array.isArray(node)) return node.flatMap((n, i) => findLeaks(n, hidden, `${path}[${i}]`));
    if (typeof node !== 'object' || node === null) return [];
    const obj = node as Record<string, unknown>;
    const leaks =
      typeof obj.instanceId === 'string' && hidden.has(obj.instanceId) && 'definitionId' in obj
        ? [`${path} exposes definitionId of hidden ${obj.instanceId}`]
        : [];
    return [
      ...leaks,
      ...Object.entries(obj).flatMap(([k, v]) => findLeaks(v, hidden, `${path}.${k}`)),
    ];
  }

  /** Cards a seat holds that its opponent must not identify: whole hand + face-down monsters. */
  function hiddenFrom(view: StateView, owner: 0 | 1): Set<string> {
    const p = view.players[owner];
    const ids = new Set<string>(p.hand.map((c) => c.instanceId));
    for (const c of [...p.board.monsterZones, ...p.board.spellTrapZones, p.board.fieldZone]) {
      if (c && !c.hidden && c.position === 'DefenseDown') ids.add(c.instanceId);
    }
    return ids;
  }

  const level = (definitionId: string): number => {
    const def = SAMPLE_CARDS.find((c) => c.id === definitionId);
    return def?.kind === 'Monster' ? def.level : 99;
  };

  it('plays Summon, Set, Flip-attack and Surrender with clean responses for both viewers', async () => {
    const d = await newDuel({ decks: [[...STARTER_DECK], [...STARTER_DECK]] });
    const problems: string[] = [];

    /** Check the response the sender got and both seat views against what is hidden right now. */
    const audit = async (
      label: string,
      senderBody?: { view: StateView; events: unknown[]; legalActions: unknown[] },
    ) => {
      const views: [StateView, StateView] = [await viewOf(d, 0), await viewOf(d, 1)];
      for (const viewer of [0, 1] as const) {
        const other = (1 - viewer) as 0 | 1;
        const hidden = hiddenFrom(views[other], other);
        // legalActions: never a definitionId, and never name the opponent's hand cards (their ids are secret too).
        const legal = JSON.stringify(await legalOf(d, viewer));
        if (legal.includes('definitionId'))
          problems.push(`${label} legalActions viewer ${viewer}: definitionId`);
        for (const c of views[other].players[other].hand) {
          // the opponent's hand instanceIds must not be addressable by this viewer
          if (legal.includes(`"${c.instanceId}"`)) {
            problems.push(
              `${label} legalActions viewer ${viewer} names opponent hand card ${c.instanceId}`,
            );
          }
        }
        problems.push(
          ...findLeaks(views[viewer], hidden).map((p) => `${label} GET viewer ${viewer}: ${p}`),
        );
        expect(views[viewer].players[other].hand.every((c) => c.hidden)).toBe(true);
        expect(JSON.stringify(views[viewer])).not.toContain('"rng"');
      }
      if (senderBody) {
        const sender = senderBody.view.viewerIndex;
        const hidden = hiddenFrom(views[(1 - sender) as 0 | 1], (1 - sender) as 0 | 1);
        problems.push(
          ...findLeaks(senderBody, hidden).map((p) => `${label} action response: ${p}`),
        );
        const legal = JSON.stringify(senderBody.legalActions);
        if (legal.includes('definitionId'))
          problems.push(`${label} action response legalActions: definitionId`);
        for (const id of views[(1 - sender) as 0 | 1].players[(1 - sender) as 0 | 1].hand.map(
          (c) => c.instanceId,
        )) {
          if (legal.includes(`"${id}"`))
            problems.push(`${label} action response legalActions names opponent hand ${id}`);
        }
      }
    };

    const send = async (seat: 0 | 1, type: string, extra: object = {}) => {
      const res = await act(d, seat, type, extra).expect(200);
      await audit(`${type}#${seat}`, res.body);
      return res.body as { view: StateView; events: { type: string }[] };
    };

    await audit('start');
    // Turn 1, seat 0: Draw -> Standby -> Main1, Normal Summon a low-level monster, pass the turn.
    await send(0, 'EndPhase');
    let r = await send(0, 'EndPhase');
    expect(r.view.phase).toBe('Main1');
    const summonable = (v: StateView, seat: 0 | 1) =>
      v.players[seat].hand.find((c) => !c.hidden && level(c.definitionId) <= 4);
    const c0 = summonable(r.view, 0);
    expect(c0).toBeDefined();
    r = await send(0, 'NormalSummon', { cardInstanceId: c0!.instanceId, zoneIndex: 0 });
    expect(r.events.map((e) => e.type)).toContain('NormalSummoned');
    while (r.view.turnPlayerIndex === 0) r = await send(0, 'EndPhase');

    // Turn 2, seat 1: Set a monster face down, pass the turn.
    while (r.view.phase !== 'Main1') r = await send(1, 'EndPhase');
    const c1 = summonable(r.view, 1);
    expect(c1).toBeDefined();
    r = await send(1, 'SetMonster', { cardInstanceId: c1!.instanceId, zoneIndex: 0 });
    expect(r.events.map((e) => e.type)).toContain('MonsterSet');
    expect((await viewOf(d, 0)).players[1].board.monsterZones[0]).toMatchObject({ hidden: true });
    while (r.view.turnPlayerIndex === 1) r = await send(1, 'EndPhase');

    // Turn 3, seat 0: attack the face-down monster (it flips, which is public by then).
    while (r.view.phase !== 'Battle') r = await send(0, 'EndPhase');
    r = await send(0, 'DeclareAttack', {
      attackerInstanceId: c0!.instanceId,
      targetInstanceId: c1!.instanceId,
    });
    expect(r.events.map((e) => e.type)).toEqual(
      expect.arrayContaining(['AttackDeclared', 'MonsterFlipped']),
    );

    // Seat 1 concedes: the duel is over and seat 0 wins.
    r = await send(1, 'Surrender');
    expect(r.view.winnerIndex).toBe(0);
    expect(r.events.map((e) => e.type)).toContain('DuelEnded');

    expect(problems).toEqual([]);
  });
});

describe('Spell/Trap over HTTP (task 3.2b gate): no hidden definitionId in any response', () => {
  let httpSpellTrapActions = 0;
  /** Legal decks with the sample Spell (SMP-101, Draw 1) and Trap (SMP-201: negates an attack since task 4.4). */
  const spellDeck = (): string[] => {
    const monsters = SAMPLE_CARDS.filter((c) => c.kind === 'Monster').map((c) => c.id);
    const deck = ['SMP-101', 'SMP-101', 'SMP-101', 'SMP-201', 'SMP-201', 'SMP-201'];
    for (let i = 0; deck.length < 40; i++) deck.push(monsters[i % monsters.length]!);
    return deck;
  };
  const rawState = async (duelId: string) => (await app.get(DuelService).getDuel(duelId)).state;

  /** Oracle on everything the HTTP layer sent to `viewer` (bodies of GET and of the sender's POST). */
  async function audit(
    d: Duel,
    problems: string[],
    label: string,
    posted?: object,
    sender?: 0 | 1,
  ) {
    const state = await rawState(d.duelId);
    for (const viewer of [0, 1] as const) {
      const got = (
        await http().get(`/duels/${d.duelId}?viewer=${viewer}`).set(d.guest.auth).expect(200)
      ).body;
      const body = viewer === sender && posted ? { got, posted } : { got };
      for (const v of findLeaks(state, viewer, body))
        problems.push(`${label} viewer ${viewer}: ${v.path} ${v.instanceId} ${v.reason}`);
    }
  }

  it('golden: Set SMP-201 then activate SMP-101 — the opponent never identifies the Set card', async () => {
    const d = await newDuel({ decks: [spellDeck(), spellDeck()] });
    // The deal is shuffled: make seat 0's first two opening cards SMP-201 and SMP-101 (same instance ids), the way
    // other specs patch the store. Everything after that goes over HTTP.
    const store = app.get<DuelStore>(DUEL_STORE);
    const session = (await store.get(d.duelId))!;
    const [p0, p1] = session.state.players;
    const [h0, h1, ...rest] = p0.hand;
    const trap = h0!.instanceId;
    const draw = h1!.instanceId;
    await store.save({
      ...session,
      state: {
        ...session.state,
        players: [
          {
            ...p0,
            hand: [
              { ...h0!, definitionId: 'SMP-201' },
              { ...h1!, definitionId: 'SMP-101' },
              ...rest,
            ],
          },
          p1,
        ],
      },
    });
    const problems: string[] = [];
    const send = async (seat: 0 | 1, type: string, extra: object = {}) => {
      const res = await act(d, seat, type, extra).expect(200);
      await audit(d, problems, type, res.body, seat);
      return res.body as { view: StateView; events: { type: string }[] };
    };
    let phase = (await send(0, 'EndPhase')).view.phase; // Draw -> Standby (no draw on turn 1)
    while (phase !== 'Main1') phase = (await send(0, 'EndPhase')).view.phase;

    const set = await send(0, 'SetSpellTrap', { cardInstanceId: trap, zoneIndex: 1 });
    expect(set.events.map((e) => e.type)).toEqual(['SpellTrapSet']);
    const opp = await viewOf(d, 1);
    expect(opp.players[0].board.spellTrapZones[1]).toEqual({
      hidden: true,
      instanceId: trap,
      ownerIndex: 0,
    });

    const used = await send(0, 'ActivateEffect', { cardInstanceId: draw, effectId: 'draw-one' });
    expect(used.events.map((e) => e.type)).toEqual([
      'EffectActivated',
      'ChainLinkAdded',
      'CardDrawn',
      'EffectResolved',
      'CardSentToGraveyard',
      'ChainResolved',
    ]);
    // The opponent sees the activated Spell (public) but still not the Set Trap.
    const after = await viewOf(d, 1);
    expect(after.players[0].graveyard.map((c) => c.definitionId)).toContain('SMP-101');
    // Seat 1 may hold its own SMP-201; what matters is seat 0's side of seat 1's view.
    expect(JSON.stringify(after.players[0])).not.toContain('SMP-201');
    expect(problems).toEqual([]);
  });

  it.each([1, 2, 3])(
    'fuzz over HTTP, run %i: random legal actions (Spell/Trap favoured) never leak to either viewer',
    async (run) => {
      const d = await newDuel({ decks: [spellDeck(), spellDeck()] });
      const problems: string[] = [];
      let rng = createRng(`http-fuzz-${run}`);
      await audit(d, problems, 'open');

      for (let step = 0; step < 100; step++) {
        const state = await rawState(d.duelId);
        if (state.winnerIndex !== null) break;
        // Task 4.4: SMP-201 is a real card now (it negates an attack), so an attack may open a reaction window for the
        // opponent — the actor is the priority holder then (same formula as DuelManager / the 4.2d fuzz below).
        const actor = (state.pendingPrompt?.playerIndex ??
          state.chainWindow?.priorityPlayer ??
          state.turnPlayerIndex) as 0 | 1;
        const legal = ((await legalOf(d, actor)) as PlayerAction[]).filter(
          (a) => a.type !== 'Surrender',
        );
        const spells = legal.filter(
          (a) => a.type === 'SetSpellTrap' || a.type === 'ActivateEffect',
        );
        const [roll, r1] = nextInt(rng, 100);
        const pool = spells.length > 0 && roll < 50 ? spells : legal;
        const [i, r2] = nextInt(r1, pool.length);
        rng = r2;
        const action = pool[i]!;
        if (action.type === 'SetSpellTrap' || action.type === 'ActivateEffect')
          httpSpellTrapActions++;
        const res = await http()
          .post(`/duels/${d.duelId}/actions`)
          .set(d.guest.auth)
          .send({ playerIndex: actor, action })
          .expect(200);
        await audit(d, problems, `${run}.${step} ${action.type}`, res.body, actor);
      }
      expect(problems).toEqual([]);
    },
    60_000,
  );

  it('the HTTP fuzz runs above really sent Spell/Trap actions', () => {
    expect(httpSpellTrapActions).toBeGreaterThan(0);
  });
});

describe('task 4.2 mechanics over HTTP (task 4.2d gate)', () => {
  const sent = new Map<string, number>();
  const seen = new Map<string, number>();
  const rawState = async (duelId: string) => (await app.get(DuelService).getDuel(duelId)).state;

  it.each([1, 2])(
    'fuzz over HTTP with MECH_DEMO_DECK, run %i: FlipSummon / Special Summon / Equip never leak to either viewer',
    async (run) => {
      const d = await newDuel({ deck: [...MECH_DEMO_DECK] });
      const problems: string[] = [];
      let rng = createRng(`http-mech-${run}`);
      for (let step = 0; step < 150; step++) {
        const state = await rawState(d.duelId);
        if (state.winnerIndex !== null) break;
        const actor = (state.pendingPrompt?.playerIndex ??
          state.chainWindow?.priorityPlayer ??
          state.turnPlayerIndex) as 0 | 1;
        const legal = ((await legalOf(d, actor)) as PlayerAction[]).filter(
          (a) => a.type !== 'Surrender',
        );
        const mech = legal.filter((a) => a.type === 'FlipSummon' || a.type === 'ActivateEffect');
        const [roll, r1] = nextInt(rng, 100);
        const pool = mech.length > 0 && roll < 60 ? mech : legal;
        const [i, r2] = nextInt(r1, pool.length);
        rng = r2;
        const action = pool[i]!;
        sent.set(action.type, (sent.get(action.type) ?? 0) + 1);
        const res = await http()
          .post(`/duels/${d.duelId}/actions`)
          .set(d.guest.auth)
          .send({ playerIndex: actor, action })
          .expect(200);
        for (const e of res.body.events as { type: string }[]) {
          seen.set(e.type, (seen.get(e.type) ?? 0) + 1);
        }
        const after = await rawState(d.duelId);
        for (const viewer of [0, 1] as const) {
          const got = (
            await http().get(`/duels/${d.duelId}?viewer=${viewer}`).set(d.guest.auth).expect(200)
          ).body;
          const body = viewer === actor ? { got, posted: res.body } : { got };
          for (const v of findLeaks(after, viewer, body)) {
            problems.push(`${run}.${step} ${action.type} viewer ${viewer}: ${v.path} ${v.reason}`);
          }
        }
      }
      expect(problems).toEqual([]);
    },
    90_000,
  );

  it('the runs above really Flip Summoned and used the mechanic Spells', () => {
    console.info('[http mech]', Object.fromEntries(sent), Object.fromEntries(seen));
    expect(sent.get('FlipSummon') ?? 0).toBeGreaterThan(0);
    expect(
      (seen.get('MonsterSpecialSummoned') ?? 0) + (seen.get('CardEquipped') ?? 0),
    ).toBeGreaterThan(0);
  });
});

describe('Field Zone and staying cards over HTTP (task 4.3b gate)', () => {
  const seen = new Map<string, number>();
  const observed = { faceUpField: 0, hiddenFieldForOpponent: 0, stayingCard: 0 };
  const rawState = async (duelId: string) => (await app.get(DuelService).getDuel(duelId)).state;
  const fieldIds = new Set(
    SAMPLE_CARDS.filter((c) => c.kind === 'Spell' && c.subType === 'Field').map((c) => c.id),
  );

  it.each([1, 2, 3])(
    'fuzz over HTTP with FIELD_DEMO_DECK, run %i: Set / activate a Field Spell, Continuous cards that stay — no leak to either viewer',
    async (run) => {
      const d = await newDuel({ deck: [...FIELD_DEMO_DECK] });
      const problems: string[] = [];
      let rng = createRng(`http-field-${run}`);
      for (let step = 0; step < 160; step++) {
        const state = await rawState(d.duelId);
        if (state.winnerIndex !== null) break;
        const actor = (state.pendingPrompt?.playerIndex ??
          state.chainWindow?.priorityPlayer ??
          state.turnPlayerIndex) as 0 | 1;
        const legal = ((await legalOf(d, actor)) as PlayerAction[]).filter(
          (a) => a.type !== 'Surrender',
        );
        // Favour Spell/Trap actions, and among them the ones on a Field Spell of the hand (Set or activate).
        const spells = legal.filter(
          (a) => a.type === 'SetSpellTrap' || a.type === 'ActivateEffect',
        );
        const onField = spells.filter((a) => {
          const id = (a.payload as { cardInstanceId: string }).cardInstanceId;
          const card = state.players[actor].hand.find((c) => c.instanceId === id);
          return card !== undefined && fieldIds.has(card.definitionId);
        });
        const [roll, r1] = nextInt(rng, 100);
        const pool =
          onField.length > 0 && roll < 40
            ? onField
            : spells.length > 0 && roll < 70
              ? spells
              : legal;
        const [i, r2] = nextInt(r1, pool.length);
        rng = r2;
        const action = pool[i]!;
        expect(PlayerActionSchema.safeParse(action).success).toBe(true);
        const res = await http()
          .post(`/duels/${d.duelId}/actions`)
          .set(d.guest.auth)
          .send({ playerIndex: actor, action })
          .expect(200);
        for (const e of res.body.events as { type: string; from?: string }[]) {
          seen.set(e.type, (seen.get(e.type) ?? 0) + 1);
          if (e.type === 'FieldSpellSet') expect(e).not.toHaveProperty('definitionId');
        }
        const after = await rawState(d.duelId);
        for (const viewer of [0, 1] as const) {
          const got = (
            await http().get(`/duels/${d.duelId}?viewer=${viewer}`).set(d.guest.auth).expect(200)
          ).body as { view: StateView };
          const body = viewer === actor ? { got, posted: res.body } : { got };
          for (const v of findLeaks(after, viewer, body)) {
            problems.push(`${run}.${step} ${action.type} viewer ${viewer}: ${v.path} ${v.reason}`);
          }
          const theirs = got.view.players[viewer === 0 ? 1 : 0].board;
          if (theirs.fieldZone?.hidden === true) observed.hiddenFieldForOpponent++;
          if (theirs.fieldZone?.hidden === false) observed.faceUpField++;
          if (theirs.spellTrapZones.some((c) => c !== null && !c.hidden)) observed.stayingCard++;
        }
      }
      expect(problems).toEqual([]);
    },
    90_000,
  );

  it('the runs above really Set and activated Field Spells and kept staying cards face-up', () => {
    console.info('[http field]', Object.fromEntries(seen), observed);
    expect(seen.get('FieldSpellSet') ?? 0).toBeGreaterThan(0);
    expect(observed.hiddenFieldForOpponent).toBeGreaterThan(0);
    expect(observed.faceUpField).toBeGreaterThan(0);
    expect(observed.stayingCard).toBeGreaterThan(0);
  });

  it('golden: Set a Field Spell (zoneIndex 0), activate it from the Field Zone, replace it with a second one', async () => {
    const d = await newDuel({ deck: [...FIELD_DEMO_DECK] });
    // The deal is shuffled: make seat 0's first two opening cards SMP-113 (same instance ids), as the 3.2b golden does.
    const store = app.get<DuelStore>(DUEL_STORE);
    const session = (await store.get(d.duelId))!;
    const [p0, p1] = session.state.players;
    const [h0, h1, ...rest] = p0.hand;
    const first = h0!.instanceId;
    const second = h1!.instanceId;
    await store.save({
      ...session,
      state: {
        ...session.state,
        players: [
          {
            ...p0,
            hand: [
              { ...h0!, definitionId: 'SMP-113' },
              { ...h1!, definitionId: 'SMP-113' },
              ...rest,
            ],
          },
          p1,
        ],
      },
    });
    const problems: string[] = [];
    const send = async (type: string, extra: object = {}) => {
      const res = await act(d, 0, type, extra).expect(200);
      const state = await rawState(d.duelId);
      for (const viewer of [0, 1] as const) {
        const got = (
          await http().get(`/duels/${d.duelId}?viewer=${viewer}`).set(d.guest.auth).expect(200)
        ).body;
        const body = viewer === 0 ? { got, posted: res.body } : { got };
        for (const v of findLeaks(state, viewer, body)) {
          problems.push(`${type} viewer ${viewer}: ${v.path} ${v.reason}`);
        }
      }
      return res.body as { view: StateView; events: Record<string, unknown>[] };
    };
    let phase = (await send('EndPhase')).view.phase;
    while (phase !== 'Main1') phase = (await send('EndPhase')).view.phase;

    // The Field Zone has one slot: any other zoneIndex is refused by the engine (409), zoneIndex 0 is accepted.
    await act(d, 0, 'SetSpellTrap', { cardInstanceId: first, zoneIndex: 3 }).expect(409);
    const set = await send('SetSpellTrap', { cardInstanceId: first, zoneIndex: 0 });
    expect(set.events).toEqual([{ type: 'FieldSpellSet', playerIndex: 0, instanceId: first }]);
    const opp = await viewOf(d, 1);
    expect(opp.players[0].board.fieldZone).toEqual({
      hidden: true,
      instanceId: first,
      ownerIndex: 0,
    });
    expect(opp.players[0].board.spellTrapZones.every((c) => c === null)).toBe(true);

    const legal = (await legalOf(d, 0)) as PlayerAction[];
    const activate = (id: string) =>
      legal.find((a) => a.type === 'ActivateEffect' && a.payload.cardInstanceId === id)!;
    const used = await send('ActivateEffect', activate(first).payload);
    expect(used.events.map((e) => e['type'])).toEqual([
      'EffectActivated',
      'ChainLinkAdded',
      'EffectResolved',
      'ChainResolved',
    ]);
    expect((await viewOf(d, 1)).players[0].board.fieldZone).toMatchObject({
      hidden: false,
      definitionId: 'SMP-113',
      position: 'Attack',
    });

    const replaced = await send('ActivateEffect', activate(second).payload);
    expect(replaced.events).toContainEqual({
      type: 'CardSentToGraveyard',
      ownerIndex: 0,
      instanceId: first,
      definitionId: 'SMP-113',
      from: 'FieldZone',
    });
    const end = await viewOf(d, 1);
    expect(end.players[0].board.fieldZone).toMatchObject({ instanceId: second, hidden: false });
    expect(end.players[0].graveyard.map((c) => c.instanceId)).toEqual([first]);
    expect(problems).toEqual([]);
  });
});

describe('Counter Trap / Negate over HTTP (task 4.4b gate)', () => {
  const seen = new Map<string, number>();
  const rawState = async (duelId: string) => (await app.get(DuelService).getDuel(duelId)).state;
  const defs = new Map(SAMPLE_CARDS.map((c) => [c.id, c]));
  /** Read from the card data (the three operation kinds of task 4.4), not from the id. */
  const negates = (definitionId: string): boolean =>
    (defs.get(definitionId)?.effects ?? []).some((e) =>
      e.operations.some((o) => isNegateOperationKind(o.kind)),
    );

  it.each([1, 2, 3])(
    'fuzz over HTTP with NEGATE_DEMO_DECK, run %i: Set and use the negating cards — the three Negate events reach the sender, no leak to either viewer',
    async (run) => {
      const d = await newDuel({ deck: [...NEGATE_DEMO_DECK] });
      const problems: string[] = [];
      let rng = createRng(`http-negate-${run}`);
      for (let step = 0; step < 220; step++) {
        const state = await rawState(d.duelId);
        if (state.winnerIndex !== null) break;
        const actor = (state.pendingPrompt?.playerIndex ??
          state.chainWindow?.priorityPlayer ??
          state.turnPlayerIndex) as 0 | 1;
        const legal = ((await legalOf(d, actor)) as PlayerAction[]).filter(
          (a) => a.type !== 'Surrender',
        );
        const me = state.players[actor];
        const them = state.players[actor === 0 ? 1 : 0];
        const mine = (id: string) =>
          [...me.hand, ...me.board.spellTrapZones].find((c) => c?.instanceId === id);
        const onNegating = (a: PlayerAction, type: PlayerAction['type']): boolean => {
          if (a.type !== type) return false;
          const card = mine((a.payload as { cardInstanceId: string }).cardInstanceId);
          return card != null && negates(card.definitionId);
        };
        // Steering (the engine decides what is legal): answer with a negation, else Set one, else walk into their
        // Set cards (Summon, attack, activate a Spell from the hand).
        const answers = legal.filter((a) => onNegating(a, 'ActivateEffect'));
        const sets = legal.filter((a) => onNegating(a, 'SetSpellTrap'));
        const theySet = them.board.spellTrapZones.some((c) => c?.position === 'DefenseDown');
        const provoke = theySet
          ? legal.filter(
              (a) =>
                a.type === 'NormalSummon' ||
                a.type === 'DeclareAttack' ||
                (a.type === 'ActivateEffect' &&
                  me.hand.some((c) => c.instanceId === a.payload.cardInstanceId)),
            )
          : [];
        const [roll, r1] = nextInt(rng, 100);
        const steered = [answers, sets, provoke].find((group) => group.length > 0);
        const pool = steered && roll < 70 ? steered : legal;
        const [i, r2] = nextInt(r1, pool.length);
        rng = r2;
        const action = pool[i]!;
        expect(PlayerActionSchema.safeParse(action).success).toBe(true);
        const res = await http()
          .post(`/duels/${d.duelId}/actions`)
          .set(d.guest.auth)
          .send({ playerIndex: actor, action })
          .expect(200);
        for (const e of res.body.events as { type: string }[]) {
          seen.set(e.type, (seen.get(e.type) ?? 0) + 1);
          if (e.type === 'AttackNegated') expect(e).not.toHaveProperty('definitionId');
        }
        const after = await rawState(d.duelId);
        for (const viewer of [0, 1] as const) {
          const got = (
            await http().get(`/duels/${d.duelId}?viewer=${viewer}`).set(d.guest.auth).expect(200)
          ).body;
          const body = viewer === actor ? { got, posted: res.body } : { got };
          for (const v of findLeaks(after, viewer, body)) {
            problems.push(`${run}.${step} ${action.type} viewer ${viewer}: ${v.path} ${v.reason}`);
          }
        }
      }
      expect(problems).toEqual([]);
    },
    120_000,
  );

  it('the runs above really negated an activation, an attack and a Summon over HTTP', () => {
    console.info('[http negate]', Object.fromEntries(seen));
    for (const type of ['ChainLinkNegated', 'AttackNegated', 'SummonNegated']) {
      expect(seen.get(type) ?? 0, type).toBeGreaterThan(0);
    }
  });

  it('NEGATE_DEMO_DECK is accepted as `deck` by POST /duels/solo in solo-vs-ai, and the opening leaks nothing', async () => {
    const guest = await newGuest();
    const res = await http()
      .post('/duels/solo')
      .set(guest.auth)
      .send({ mode: 'solo-vs-ai', deck: [...NEGATE_DEMO_DECK] })
      .expect(201);
    expect(res.body.view.players[0].hand).toHaveLength(5);
    const state = await rawState(res.body.duelId as string);
    expect(findLeaks(state, 0, res.body)).toEqual([]);
  });
});

describe('CORS', () => {
  it('allows configured origins (comma separated) and nobody else', async () => {
    const ok = await http()
      .options('/auth/guest')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Access-Control-Request-Method', 'POST');
    expect(ok.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
    const second = await http().post('/auth/guest').set('Origin', 'http://localhost:4173');
    expect(second.headers['access-control-allow-origin']).toBe('http://localhost:4173');
    const bad = await http().post('/auth/guest').set('Origin', 'http://evil.example');
    expect(bad.headers['access-control-allow-origin']).toBeUndefined();
  });
});
