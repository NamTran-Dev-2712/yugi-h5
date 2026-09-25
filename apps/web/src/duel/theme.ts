/**
 * The one place that decides how the duel screen looks (colours, fonts, sizes). Scenes and layout read from here,
 * so a manga/classic restyle changes this file only. Colours are 0xRRGGBB numbers (what Phaser Graphics takes);
 * `css` variants are for Phaser Text styles.
 */
export const theme = {
  /** Fixed logical resolution; Phaser scales this to the window (Scale.FIT). */
  frame: { width: 1280, height: 720 },

  card: {
    /** A card on the field (monster / spell-trap / field / deck / graveyard zone). */
    zoneW: 84,
    zoneH: 104,
    zoneGap: 12,
    /** A card in a hand. */
    handW: 64,
    handH: 90,
    handGap: 8,
    radius: 6,
  },

  colors: {
    boardBg: 0x123024,
    boardLine: 0x2f6a4f,
    zone: 0x1b4636,
    zoneSelf: 0x1f4f6b,
    zoneOpp: 0x6b2f2f,
    panel: 0x0d1b16,
    panelLine: 0x3d7a5d,
    monsterFrame: 0xc9a24a,
    spellFrame: 0x2f9e8f,
    trapFrame: 0xa2497a,
    cardBack: 0x5a3b1e,
    cardBackInner: 0x8a5a2b,
    cardFace: 0xf2e6c4,
    lpSelf: 0x3fae6a,
    lpOpp: 0xc4514a,
    lpTrack: 0x1a1a1a,
    button: 0x2a2a3a,
    buttonHover: 0x3a3a55,
    buttonDisabled: 0x1c1c24,
    danger: 0x7a2a2a,
    highlight: 0xf5d76e,
    /** Interaction overlay (task 2.8): all drawn in code, no textures. */
    validZone: 0x7fe07f,
    target: 0xff6b5a,
    arrow: 0xffd23f,
    selected: 0x4fc3f7,
    dim: 0x000000,
    menuBg: 0x1c2a34,
    toastBg: 0x4a1f1f,
  },

  css: {
    text: '#f4f1e6',
    textDim: '#8fa89c',
    textDisabled: '#5a6660',
    gold: '#e8c96f',
    danger: '#e07070',
    good: '#7fd07f',
    cardText: '#20180c',
  },

  fonts: {
    ui: 'Verdana, Arial, sans-serif',
    title: 'Georgia, serif',
    mono: 'Consolas, monospace',
  },

  fontSize: { small: 11, body: 13, label: 15, lp: 26, title: 22 },
} as const;

export type Theme = typeof theme;
