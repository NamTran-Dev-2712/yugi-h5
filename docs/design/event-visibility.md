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

## Table (15 engine events)

| Event               | Sensitive fields         | Class                         | Note                                                                                                                     |
| ------------------- | ------------------------ | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| DuelStarted         | —                        | PUBLIC                        |                                                                                                                          |
| CardDrawn           | instanceId, definitionId | **OWNER_ONLY**                | The only event that reveals a hidden card. View shape: `{type, playerIndex, card: CardView}`.                            |
| DeckOut             | —                        | PUBLIC                        |                                                                                                                          |
| CardDiscarded       | definitionId             | PUBLIC                        | Goes to the graveyard (public) `[RULE]`.                                                                                 |
| PhaseChanged        | —                        | PUBLIC                        |                                                                                                                          |
| TurnChanged         | —                        | PUBLIC                        |                                                                                                                          |
| NormalSummoned      | definitionId             | PUBLIC                        | Face-up.                                                                                                                 |
| MonsterSet          | — (no definitionId)      | PUBLIC                        | `[ASSUMED]` Reveals which hand `instanceId` was Set; StateView already shows hidden hand ids.                            |
| MonsterTributed     | definitionId             | PUBLIC                        | `[ASSUMED]` Graveyard is public, so Tributing a face-down monster reveals it.                                            |
| PositionChanged     | definitionId             | PUBLIC                        | Only face-up monsters can change.                                                                                        |
| MonsterFlipped      | definitionId             | PUBLIC                        | Flipping is public.                                                                                                      |
| AttackDeclared      | instance ids only        | PUBLIC                        | Target may be face-down but only its id is sent.                                                                         |
| MonsterDestroyed    | definitionId             | PUBLIC                        | `[ASSUMED]` Goes to the graveyard, so a destroyed face-down monster is revealed.                                         |
| DamageDealt         | —                        | PUBLIC                        |                                                                                                                          |
| DuelEnded           | —                        | PUBLIC                        |                                                                                                                          |
| SpellTrapSet        | — (no definitionId)      | PUBLIC, **not forwarded yet** | Task 3.2. Like `MonsterSet`: face-down Set. `toEventView` returns `null` until task 3.2b wires shared `EventView` + web. |
| EffectActivated     | definitionId             | PUBLIC, **not forwarded yet** | Task 3.2. Activating from the hand reveals the Spell.                                                                    |
| EffectResolved      | definitionId             | PUBLIC, **not forwarded yet** | Task 3.2.                                                                                                                |
| CardSentToGraveyard | definitionId             | PUBLIC, **not forwarded yet** | Task 3.2. Used Spell → graveyard (public).                                                                               |
| LifePointsRecovered | —                        | PUBLIC, **not forwarded yet** | Task 3.2.                                                                                                                |
| LifePointsPaid      | —                        | PUBLIC, **not forwarded yet** | Task 3.2.                                                                                                                |
| SpellTrapDestroyed  | definitionId             | PUBLIC, **not forwarded yet** | Task 3.2. `[ASSUMED]` Destroyed face-down Spell/Trap is revealed by the graveyard.                                       |

> Task 3.2 containment: the seven events above are classified but dropped by `toEventView` (`null`), and the actions
> `SetSpellTrap`/`ActivateEffect` are hidden from `legalActions` and refused by `DuelManager.submitAction`. **Before
> 3.2b forwards them, the fuzz/golden "no hidden info over HTTP" gate (PROGRESS) must exist** — Set Spell/Trap is the
> first hidden card on the field.

There are no shuffle / search / Set Spell-Trap events in the engine yet. When they arrive they must be
classified here (see below).

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

## Adding a new event

1. Add it to the engine (`events/types.ts`); `tsc` goes red in `event-view.ts` and the spec fixtures.
2. Add the view type to `packages/shared/src/duel/event-view.ts` (public events keep the engine shape).
3. Classify it in `toEventView` and in this table; add a fixture and, if it can reveal a card, a scenario
   in `event-visibility.spec.ts`.
