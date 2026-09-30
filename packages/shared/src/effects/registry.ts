import type { Condition } from './condition.js';
import type { Cost } from './cost.js';
import type { Operation } from './operation.js';
import type { Trigger } from './trigger.js';

export type TriggerKind = Trigger['kind'];
export type ConditionKind = Condition['kind'];
export type CostKind = Cost['kind'];
export type OperationKind = Operation['kind'];

/** Exhaustive kind lists: adding a kind to a schema without listing it here is a tsc error. */
export const TRIGGER_KINDS = [
  'OnSummon',
  'OnFlip',
  'Continuous',
  'Ignition',
  'Quick',
  'OnDestroyed',
] as const satisfies readonly TriggerKind[];
export const CONDITION_KINDS = [
  'PhaseIs',
  'IsMyTurn',
  'ZoneCount',
] as const satisfies readonly ConditionKind[];
export const COST_KINDS = ['Discard', 'Tribute', 'PayLP'] as const satisfies readonly CostKind[];
export const OPERATION_KINDS = [
  'Damage',
  'Heal',
  'Draw',
  'Destroy',
  'ModifyStat',
  'SpecialSummon',
  'Equip',
] as const satisfies readonly OperationKind[];

/**
 * Operations that are never run on resolution but hold while their card is face-up on the field (task 3.6). They may
 * only appear in `Continuous` effects, and `Continuous` effects may only hold them (see EffectDefinitionSchema).
 */
export const CONTINUOUS_OPERATION_KINDS = [
  'ModifyStat',
] as const satisfies readonly OperationKind[];
export type ContinuousOperationKind = (typeof CONTINUOUS_OPERATION_KINDS)[number];
/** Operations run once, when their chain link resolves. */
export type ResolveOperationKind = Exclude<OperationKind, ContinuousOperationKind>;

export function isContinuousOperationKind(kind: OperationKind): kind is ContinuousOperationKind {
  return (CONTINUOUS_OPERATION_KINDS as readonly OperationKind[]).includes(kind);
}

type Missing<All extends string, Listed extends string> =
  Exclude<All, Listed> extends never ? true : never;
// Compile-time completeness checks (evaluate to `true` or fail to compile).
export const _triggerComplete: Missing<TriggerKind, (typeof TRIGGER_KINDS)[number]> = true;
export const _conditionComplete: Missing<ConditionKind, (typeof CONDITION_KINDS)[number]> = true;
export const _costComplete: Missing<CostKind, (typeof COST_KINDS)[number]> = true;
export const _operationComplete: Missing<OperationKind, (typeof OPERATION_KINDS)[number]> = true;

/**
 * Operation registry — metadata only: it says whether the engine implements a kind, it never holds functions.
 * The handlers live in the engine (`effects/operations/<kind>.ts`); the engine tests that both sides agree.
 */
export interface OperationEntry {
  readonly implemented: boolean;
  /** `resolve` = runs once when its chain link resolves; `continuous` = holds while its card is face-up (task 3.6). */
  readonly timing: 'resolve' | 'continuous';
}

export const OPERATION_REGISTRY: Record<OperationKind, OperationEntry> = {
  Damage: { implemented: true, timing: 'resolve' },
  Heal: { implemented: true, timing: 'resolve' },
  Draw: { implemented: true, timing: 'resolve' },
  Destroy: { implemented: true, timing: 'resolve' },
  ModifyStat: { implemented: true, timing: 'continuous' },
  SpecialSummon: { implemented: true, timing: 'resolve' },
  Equip: { implemented: true, timing: 'resolve' },
};
