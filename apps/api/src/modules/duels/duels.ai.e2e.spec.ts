import type { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { applyAction } from '@yugi/game-engine';
import { PlayerActionSchema, type CreateSoloResponse, type ViewResponse } from '@yugi/shared';
import { LoggerModule } from 'nestjs-pino';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AllExceptionsFilter } from '../../common/filters/all-exceptions.filter';
import { validateEnv } from '../../config/env.schema';
import { configureApp } from '../../configure-app';
import { AuthModule } from '../auth/auth.module';
import { lookupCard } from './card-pool';
import { initialStateOf } from './duel-store';
import { DuelService } from './duel.service';
import { DuelsModule } from './duels.module';

const ENV = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://user:pass@localhost:5433/db',
  JWT_ACCESS_SECRET: 'e2e-secret-e2e-secret-1234',
  JWT_REFRESH_SECRET: 'r'.repeat(20),
};

let app: INestApplication;
let service: DuelService;
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
  configureApp(nest, 'http://localhost:5173');
  await nest.init();
  app = nest;
  service = moduleRef.get(DuelService);
});

afterAll(async () => {
  await app.close();
});

interface Duel {
  auth: { Authorization: string };
  duelId: string;
  created: CreateSoloResponse;
}

async function newAiDuel(body: object = {}): Promise<Duel> {
  const g = await http().post('/auth/guest').expect(201);
  const auth = { Authorization: `Bearer ${g.body.accessToken as string}` };
  const res = await http()
    .post('/duels/solo')
    .set(auth)
    .send({ mode: 'solo-vs-ai', ...body })
    .expect(201);
  return { auth, duelId: res.body.duelId, created: res.body };
}

const endPhase = (d: Duel, playerIndex: 0 | 1 = 0) =>
  http()
    .post(`/duels/${d.duelId}/actions`)
    .set(d.auth)
    .send({ playerIndex, action: { type: 'EndPhase', payload: { playerIndex } } });

/** The AI hand's instance ids, read from the raw server state (test-only peek). */
async function aiHandIds(d: Duel): Promise<string[]> {
  return (await service.getDuel(d.duelId)).state.players[1].hand.map((c) => c.instanceId);
}

/** No response may pair an AI hand card's instance id with its definition id. */
function expectNoHandLeak(body: unknown, handIds: readonly string[]): void {
  const text = JSON.stringify(body);
  for (const id of handIds) {
    expect(text).not.toMatch(new RegExp(`"instanceId":"${id}"[^}]*"definitionId"`));
    expect(text).not.toMatch(new RegExp(`"definitionId":"[^"]*"[^}]*"instanceId":"${id}"`));
  }
}

describe('POST /duels/solo mode solo-vs-ai', () => {
  it('creates a duel where the caller plays seat 0 and the server plays seat 1', async () => {
    const d = await newAiDuel();
    expect(d.created.mode).toBe('solo-vs-ai');
    expect(d.created.aiSeat).toBe(1);
    expect(d.created.viewer).toBe(0);
    expect(d.created.view.viewerIndex).toBe(0);
    expect(d.created.legalActions.some((a) => a.type === 'EndPhase')).toBe(true);
    expect(d.created.legalActions.every((a) => a.payload.playerIndex === 0)).toBe(true);
    expect(d.created.aiActions).toBeUndefined(); // the human goes first
  });

  it('still defaults to solo-debug and rejects unknown modes', async () => {
    const g = await http().post('/auth/guest').expect(201);
    const auth = { Authorization: `Bearer ${g.body.accessToken as string}` };
    const dbg = await http().post('/duels/solo').set(auth).send({}).expect(201);
    expect(dbg.body.mode).toBe('solo-debug');
    expect(dbg.body.aiSeat).toBeUndefined();
    await http().post('/duels/solo').set(auth).send({ mode: 'pvp' }).expect(400);
  });

  it('refuses to open the duel looking at the AI seat', async () => {
    const g = await http().post('/auth/guest').expect(201);
    const auth = { Authorization: `Bearer ${g.body.accessToken as string}` };
    const res = await http()
      .post('/duels/solo')
      .set(auth)
      .send({ mode: 'solo-vs-ai', viewer: 1 })
      .expect(400);
    expect(res.body.code).toBe('INVALID_VIEWER');
  });
});

describe('solo-vs-ai access', () => {
  it('forbids acting for the AI seat and looking at it', async () => {
    const d = await newAiDuel();
    const act = await endPhase(d, 1).expect(403);
    expect(act.body.code).toBe('NOT_OWNER');
    const look = await http().get(`/duels/${d.duelId}?viewer=1`).set(d.auth).expect(403);
    expect(look.body.code).toBe('NOT_OWNER');
    // the human seat keeps working
    await http().get(`/duels/${d.duelId}?viewer=0`).set(d.auth).expect(200);
  });

  it('gives another guest nothing at all', async () => {
    const d = await newAiDuel();
    const other = await http().post('/auth/guest').expect(201);
    const auth = { Authorization: `Bearer ${other.body.accessToken as string}` };
    await http().get(`/duels/${d.duelId}?viewer=0`).set(auth).expect(403);
    await http()
      .post(`/duels/${d.duelId}/actions`)
      .set(auth)
      .send({ playerIndex: 0, action: { type: 'EndPhase', payload: { playerIndex: 0 } } })
      .expect(403);
  });
});

describe('solo-vs-ai turn over HTTP', () => {
  it('returns the AI turn in the same response, without leaking the AI hand', async () => {
    const d = await newAiDuel();
    const handIds = await aiHandIds(d);
    expect(handIds.length).toBe(5);
    expectNoHandLeak(d.created, handIds);

    let last: ViewResponse | undefined;
    for (let i = 0; i < 6; i++) {
      const res = await endPhase(d).expect(200);
      // Cards the AI played during this request are public by then; only what is STILL in its hand must stay hidden.
      expectNoHandLeak(res.body, await aiHandIds(d));
      last = res.body as ViewResponse;
    }
    const r = last!;
    expect(r.aiActions?.length ?? 0).toBeGreaterThan(0);
    for (const a of r.aiActions ?? []) {
      expect(PlayerActionSchema.safeParse(a.action).success).toBe(true);
      expect(a.action.payload.playerIndex).toBe(1);
      expect(a.action.type).not.toBe('Surrender');
    }
    // the AI's events are in `events`, already filtered for the human
    expect(r.events.some((e) => e.type === 'PhaseChanged')).toBe(true);
    expect(r.view.turnPlayerIndex).toBe(0); // control is back
    expect(r.view.turnCount).toBe(3);
    expect(r.view.viewerIndex).toBe(0);
    expect(r.legalActions.every((a) => a.payload.playerIndex === 0)).toBe(true);

    // GET agrees, and still shows the AI hand only as hidden cards
    const got = await http().get(`/duels/${d.duelId}?viewer=0`).set(d.auth).expect(200);
    expect(got.body.view.version).toBe(r.view.version);
    expect(got.body.view.players[1].hand.every((c: { hidden: boolean }) => c.hidden)).toBe(true);
  });

  it('replays from the action log (human and AI actions) to exactly the stored state', async () => {
    const d = await newAiDuel();
    for (let i = 0; i < 6; i++) await endPhase(d).expect(200);
    const session = await service.getDuel(d.duelId);
    expect(session.actionLog.some((e) => e.playerIndex === 1)).toBe(true);
    let replayed = initialStateOf(session);
    for (const e of session.actionLog) {
      replayed = applyAction(replayed, e.action, { cardDefinitions: lookupCard }).state;
    }
    expect(replayed).toEqual(session.state);
  });
});
