import {
  PlayerActionSchema,
  type CardDefinition,
  type CardView,
  type PlayerAction,
  type PlayerIndex,
  type StateView,
} from '@yugi/shared';

/**
 * Turns a StateView into the buttons/forms the debug page shows. It only LISTS what exists on screen (cards in
 * hand, monsters on the field, a waiting prompt). It does not decide what is legal: no phase/turn/Level/zone
 * rules are copied here, so a wrong click is answered by the server (409 + engineCode), which is exactly what the
 * person testing wants to see.
 */

export interface InputOption {
  readonly value: string;
  readonly label: string;
}

export interface InputSpec {
  readonly name: 'zoneIndex' | 'tributeInstanceIds' | 'targetInstanceId' | 'cardInstanceIds';
  readonly label: string;
  /** false = pick one (select), true = pick any number (checkboxes). */
  readonly multiple: boolean;
  readonly options: readonly InputOption[];
}

export interface ActionButton {
  /** Stable key, e.g. `NormalSummon:p0-3`. */
  readonly id: string;
  readonly label: string;
  /** `EndTurn` is client-only sugar: it presses EndPhase repeatedly (see `shouldContinueEndTurn`). */
  readonly type: PlayerAction['type'] | 'EndTurn';
  readonly playerIndex: PlayerIndex;
  /** Payload fields already known from the state. */
  readonly fixed: Readonly<Record<string, unknown>>;
  /** What the person still has to choose. */
  readonly inputs: readonly InputSpec[];
}

export type ChosenValues = Readonly<Record<string, string | readonly string[]>>;
export type CardLookup = (definitionId: string) => CardDefinition | undefined;

const ZONES = [0, 1, 2, 3, 4] as const;

export function cardLabel(card: CardView, lookup: CardLookup): string {
  if (card.hidden) return `? [${card.instanceId}]`;
  return `${lookup(card.definitionId)?.name ?? card.definitionId} [${card.instanceId}]`;
}

const isMonster = (card: CardView, lookup: CardLookup): boolean =>
  !card.hidden && lookup(card.definitionId)?.kind === 'Monster';

function promptCount(payload: unknown): number | undefined {
  if (typeof payload !== 'object' || payload === null) return undefined;
  const count = (payload as { count?: unknown }).count;
  return typeof count === 'number' ? count : undefined;
}

export function buildActionButtons(view: StateView, lookup: CardLookup): ActionButton[] {
  if (view.winnerIndex !== null) return [];
  const seat = view.viewerIndex;
  const me = view.players[seat];
  const opponent = view.players[(1 - seat) as PlayerIndex];
  const buttons: ActionButton[] = [];

  buttons.push({
    id: 'EndPhase',
    label: `EndPhase (đang ở ${view.phase})`,
    type: 'EndPhase',
    playerIndex: seat,
    fixed: {},
    inputs: [],
  });
  buttons.push({
    id: 'EndTurn',
    label: 'End Turn (bấm EndPhase tới hết lượt)',
    type: 'EndTurn',
    playerIndex: seat,
    fixed: {},
    inputs: [],
  });

  const ownMonsters = me.board.monsterZones.filter((c): c is CardView => c !== null);
  const zoneInput: InputSpec = {
    name: 'zoneIndex',
    label: 'Ô quái',
    multiple: false,
    options: ZONES.map((z) => ({
      value: String(z),
      label: `ô ${z} (${me.board.monsterZones[z] ? 'có quái' : 'trống'})`,
    })),
  };
  const tributeInput: InputSpec = {
    name: 'tributeInstanceIds',
    label: 'Tribute (chọn tuỳ ý, server kiểm số lượng)',
    multiple: true,
    options: ownMonsters.map((c) => ({ value: c.instanceId, label: cardLabel(c, lookup) })),
  };

  for (const card of me.hand) {
    if (!isMonster(card, lookup)) continue;
    const label = cardLabel(card, lookup);
    buttons.push({
      id: `NormalSummon:${card.instanceId}`,
      label: `Triệu hồi ${label}`,
      type: 'NormalSummon',
      playerIndex: seat,
      fixed: { cardInstanceId: card.instanceId },
      inputs: [zoneInput, tributeInput],
    });
    buttons.push({
      id: `SetMonster:${card.instanceId}`,
      label: `Úp ${label}`,
      type: 'SetMonster',
      playerIndex: seat,
      fixed: { cardInstanceId: card.instanceId },
      inputs: [zoneInput, tributeInput],
    });
  }

  const targetInput: InputSpec = {
    name: 'targetInstanceId',
    label: 'Mục tiêu',
    multiple: false,
    options: [
      { value: '', label: 'Tấn công trực tiếp' },
      ...opponent.board.monsterZones
        .filter((c): c is CardView => c !== null)
        .map((c) => ({ value: c.instanceId, label: cardLabel(c, lookup) })),
    ],
  };

  for (const card of ownMonsters) {
    if (card.hidden) continue;
    const label = cardLabel(card, lookup);
    if (card.position === 'Attack' || card.position === 'DefenseUp') {
      const toPosition = card.position === 'Attack' ? 'DefenseUp' : 'Attack';
      buttons.push({
        id: `ChangePosition:${card.instanceId}`,
        label: `Đổi thế ${label} → ${toPosition}`,
        type: 'ChangePosition',
        playerIndex: seat,
        fixed: { cardInstanceId: card.instanceId, toPosition },
        inputs: [],
      });
    }
    if (card.position === 'Attack') {
      buttons.push({
        id: `DeclareAttack:${card.instanceId}`,
        label: `Tấn công bằng ${label}`,
        type: 'DeclareAttack',
        playerIndex: seat,
        fixed: { attackerInstanceId: card.instanceId },
        inputs: [targetInput],
      });
    }
  }

  const prompt = view.pendingPrompt;
  if (prompt && prompt.playerIndex === seat && prompt.kind === 'DiscardToHandLimit') {
    const count = promptCount(prompt.payload);
    buttons.push({
      id: 'ResolvePendingPrompt',
      label: count === undefined ? 'Bỏ bài (prompt)' : `Bỏ ${count} lá (prompt)`,
      type: 'ResolvePendingPrompt',
      playerIndex: seat,
      fixed: { promptId: prompt.promptId },
      inputs: [
        {
          name: 'cardInstanceIds',
          label: 'Lá bỏ',
          multiple: true,
          options: me.hand.map((c) => ({ value: c.instanceId, label: cardLabel(c, lookup) })),
        },
      ],
    });
  }

  buttons.push({
    id: 'Surrender',
    label: 'Surrender',
    type: 'Surrender',
    playerIndex: seat,
    fixed: {},
    inputs: [],
  });
  return buttons;
}

