import { pickText, type CardDefinition } from '@yugi/shared';
import { getLang } from '../i18n/i18n';

/** Card name/effect text in the language currently selected for the UI. */
export const cardName = (def: CardDefinition): string => pickText(def.name, getLang());
export const cardEffectText = (def: CardDefinition): string | null =>
  def.effectText ? pickText(def.effectText, getLang()) : null;
