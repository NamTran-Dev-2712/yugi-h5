import { theme } from './theme';

/** Pure geometry for the duel screen (no Phaser). Everything is in the fixed logical frame from `theme.frame`. */

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export type Side = 'self' | 'opp';

type Five<T> = readonly [T, T, T, T, T];

export interface SideLayout {
  readonly monsterZones: Five<Rect>;
  readonly spellTrapZones: Five<Rect>;
  readonly fieldZone: Rect;
  readonly extraDeck: Rect;
  readonly deck: Rect;
  readonly graveyard: Rect;
  readonly lp: Rect;
  /** Band the hand is fanned into (see `handSlots`). */
  readonly handBand: Rect;
}

export interface BoardLayout {
  readonly frame: Rect;
  readonly self: SideLayout;
  readonly opp: SideLayout;
  readonly phase: Rect;
  readonly detail: Rect;
  readonly log: Rect;
  readonly thinking: Rect;
  readonly buttons: {
    readonly nextPhase: Rect;
    readonly endTurn: Rect;
    readonly surrender: Rect;
  };
}

const { frame, card } = theme;

const BOARD_LEFT = 260;
const BOARD_RIGHT = 1020;
const BOARD_CENTER = frame.width / 2;
const ROW_W = 5 * card.zoneW + 4 * card.zoneGap;
const ROW_X = BOARD_CENTER - ROW_W / 2;

// Vertical rows for the viewer's side (bottom). The opponent's side mirrors around the middle of the frame.
const SELF_ST_Y = 516;
const SELF_MON_Y = 402;
const SELF_HAND_Y = 628;

function mirrorY(y: number, h: number): number {
  return frame.height - y - h;
}

function row(y: number): Five<Rect> {
  const cells = [0, 1, 2, 3, 4].map((i) => ({
    x: ROW_X + i * (card.zoneW + card.zoneGap),
    y,
    w: card.zoneW,
    h: card.zoneH,
  }));
  return cells as unknown as Five<Rect>;
}

function sideLayout(side: Side): SideLayout {
  const y = (selfY: number, h: number): number => (side === 'self' ? selfY : mirrorY(selfY, h));
  const stY = y(SELF_ST_Y, card.zoneH);
  const monY = y(SELF_MON_Y, card.zoneH);
  const leftX = ROW_X - card.zoneGap - card.zoneW;
  const rightX = ROW_X + ROW_W + card.zoneGap;
  const handH = card.handH;
  return {
    monsterZones: row(monY),
    spellTrapZones: row(stY),
    fieldZone: { x: leftX, y: monY, w: card.zoneW, h: card.zoneH },
    extraDeck: { x: rightX, y: monY, w: card.zoneW, h: card.zoneH },
    deck: { x: leftX, y: stY, w: card.zoneW, h: card.zoneH },
    graveyard: { x: rightX, y: stY, w: card.zoneW, h: card.zoneH },
    lp: { x: 16, y: side === 'self' ? 640 : 20, w: 228, h: 60 },
    handBand: {
      x: BOARD_LEFT,
      y: y(SELF_HAND_Y, handH),
      w: BOARD_RIGHT - BOARD_LEFT,
      h: handH,
    },
  };
}

export function computeLayout(): BoardLayout {
  return {
    frame: { x: 0, y: 0, w: frame.width, h: frame.height },
    self: sideLayout('self'),
    opp: sideLayout('opp'),
    phase: { x: BOARD_LEFT, y: 322, w: BOARD_RIGHT - BOARD_LEFT, h: 76 },
    detail: { x: 16, y: 120, w: 228, h: 480 },
    log: { x: 1032, y: 16, w: 232, h: 440 },
    thinking: { x: BOARD_LEFT, y: 100, w: BOARD_RIGHT - BOARD_LEFT, h: 0 },
    buttons: {
      nextPhase: { x: 1032, y: 476, w: 232, h: 56 },
      endTurn: { x: 1032, y: 544, w: 232, h: 56 },
      surrender: { x: 1032, y: 640, w: 232, h: 56 },
    },
  };
}

/**
 * Slots for `count` cards fanned across the hand band: centred, normal spacing while it fits, squeezed (cards
 * overlap) when it does not, so any count stays inside the band. Left-to-right order = hand order.
 */
export function handSlots(count: number, side: Side): Rect[] {
  const band = sideLayout(side).handBand;
  if (count <= 0) return [];
  const w = card.handW;
  const idealStep = w + card.handGap;
  const step = count === 1 ? 0 : Math.min(idealStep, (band.w - w) / (count - 1));
  const total = w + step * (count - 1);
  const x0 = band.x + (band.w - total) / 2;
  return Array.from({ length: count }, (_, i) => ({
    x: x0 + i * step,
    y: band.y,
    w,
    h: card.handH,
  }));
}

/** Every fixed rect that must not overlap another (used by tests and by the scene to draw empty zones). */
export function staticRects(layout: BoardLayout): { name: string; rect: Rect }[] {
  const out: { name: string; rect: Rect }[] = [];
  for (const side of ['self', 'opp'] as const) {
    const s = layout[side];
    s.monsterZones.forEach((rect, i) => out.push({ name: `${side}.monster${i}`, rect }));
    s.spellTrapZones.forEach((rect, i) => out.push({ name: `${side}.spellTrap${i}`, rect }));
    out.push({ name: `${side}.field`, rect: s.fieldZone });
    out.push({ name: `${side}.extraDeck`, rect: s.extraDeck });
    out.push({ name: `${side}.deck`, rect: s.deck });
    out.push({ name: `${side}.graveyard`, rect: s.graveyard });
    out.push({ name: `${side}.lp`, rect: s.lp });
    out.push({ name: `${side}.handBand`, rect: s.handBand });
  }
  out.push({ name: 'phase', rect: layout.phase });
  out.push({ name: 'detail', rect: layout.detail });
  out.push({ name: 'log', rect: layout.log });
  out.push({ name: 'button.nextPhase', rect: layout.buttons.nextPhase });
  out.push({ name: 'button.endTurn', rect: layout.buttons.endTurn });
  out.push({ name: 'button.surrender', rect: layout.buttons.surrender });
  return out;
}
