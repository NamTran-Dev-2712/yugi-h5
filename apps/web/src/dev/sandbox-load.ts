import { ScenarioSchema, type Scenario } from '@yugi/shared';

export type ParsedScenario =
  | { readonly ok: true; readonly scenario: Scenario }
  | { readonly ok: false; readonly errors: string[] };

/**
 * Text pasted in the Sandbox page → a scenario, or the list of problems to show (Vietnamese, one line each, schema
 * problems prefixed with their JSON path). Shape only: unknown card ids and board consistency are checked by the server.
 */
export function parseScenarioText(text: string): ParsedScenario {
  const trimmed = text.trim();
  if (trimmed === '') return { ok: false, errors: ['Chưa có JSON để nạp.'] };
  let raw: unknown;
  try {
    raw = JSON.parse(trimmed);
  } catch (e) {
    return {
      ok: false,
      errors: [`JSON không hợp lệ: ${e instanceof Error ? e.message : 'lỗi cú pháp'}`],
    };
  }
  const result = ScenarioSchema.safeParse(raw);
  if (result.success) return { ok: true, scenario: result.data };
  return {
    ok: false,
    errors: result.error.issues.map((i) => `${i.path.join('.') || '(gốc)'}: ${i.message}`),
  };
}

export interface SampleScenario {
  readonly name: string;
  readonly text: string;
}

/** `import.meta.glob` result (path → raw JSON text) → samples named after their file, sorted by name. */
export function sampleList(files: Readonly<Record<string, string>>): SampleScenario[] {
  return Object.entries(files)
    .map(([path, text]) => ({
      name: (path.split('/').pop() ?? path).replace(/\.json$/, ''),
      text,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
