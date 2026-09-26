# Event visibility (GameEvent → EventView)

Server-authoritative: clients only ever receive `EventView`, never a raw engine `GameEvent`.
Filter: `toEventView(event, viewerIndex)` / `toEventViews(events, viewerIndex)` in
`apps/api/src/modules/duels/event-view.ts`. Types: `packages/shared/src/duel/event-view.ts`.
`DuelManager.submitAction` returns `eventsByViewer` (forward `eventsByViewer[i]` to player `i` only);
raw events never leave the class.

## Classes

- **PUBLIC** — both viewers get the event unchanged (same shape as the engine event).
- **OWNER_ONLY** — the owner gets the full event; the opponent gets a hidden form
  (`{hidden:true, instanceId, ownerIndex}` from `CardView`, no `definitionId`).
- **HIDDEN** — the opponent gets nothing (`toEventView` returns `null`). No event is HIDDEN today;
  this is also the **default for any unclassified event** (deny by default).

## Table (22 engine events)

| Event               | Sensitive fields         | Class          | Note                                                                                                        |
| ------------------- | ------------------------ | -------------- | ----------------------------------------------------------------------------------------------------------- |
| DuelStarted         | —                        | PUBLIC         |                                                                                                             |
| CardDrawn           | instanceId, definitionId | **OWNER_ONLY** | The only event that reveals a hidden card. View shape: `{type, playerIndex, card: CardView}`.               |
| DeckOut             | —                        | PUBLIC         |                                                                                                             |
| CardDiscarded       | definitionId             | PUBLIC         | Goes to the graveyard (public) `[RULE]`.                                                                    |
| PhaseChanged        | —                        | PUBLIC         |                                                                                                             |
| TurnChanged         | —                        | PUBLIC         |                                                                                                             |
| NormalSummoned      | definitionId             | PUBLIC         | Face-up.                                                                                                    |
| MonsterSet          | — (no definitionId)      | PUBLIC         | `[ASSUMED]` Reveals which hand `instanceId` was Set; StateView already shows hidden hand ids.               |
| MonsterTributed     | definitionId             | PUBLIC         | `[ASSUMED]` Graveyard is public, so Tributing a face-down monster reveals it.                               |
| PositionChanged     | definitionId             | PUBLIC         | Only face-up monsters can change.                                                                           |
| MonsterFlipped      | definitionId             | PUBLIC         | Flipping is public.                                                                                         |
| AttackDeclared      | instance ids only        | PUBLIC         | Target may be face-down but only its id is sent.                                                            |
| MonsterDestroyed    | definitionId             | PUBLIC         | `[ASSUMED]` Goes to the graveyard, so a destroyed face-down monster is revealed.                            |
| DamageDealt         | —                        | PUBLIC         |                                                                                                             |
| DuelEnded           | —                        | PUBLIC         |                                                                                                             |
| SpellTrapSet        | — (no definitionId)      | PUBLIC         | Task 3.2 (forwarded since 3.2b). Like `MonsterSet`: face-down Set, only the hand `instanceId` and the zone. |
| EffectActivated     | definitionId             | PUBLIC         | Activating a Spell from the hand reveals it `[RULE]`.                                                       |
| EffectResolved      | definitionId             | PUBLIC         | Same card as `EffectActivated` (already revealed).                                                          |
| CardSentToGraveyard | definitionId             | PUBLIC         | Used Spell → graveyard (public).                                                                            |
| LifePointsRecovered | —                        | PUBLIC         | No card data.                                                                                               |
| LifePointsPaid      | —                        | PUBLIC         | No card data (LP cost).                                                                                     |
| SpellTrapDestroyed  | definitionId             | PUBLIC         | `[ASSUMED]` Destroyed face-down Spell/Trap is revealed by the graveyard (like `MonsterDestroyed`).          |

> Task 3.2b wired the seven Spell/Trap events (task 3.2 had them classified but dropped). The gate that came with
> it: `event-visibility.fuzz.spec.ts` (seeded fuzz through `DuelManager`) and the Spell/Trap cases in `duels.e2e.spec.ts`
> (real HTTP) check every response with the shape-agnostic oracle `testing/leak-check.ts` (see Guards).

There are no shuffle / search events in the engine yet. When they arrive they must be classified here (see below).

**Prompt payloads** are filtered too (`toStateView`, not `toEventView`): the prompted player gets
`pendingPrompt.payload` as is; the other player only for a kind listed public (`DiscardToHandLimit`), every other kind
(`SelectEffectTarget`: it names the hand card being activated; any future kind) gets `payload: null` (deny by default).

## Decision basis

The decision depends only on the event **type**, not on state before/after: the engine already emits
events with the reveal semantics baked in. **Contract on the engine:** an event never carries the
`definitionId` of a card that is still hidden from the opponent, except `CardDrawn`. If an event ever
needs the previous zone/face state to be filtered, add an explicit parameter to `toEventView`; do not infer.

`instanceId` (`p<i>-<n>`, `n` = pre-shuffle deck position) reveals nothing about card content: the
opponent does not know the decklist. Hidden cards keep their `instanceId` so the client can position and
animate them.

## Guards

- `toEventView` is an exhaustive `switch` with a `never` check: a new `GameEvent` type without a case
  fails `pnpm --filter @yugi/api typecheck` (verified by adding a probe event to the engine union).
  Runtime default is `null` (dropped).
- `event-view.spec.ts`: one fixture per event type (typed `Record`, so a new type breaks compilation),
  both viewers, JSON scan for hidden ids, deny-by-default.
- `event-visibility.spec.ts`: replays real games through `DuelManager` and, after every accepted action,
  checks that each viewer's events never contradict that viewer's `StateView` (revealed cards must be
  visible there; hidden ones must still be hidden).
- **Gate (task 3.2b)** `testing/leak-check.ts` (`findLeaks(rawState, viewer, anything)`): walks any JSON a viewer gets,
  every object with a `definitionId` must name a card that is, in the raw state after the action, in a graveyard/banished,
  face-up on the field, or the viewer's own card in hand/on the field; never a deck card (not even for its owner); a
  `definitionId` without `instanceId` is a violation. Used by `event-visibility.fuzz.spec.ts` (N seeds × M steps, Spell/Trap
  actions favoured, ~8% illegal Spell/Trap attempts that must be refused and change nothing; asserts every Spell/Trap event
  and a `SelectEffectTarget` prompt were covered; `FUZZ_SEEDS`/`FUZZ_STEPS` for long runs) and by the HTTP fuzz/golden in
  `duels.e2e.spec.ts`. The helper has its own negative tests.

## Adding a new event

1. Add it to the engine (`events/types.ts`); `tsc` goes red in `event-view.ts` and the spec fixtures.
2. Add the view type to `packages/shared/src/duel/event-view.ts` (public events keep the engine shape).
3. Classify it in `toEventView` and in this table; add a fixture and, if it can reveal a card, a scenario
   in `event-visibility.spec.ts`.
