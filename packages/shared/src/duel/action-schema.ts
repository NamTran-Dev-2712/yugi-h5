import { z } from 'zod';

/**
 * Network contract for Actions sent by a client (see docs/design/protocol.md). Shape only: it says nothing about
 * whether an action is LEGAL (that is the engine's job, answered as 409 + engineCode). The engine's own `Action`
 * type stays in packages/game-engine (shared must not import it); apps/api asserts at compile time that
 * `PlayerAction` is assignable to it, so the two cannot drift apart silently.
 */

const Seat = z.union([z.literal(0), z.literal(1)]);
const InstanceId = z.string().min(1).max(64);
/** Generous upper bounds: the engine decides the exact counts (Level → tributes, hand limit → discards). */
const InstanceIds = z.array(InstanceId).max(20);

const EndPhase = z
  .object({ type: z.literal('EndPhase'), payload: z.object({ playerIndex: Seat }).strict() })
  .strict();

const MonsterFromHand = z
  .object({
    playerIndex: Seat,
    cardInstanceId: InstanceId,
    zoneIndex: z.number().int().min(0).max(4),
    tributeInstanceIds: InstanceIds.optional(),
  })
  .strict();

const NormalSummon = z
  .object({ type: z.literal('NormalSummon'), payload: MonsterFromHand })
  .strict();
const SetMonster = z.object({ type: z.literal('SetMonster'), payload: MonsterFromHand }).strict();

const ChangePosition = z
  .object({
    type: z.literal('ChangePosition'),
    payload: z
      .object({
        playerIndex: Seat,
        cardInstanceId: InstanceId,
        toPosition: z.enum(['Attack', 'DefenseUp']),
      })
      .strict(),
  })
  .strict();

const DeclareAttack = z
  .object({
    type: z.literal('DeclareAttack'),
    payload: z
      .object({
        playerIndex: Seat,
        attackerInstanceId: InstanceId,
        /** Omitted or null = direct attack. */
        targetInstanceId: InstanceId.nullable().optional(),
      })
      .strict(),
  })
  .strict();

const Surrender = z
  .object({ type: z.literal('Surrender'), payload: z.object({ playerIndex: Seat }).strict() })
  .strict();

const ResolvePendingPrompt = z
  .object({
    type: z.literal('ResolvePendingPrompt'),
    payload: z
      .object({
        playerIndex: Seat,
        promptId: z.string().min(1).max(64),
        cardInstanceIds: InstanceIds,
      })
      .strict(),
  })
  .strict();

/** Sets a Spell/Trap from the hand face-down into Spell/Trap Zone `zoneIndex`. */
const SetSpellTrap = z
  .object({
    type: z.literal('SetSpellTrap'),
    payload: z
      .object({
        playerIndex: Seat,
        cardInstanceId: InstanceId,
        zoneIndex: z.number().int().min(0).max(4),
      })
      .strict(),
  })
  .strict();

/**
 * Activates effect `effectId` of a card. `costInstanceIds` pays the effect's Discard/Tribute costs in order. Targets are
 * never in the payload: when there is a choice the engine opens a `SelectEffectTarget` prompt.
 */
const ActivateEffect = z
  .object({
    type: z.literal('ActivateEffect'),
    payload: z
      .object({
        playerIndex: Seat,
        cardInstanceId: InstanceId,
        effectId: z.string().min(1).max(64),
        costInstanceIds: InstanceIds.optional(),
      })
      .strict(),
  })
  .strict();

/** The actions a player may send. */
export const PlayerActionSchema = z.discriminatedUnion('type', [
  EndPhase,
  NormalSummon,
  SetMonster,
  ChangePosition,
  DeclareAttack,
  Surrender,
  ResolvePendingPrompt,
  SetSpellTrap,
  ActivateEffect,
]);
export type PlayerAction = z.infer<typeof PlayerActionSchema>;

/**
 * `StartDuel` and `Draw` exist in the engine but a player may never send them (Draw is internal to EndPhase). They
 * pass the envelope here — only `payload.playerIndex` is checked — so the server can answer 403 FORBIDDEN_ACTION
 * instead of a misleading 400.
 */
const ForbiddenEnvelope = z.object({
  type: z.enum(['StartDuel', 'Draw']),
  payload: z.object({ playerIndex: Seat }).passthrough(),
});

/** Everything the HTTP layer accepts in `action`: player actions (strict) + the two the server refuses with 403. */
export const ActionInputSchema = z.union([PlayerActionSchema, ForbiddenEnvelope]);
export type ActionInput = z.infer<typeof ActionInputSchema>;