export interface AnnotatedButton {
  readonly button: ActionButton;
  /** true when the server's `legalActions` contains at least one action this button could produce. */
  readonly legal: boolean;
}

const payloadOf = (action: PlayerAction): Record<string, unknown> =>
  action.payload as unknown as Record<string, unknown>;

function narrowInput(input: InputSpec, matching: readonly PlayerAction[]): InputSpec {
  const allowed = new Set<string>();
  for (const action of matching) {
    const p = payloadOf(action);
    switch (input.name) {
      case 'zoneIndex':
        if (typeof p.zoneIndex === 'number') allowed.add(String(p.zoneIndex));
        break;
      case 'targetInstanceId':
        allowed.add(typeof p.targetInstanceId === 'string' ? p.targetInstanceId : '');
        break;
      case 'tributeInstanceIds':
      case 'cardInstanceIds': {
        const ids = p[input.name];
        if (Array.isArray(ids)) for (const id of ids) allowed.add(String(id));
        break;
      }
    }
  }
  return { ...input, options: input.options.filter((o) => allowed.has(o.value)) };
}

/**
 * Marks which buttons the server says are legal (`legalActions`, already filtered by the engine's own validators;
 * nothing is re-derived here). `narrow` also cuts the choice lists down to values that appear in some legal action;
 * turn it off to let the tester pick anything and watch the server answer 409.
 * `legalActions === null` (no server answer yet) leaves every button legal.
 */
export function applyLegality(
  buttons: readonly ActionButton[],
  legalActions: readonly PlayerAction[] | null,
  narrow: boolean,
): AnnotatedButton[] {
  if (legalActions === null) return buttons.map((button) => ({ button, legal: true }));
  return buttons.map((button) => {
    const type = button.type === 'EndTurn' ? 'EndPhase' : button.type;
    const matching = legalActions.filter((a) => {
      if (a.type !== type) return false;
      const p = payloadOf(a);
      return (
        p.playerIndex === button.playerIndex &&
        Object.entries(button.fixed).every(([key, value]) => p[key] === value)
      );
    });
    const legal = matching.length > 0;
    if (!narrow || !legal || button.inputs.length === 0) return { button, legal };
    return {
      button: { ...button, inputs: button.inputs.map((i) => narrowInput(i, matching)) },
      legal,
    };
  });
}

/** Assembles the action to send from a button + what was chosen; the shared schema has the final say on shape. */
export function toAction(button: ActionButton, chosen: ChosenValues): PlayerAction {
  if (button.type === 'EndTurn')
    throw new Error('EndTurn is client-only: it sends EndPhase repeatedly');
  const payload: Record<string, unknown> = { playerIndex: button.playerIndex, ...button.fixed };
  for (const input of button.inputs) {
    const value = chosen[input.name];
    switch (input.name) {
      case 'zoneIndex':
        payload.zoneIndex = Number(value);
        break;
      case 'tributeInstanceIds':
        if (Array.isArray(value) && value.length > 0) payload.tributeInstanceIds = [...value];
        break;
      case 'targetInstanceId':
        payload.targetInstanceId = value === '' || value === undefined ? null : value;
        break;
      case 'cardInstanceIds':
        payload.cardInstanceIds = Array.isArray(value) ? [...value] : [];
        break;
    }
  }
  return PlayerActionSchema.parse({ type: button.type, payload });
}

/** Which seat the person most likely wants to look at next: the one the server is waiting for. */
export function pickViewer(view: StateView): PlayerIndex {
  if (view.winnerIndex !== null) return view.viewerIndex;
  return view.pendingPrompt?.playerIndex ?? view.turnPlayerIndex;
}

/** "End Turn" keeps sending EndPhase while nothing but the phase changed. */
export function shouldContinueEndTurn(startTurnCount: number, view: StateView): boolean {
  return (
    view.winnerIndex === null && view.pendingPrompt === null && view.turnCount === startTurnCount
  );
}
