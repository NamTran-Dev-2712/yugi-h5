import type { Action } from '@yugi/game-engine';
import { ActionInputSchema, type PlayerAction } from '@yugi/shared';
import { z } from 'zod';

/**
 * Compile-time guard: what the shared schema accepts from a player must be a valid engine Action. If the engine
 * changes an Action shape (or a new player action is added there) without the schema following, `tsc` fails here.
 */
type Assert<T extends true> = T;
/**
 * `z.infer` types an optional key as `?: T | undefined`, the engine (exactOptionalPropertyTypes) as `?: T`. Zod never
 * emits an explicit `undefined` key at runtime, so drop the `| undefined` before comparing.
 */
type ExactOptional<T> = T extends readonly unknown[]
  ? T
  : T extends object
    ? {
        [K in keyof T as undefined extends T[K] ? never : K]: ExactOptional<T[K]>;
      } & {
        [K in keyof T as undefined extends T[K] ? K : never]?: ExactOptional<
          Exclude<T[K], undefined>
        >;
      }
    : T;
export type PlayerActionMatchesEngine = Assert<
  ExactOptional<PlayerAction> extends Action ? true : false
>;

const Seat = z.union([z.literal(0), z.literal(1)]);

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
 * The action's SHAPE is validated by the shared schema (malformed payload = 400); whether it is LEGAL is the
 * engine's call (409 + engineCode). StartDuel/Draw pass the envelope so DuelManager can answer 403.
 * `payload.playerIndex` is required so DuelManager can bind the action to the seat.
 */
export const ActionBody = z
  .object({
    playerIndex: Seat,
    action: ActionInputSchema,
  })
  .strict();
