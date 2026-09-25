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
] as const satisfies readonly OperationKind[];

type Missing<All extends string, Listed extends string> =
  Exclude<All, Listed> extends never ? true : never;
// Compile-time completeness checks (evaluate to `true` or fail to compile).
export const _triggerComplete: Missing<TriggerKind, (typeof TRIGGER_KINDS)[number]> = true;
export const _conditionComplete: Missing<ConditionKind, (typeof CONDITION_KINDS)[number]> = true;
export const _costComplete: Missing<CostKind, (typeof COST_KINDS)[number]> = true;
export const _operationComplete: Missing<OperationKind, (typeof OPERATION_KINDS)[number]> = true;

/**
 * Operation registry — metadata only. Task 3.1 executes nothing: handlers
 * (`effects/operations/<kind>.ts` in the engine) arrive in task 3.2.
 */
export interface OperationEntry {
  readonly implemented: false;
}

export const OPERATION_REGISTRY: Record<OperationKind, OperationEntry> = {
  Damage: { implemented: false },
  Heal: { implemented: false },
  Draw: { implemented: false },
  Destroy: { implemented: false },
};
