import { t } from '../i18n/i18n';

/**
 * UI strings for the duel screen. A thin facade over the locale files (`src/i18n/locales`): every property is a getter,
 * so the text follows the current language at read time (never cache a value at module level). Card text comes from
 * card data, not from here.
 */
const phaseNames = {
  get Draw() {
    return t('duel.phase.Draw');
  },
  get Standby() {
    return t('duel.phase.Standby');
  },
  get Main1() {
    return t('duel.phase.Main1');
  },
  get Battle() {
    return t('duel.phase.Battle');
  },
  get Main2() {
    return t('duel.phase.Main2');
  },
  get End() {
    return t('duel.phase.End');
  },
};

const logCategories = {
  get field() {
    return t('duel.logCategory.field');
  },
  get combat() {
    return t('duel.logCategory.combat');
  },
  get turn() {
    return t('duel.logCategory.turn');
  },
  get error() {
    return t('duel.logCategory.error');
  },
};

export const strings = {
  get menuTitle() {
    return t('duel.menuTitle');
  },
  get playVsAi() {
    return t('duel.playVsAi');
  },
  get starting() {
    return t('duel.starting');
  },
  get startFailed() {
    return t('duel.startFailed');
  },
  get back() {
    return t('duel.back');
  },

  get nextPhase() {
    return t('duel.nextPhase');
  },
  get endTurn() {
    return t('duel.endTurn');
  },
  get surrender() {
    return t('duel.surrender');
  },
  get surrenderConfirm() {
    return t('duel.surrenderConfirm');
  },

  get you() {
    return t('duel.you');
  },
  get opponent() {
    return t('duel.opponent');
  },
  get turn() {
    return t('duel.turn');
  },
  phase: phaseNames,
  get yourTurn() {
    return t('duel.yourTurn');
  },
  get opponentTurn() {
    return t('duel.opponentTurn');
  },

  get thinking() {
    return t('duel.thinking');
  },
  get sending() {
    return t('duel.sending');
  },
  get animating() {
    return t('duel.animating');
  },

  get win() {
    return t('duel.win');
  },
  get lose() {
    return t('duel.lose');
  },
  get draw() {
    return t('duel.draw');
  },
  get backToMenu() {
    return t('duel.backToMenu');
  },

  get discardPrompt() {
    return t('duel.discardPrompt');
  },
  get discardNeedsDrag() {
    return t('duel.discardNeedsDrag');
  },

  // Interaction (task 2.8)
  get summonOption() {
    return t('duel.summonOption');
  },
  get setOption() {
    return t('duel.setOption');
  },
  get toAttackOption() {
    return t('duel.toAttackOption');
  },
  get toDefenseOption() {
    return t('duel.toDefenseOption');
  },
  get confirm() {
    return t('duel.confirm');
  },
  get cancel() {
    return t('duel.cancel');
  },
  get pickTributeHint() {
    return t('duel.pickTributeHint');
  },
  get pickDiscardHint() {
    return t('duel.pickDiscardHint');
  },
  get toastNoZone() {
    return t('duel.toastNoZone');
  },
  get toastCardLocked() {
    return t('duel.toastCardLocked');
  },
  get toastBadTarget() {
    return t('duel.toastBadTarget');
  },
  get toastNotAllowed() {
    return t('duel.toastNotAllowed');
  },
  get toastBusy() {
    return t('duel.toastBusy');
  },
  get sendPreview() {
    return t('duel.sendPreview');
  },
  get promptOther() {
    return t('duel.promptOther');
  },

  get detailEmpty() {
    return t('duel.detailEmpty');
  },
  get detailHidden() {
    return t('duel.detailHidden');
  },
  get logTitle() {
    return t('duel.logTitle');
  },
  get logHide() {
    return t('duel.logHide');
  },
  get logShow() {
    return t('duel.logShow');
  },
  get logAll() {
    return t('duel.logAll');
  },
  logCategory: logCategories,
  get deck() {
    return t('duel.deck');
  },
  get graveyard() {
    return t('duel.graveyard');
  },
  get extraDeck() {
    return t('duel.extraDeck');
  },
  get field() {
    return t('duel.field');
  },
};
