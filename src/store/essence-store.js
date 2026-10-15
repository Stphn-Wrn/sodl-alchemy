import { ESSENCE_BOOK_SETTING, MODULE_ID, modulePath } from "../constants.js";
import { LocalizedError } from "../i18n.js";
import { ingredientIndex } from "../rules/alchemy.js";
import { applyBook, applyEssenceAction, builtinEssences, emptyEssenceBook, essenceRules, removedEssences, resolveEssences } from "../rules/essence-book.js";
import { t, tradeApi } from "../trade-api.js";

let essenceData = null;

// The essences each catalog resource hides ship with this module and never change during a session.
function loadEssenceData() {
  if (!essenceData) {
    essenceData = fetch(modulePath("data/essences.json"), { cache: "no-cache" }).then((response) => response.json()).then((data) => data.essences);
  }
  return essenceData;
}

async function catalogIndex() {
  const [catalog, essences] = await Promise.all([tradeApi().loadResourceCatalog(), loadEssenceData()]);
  return { catalog, index: ingredientIndex(catalog, essences) };
}

export function readEssenceBook() {
  return foundry.utils.deepClone(game.settings.get(MODULE_ID, ESSENCE_BOOK_SETTING) ?? emptyEssenceBook());
}

// Everything brewing and the codex need: the essences in play, those the GM set aside,
// the rules of the cauldron, and the catalog's ingredients with the essences the GM gave them.
export async function loadEssences() {
  const { catalog, index } = await catalogIndex();
  const book = readEssenceBook();
  const builtins = builtinEssences(t);
  const essences = resolveEssences(book, builtins);
  return {
    catalog,
    essences,
    removed: removedEssences(book, builtins),
    rules: essenceRules(essences),
    index: applyBook(index, book, essences)
  };
}

// Only the GM writes the essence book; it is a world setting.
export async function handleEssenceRequest(user, { action }) {
  if (!user.isGM) {
    throw new LocalizedError("SODLTRADE.Errors.NotAllowed");
  }
  const { index } = await catalogIndex();
  const context = { builtins: builtinEssences(t), index };
  await game.settings.set(MODULE_ID, ESSENCE_BOOK_SETTING, applyEssenceAction(readEssenceBook(), action, context));
}
