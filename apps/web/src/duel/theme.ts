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
    /** Chain UI (task 3.7): outline of a Set card a tap activates, and the "waiting for a response" strip. */
    activatable: 0xc38bff,
    chainBanner: 0x3a2358,
    /** Task 4.2d [GUESS] G19: the line + outlines tying an Equip card to its monster, and the graveyard picker panel. */
    equipLink: 0x5fd3b3,
    pickerBg: 0x16222b,
    /**
     * Task 4.3b [GUESS] G21: the Field Zone (empty-slot border, the inner border + diamond of a face-up Field Spell) and
     * the "in force" mark (outline + corner dot) of a Field / Continuous card resting face-up on the field.
     */
    fieldFrame: 0x6fcf73,
    activeMark: 0xffe27a,
    /**
     * Task 4.4b [GUESS] G24: the cross drawn over a negated card / Summoned monster / stopped attack arrow, and the line
     * through the caption of a negated chain link.
     */
    negate: 0xff4d4d,
  },

  css: {
    text: '#f4f1e6',
    textDim: '#8fa89c',
    textDisabled: '#5a6660',
    gold: '#e8c96f',
    danger: '#e07070',
    good: '#7fd07f',
    cardText: '#20180c',
    /** Effective ATK/DEF on a card face (task 3.7): readable on the light card face. */
    statUp: '#1b7a2f',
    statDown: '#b3261e',
  },

  fonts: {
    ui: 'Verdana, Arial, sans-serif',
    title: 'Georgia, serif',
    mono: 'Consolas, monospace',
  },

  fontSize: { small: 11, body: 13, label: 15, lp: 26, title: 22 },
} as const;

export type Theme = typeof theme;
