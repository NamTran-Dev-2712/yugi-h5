/** Tunable numbers of the rule-based AI. Defaults are [ASSUMED] (no reference for Yugi H5's own AI). */
export interface AiConfig {
  /** Attack a face-down monster (unknown stats) only with at least this much ATK. */
  readonly facedownAttackMinAtk: number;
  /** A Tribute Summon needs the new monster's ATK >= sacrificed ATK + this margin. */
  readonly tributeAtkMargin: number;
}

export const DEFAULT_AI_CONFIG: AiConfig = {
  facedownAttackMinAtk: 1800,
  tributeAtkMargin: 300,
};

/** Upper bound on AI actions in one server request (loop guard; see DuelManager). */
export const MAX_AI_ACTIONS_PER_REQUEST = 200;
