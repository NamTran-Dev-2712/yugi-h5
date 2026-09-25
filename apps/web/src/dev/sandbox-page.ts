import Phaser from 'phaser';
import { createAppController } from '../duel/services';
import { theme } from '../duel/theme';
import { DuelScene } from '../scenes/duel-scene';
import { parseScenarioText, sampleList } from './sandbox-load';
import { SandboxBootScene, SandboxMenuScene } from './sandbox-scenes';

/** Sample scenarios live next to the shared package; raw text so the textarea shows exactly what will be sent. */
const SAMPLES = sampleList(
  import.meta.glob('../../../../packages/shared/scenarios/*.json', {
    eager: true,
    query: '?raw',
    import: 'default',
  }) as Record<string, string>,
);

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
): HTMLElementTagNameMap[K] {
  return Object.assign(document.createElement(tag), props);
}

/**
 * DEV ONLY page (`/dev/sandbox.html`, not part of the production build): paste a scenario, press "Nạp", play it in the
 * real Duel scene. Everything after the load is the normal duel (server validates each action, legalActions, AI).
 */
export function mountSandboxPage(root: HTMLElement): void {
  const status = el('div', { className: 'status' });
  const errors = el('pre', { className: 'errors' });
  const textarea = el('textarea', { rows: 16, spellcheck: false });
  textarea.setAttribute('aria-label', 'Scenario JSON');
  const picker = el('select');
  picker.append(el('option', { value: '', textContent: '— chọn scenario mẫu —' }));
  for (const s of SAMPLES) picker.append(el('option', { value: s.name, textContent: s.name }));
  const load = el('button', { textContent: 'Nạp', type: 'button' });
  const stop = el('button', { textContent: 'Đóng ván', type: 'button', disabled: true });
  const stage = el('div', { id: 'sandbox-game' });

  let game: Phaser.Game | null = null;
  const closeGame = (): void => {
    game?.destroy(true);
    game = null;
    stage.replaceChildren();
    stop.disabled = true;
  };

  picker.addEventListener('change', () => {
    const sample = SAMPLES.find((s) => s.name === picker.value);
    if (sample) textarea.value = sample.text;
    errors.textContent = '';
  });

  load.addEventListener('click', () => {
    void (async () => {
      errors.textContent = '';
      const parsed = parseScenarioText(textarea.value);
      if (!parsed.ok) {
        errors.textContent = parsed.errors.join('\n');
        return;
      }
      load.disabled = true;
      status.textContent = 'Đang nạp…';
      closeGame();
      const controller = createAppController();
      await controller.startScenario(parsed.scenario);
      load.disabled = false;
      const { duelId, error } = controller.getState();
      if (duelId === null) {
        status.textContent = '';
        errors.textContent = error ?? 'Nạp thất bại.';
        return;
      }
      status.textContent = `Ván ${duelId} — "${parsed.scenario.name}" (đối thủ = AI, ghế 1)`;
      stop.disabled = false;
      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: stage,
        width: theme.frame.width,
        height: theme.frame.height,
        backgroundColor: '#0a0a0f',
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_HORIZONTALLY },
        scene: [
          new SandboxBootScene(controller),
          new DuelScene(),
          new SandboxMenuScene(() => setTimeout(closeGame, 0)),
        ],
      });
    })();
  });
  stop.addEventListener('click', closeGame);

  const bar = el('div', { className: 'bar' });
  bar.append(picker, load, stop, status);
  root.append(
    el('p', {
      className: 'hint',
      textContent:
        'Công cụ DEV. Dán scenario JSON (hoặc chọn mẫu), sửa id lá bài rồi bấm Nạp. Chỉ lá trong pool SMP-… mới hợp lệ; server báo lỗi nếu id sai.',
    }),
    bar,
    textarea,
    errors,
    stage,
  );
}
