import { z } from 'zod';

const Seat = z.union([z.literal(0), z.literal(1)]);

/** Every engine Action type; the ones a player may not send (StartDuel/Draw) are refused by DuelManager (403). */
const ACTION_TYPES = [
  'StartDuel',
  'Draw',
  'EndPhase',
  'NormalSummon',
  'SetMonster',
  'ChangePosition',
  'DeclareAttack',
  'Surrender',
  'ResolvePendingPrompt',
] as const;

/** No body at all (Express 5 leaves `req.body` undefined) means "all defaults". */
const orEmpty = (v: unknown): unknown => v ?? {};

const DeckIds = z.array(z.string().min(1).max(64)).max(200);

export const CreateSoloBody = z.preprocess(
  orEmpty,
  z
    .object({
      /** One deck (card definition ids) used by both seats. Absent (and no `decks`) = the starter deck. */
      deck: DeckIds.optional(),
      /** A deck per seat. Mutually exclusive with `deck`. */
      decks: z.tuple([DeckIds, DeckIds]).optional(),
      /** Which seat's view/events to return (the caller owns both in solo-debug). */
      viewer: Seat.default(0),
    })
    .strict()
    .refine((b) => !(b.deck && b.decks), { message: 'Send either "deck" or "decks", not both.' }),
);

export const ViewerQuery = z.preprocess(
  orEmpty,
  z.object({
    viewer: z
      .enum(['0', '1'])
      .default('0')
      .transform((v) => (v === '0' ? 0 : 1) as 0 | 1),
  }),
);

/**
 * Envelope only: the engine validates the payload contents. `payload.playerIndex` is required so DuelManager
 * can bind the action to the seat.
 */
export const ActionBody = z
  .object({
    playerIndex: Seat,
    action: z.object({
      type: z.enum(ACTION_TYPES),
      payload: z.object({ playerIndex: Seat }).passthrough(),
    }),
  })
  .strict();
