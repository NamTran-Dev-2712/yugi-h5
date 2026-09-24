import type { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { SAMPLE_CARDS, STARTER_DECK, type StateView } from '@yugi/shared';
import { LoggerModule } from 'nestjs-pino';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AllExceptionsFilter } from '../../common/filters/all-exceptions.filter';
import { validateEnv } from '../../config/env.schema';
import { configureApp } from '../../configure-app';
import { AuthModule } from '../auth/auth.module';
import { DuelsModule } from './duels.module';

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
    const audit = async (label: string, senderBody?: { view: StateView; events: unknown[] }) => {
      const views: [StateView, StateView] = [await viewOf(d, 0), await viewOf(d, 1)];
      for (const viewer of [0, 1] as const) {
        const other = (1 - viewer) as 0 | 1;
        const hidden = hiddenFrom(views[other], other);
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
