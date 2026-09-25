import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { PlayerActionSchema, type CreateSoloResponse } from '@yugi/shared';
import { LoggerModule } from 'nestjs-pino';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AllExceptionsFilter } from '../../common/filters/all-exceptions.filter';
import { validateEnv } from '../../config/env.schema';
import { configureApp } from '../../configure-app';
import { AuthModule } from '../auth/auth.module';
import { DuelsModule } from '../duels/duels.module';
import { devOnlyModules } from './dev-modules';

const ENV = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://user:pass@localhost:5433/db',
  JWT_ACCESS_SECRET: 'e2e-secret-e2e-secret-1234',
  JWT_REFRESH_SECRET: 'r'.repeat(20),
};
const dir = join(__dirname, '../../../../../packages/shared/scenarios');
const scenario = (name: string): Record<string, unknown> =>
  JSON.parse(readFileSync(join(dir, `${name}.json`), 'utf8')) as Record<string, unknown>;

async function makeApp(nodeEnv: string): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        ignoreEnvFile: true,
        validate: () => validateEnv({ ...ENV, NODE_ENV: nodeEnv }),
      }),
      LoggerModule.forRoot({ pinoHttp: { level: 'silent' } }),
      AuthModule,
      DuelsModule,
      ...devOnlyModules(nodeEnv),
    ],
    providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }],
  }).compile();
  const nest = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false });
  configureApp(nest, 'http://localhost:5173');
  await nest.init();
  return nest;
}

describe('POST /dev/sandbox/duels (NODE_ENV=test)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  beforeAll(async () => {
    app = await makeApp('test');
  });
  afterAll(async () => {
    await app.close();
  });

  async function guest() {
    const res = await http().post('/auth/guest').expect(201);
    return { Authorization: `Bearer ${res.body.accessToken}` };
  }
  const load = async (auth: Record<string, string>, body: unknown, query = '') =>
    http()
      .post(`/dev/sandbox/duels${query}`)
      .set(auth)
      .send(body as object);

  it.each(['tribute-summon', 'attack-defense', 'chain-basic'])(
    'loads %s and answers like /duels/solo does',
    async (name) => {
      const auth = await guest();
      const res = await load(auth, scenario(name)).then((r) => r);
      expect(res.status).toBe(201);
      const body = res.body as CreateSoloResponse;
      expect(body).toMatchObject({ mode: 'solo-vs-ai', viewer: 0, aiSeat: 1 });
      expect(body.view.viewerIndex).toBe(0);
      expect(body.view.phase).toBe(scenario(name).phase);
      expect(body.legalActions.length).toBeGreaterThan(0);
      for (const a of body.legalActions) expect(PlayerActionSchema.safeParse(a).success).toBe(true);
    },
  );

  it('the loaded duel is playable through the normal endpoints, and rejected actions are 409', async () => {
    const auth = await guest();
    const created = (await load(auth, scenario('attack-defense'))).body as CreateSoloResponse;
    const attack = created.legalActions.find((a) => a.type === 'DeclareAttack');
    expect(attack).toBeDefined();
    const ok = await http()
      .post(`/duels/${created.duelId}/actions`)
      .set(auth)
      .send({ playerIndex: 0, action: attack });
    expect(ok.status).toBe(200);
    const bad = await http()
      .post(`/duels/${created.duelId}/actions`)
      .set(auth)
      .send({
        playerIndex: 0,
        action: {
          type: 'NormalSummon',
          payload: { playerIndex: 0, cardInstanceId: 'p0-0', zoneIndex: 0 },
        },
      });
    expect(bad.status).toBe(409);
  });

  it('never shows the AI seat hand (chain-basic: its hand holds SMP-007 and a Spell)', async () => {
    const auth = await guest();
    const res = await load(auth, scenario('chain-basic'));
    const json = JSON.stringify(res.body);
    expect(json).not.toContain('SMP-007');
    // Both seats hold a Set SMP-201: only the caller's own may appear.
    expect(json.split('SMP-201')).toHaveLength(2);
  });

  it('solo-debug mode lets the caller view both seats', async () => {
    const auth = await guest();
    const created = (await load(auth, scenario('tribute-summon'), '?mode=solo-debug'))
      .body as CreateSoloResponse;
    expect(created.mode).toBe('solo-debug');
    await http().get(`/duels/${created.duelId}?viewer=1`).set(auth).expect(200);
  });

  it('another guest cannot touch the sandbox duel', async () => {
    const owner = await guest();
    const other = await guest();
    const created = (await load(owner, scenario('tribute-summon'))).body as CreateSoloResponse;
    await http().get(`/duels/${created.duelId}?viewer=0`).set(other).expect(403);
  });

  it('runs a script and shows its result', async () => {
    const auth = await guest();
    const body = {
      ...scenario('tribute-summon'),
      script: [{ type: 'EndPhase', payload: { playerIndex: 0 } }],
    };
    const res = await load(auth, body);
    expect(res.status).toBe(201);
    expect((res.body as CreateSoloResponse).view.phase).toBe('Battle');
  });

  it('a refused script step is 409 with the step number', async () => {
    const auth = await guest();
    const body = {
      ...scenario('tribute-summon'),
      script: [{ type: 'EndPhase', payload: { playerIndex: 1 } }],
    };
    const res = await load(auth, body);
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/step 1/i);
  });

  it('401 without a token', async () => {
    await http().post('/dev/sandbox/duels').send(scenario('tribute-summon')).expect(401);
  });

  it.each([
    [
      'unknown card id',
      (s: Record<string, unknown>) => ({
        ...s,
        players: [{ ...(s.players as object[])[0], hand: ['NOPE-9'] }, (s.players as object[])[1]],
      }),
    ],
  ])('400 for %s (INVALID_SCENARIO names the card)', async (_n, mutate) => {
    const auth = await guest();
    const res = await load(auth, mutate(scenario('tribute-summon')));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_SCENARIO');
    expect(res.body.message).toContain('NOPE-9');
  });

  it('400 VALIDATION_FAILED for a malformed scenario, and for a bad mode', async () => {
    const auth = await guest();
    const res = await load(auth, { ...scenario('tribute-summon'), phase: 'Nope' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
    expect((await load(auth, scenario('tribute-summon'), '?mode=pvp')).status).toBe(400);
    expect((await load(auth, {})).status).toBe(400);
  });
});

describe('POST /dev/sandbox/duels (NODE_ENV=production)', () => {
  it('has no route at all: 404, even with a valid token and scenario', async () => {
    const app = await makeApp('production');
    try {
      const g = await request(app.getHttpServer()).post('/auth/guest').expect(201);
      const res = await request(app.getHttpServer())
        .post('/dev/sandbox/duels')
        .set('Authorization', `Bearer ${g.body.accessToken}`)
        .send(scenario('tribute-summon'));
      expect(res.status).toBe(404);
    } finally {
      await app.close();
    }
  });

  it('devOnlyModules is empty in production and non-empty otherwise', () => {
    expect(devOnlyModules('production')).toHaveLength(0);
    expect(devOnlyModules('development')).toHaveLength(1);
    expect(devOnlyModules('test')).toHaveLength(1);
  });
});
