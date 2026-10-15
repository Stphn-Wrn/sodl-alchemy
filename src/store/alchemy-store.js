import { MODULE_ID, NOTEBOOK_FLAG, TRADE_MODULE_ID } from "../constants.js";
import { LocalizedError } from "../i18n.js";
import { brewQuality, characterAlchemy, drawSideEffects, learn, noteSuccess, noteUnbound, planBrew, planStudy, rediscoveredRecipes, sideEffectCount, unboundPairs } from "../rules/alchemy.js";
import { potionItemData } from "../rules/potion.js";
import { t, tradeApi } from "../trade-api.js";
import { loadEssences } from "./essence-store.js";

// Brewing is always an Intellect challenge: the alchemist's skill decides how well the essences bind.
const BREW_CHECK = { rolls: true, attribute: "intellect", boons: 0 };

// The rule the trade module runs, on the GM's client, to teach the recipes a brew rediscovered.
export const CAULDRON_DISCOVERY = "sodl-alchemy.cauldron";

// The notebook kept on the character's sheet, or the one the trade module kept there before.
export function readCharacterAlchemy(actor) {
  return characterAlchemy(actor.getFlag(MODULE_ID, NOTEBOOK_FLAG), actor.flags?.[TRADE_MODULE_ID]?.alchemy);
}

function alchemist(user, actorId) {
  const api = tradeApi();
  const actor = game.actors.get(actorId);
  if (!api.isPlayerCharacter(actor)) {
    throw new LocalizedError("SODLTRADE.Errors.InvalidPartner");
  }
  if (!user.isGM && !api.ownsActor(user)(actorId)) {
    throw new LocalizedError("SODLTRADE.Errors.NotYourCharacter");
  }
  return actor;
}

async function rollDice(count) {
  if (count === 0) {
    return [];
  }
  const roll = await new Roll(`${count}d6`).evaluate();
  return roll.dice[0].results.map((result) => result.result);
}

export function cauldronDiscovery(recipes, { used }, actorId) {
  return rediscoveredRecipes(recipes, used, actorId, tradeApi().matchesIngredient);
}

// Putting exactly the ingredients of a recipe into the cauldron teaches it to the character.
// The recipes belong to the trade module's world data, so the GM's client records it; without a GM, nothing is learned.
function rediscover(actor, used) {
  const api = tradeApi();
  if (!game.users.activeGM) {
    return [];
  }
  const entries = used.map((item) => ({ name: item.name, sourceUuids: item.sourceUuids ?? [], container: Boolean(item.container) }));
  const recipes = api.readCrafting().recipes;
  const found = cauldronDiscovery(recipes, { used: entries }, actor.id);
  if (found.length > 0) {
    api.sendRequest("crafting", { action: { type: "discover", actorId: actor.id, rule: CAULDRON_DISCOVERY, payload: { used: entries } } });
  }
  return recipes.filter((recipe) => found.includes(recipe.id)).map((recipe) => recipe.name);
}

function postBrewEvent(actor, potionName) {
  let event = "brewed";
  if (!potionName) {
    event = "brewInert";
  }
  const text = t(`SODLALCHEMY.Chat.${event}`, { name: actor.name, item: potionName });
  return tradeApi().postCraftingChat({ event, text, actorIds: [actor.id], alias: t("SODLALCHEMY.Title") });
}

async function brewPotion(actor, mixture, essences) {
  const quality = brewQuality(await tradeApi().rollChallenge(actor, BREW_CHECK));
  const count = sideEffectCount(quality, mixture.unstable);
  const sideEffects = drawSideEffects(count, await rollDice(count));
  return potionItemData({ effects: mixture.effects, quality, sideEffects }, t, game.i18n.lang, essences);
}

const ACTIONS = {
  async brew(actor, { itemIds }, { index, rules, essences, knowledge, unbound, successes }) {
    const items = tradeApi().toResourceInventory(actor);
    const brew = planBrew({ itemIds, items, index, rules });
    let potion = null;
    let recipes = [];
    if (brew.mixture.effects.length > 0) {
      potion = await brewPotion(actor, brew.mixture, essences);
      recipes = rediscover(actor, [...brew.ingredients, { ...brew.vial, container: true }]);
    }
    const crafted = [];
    if (potion) {
      crafted.push(potion);
    }
    await tradeApi().executeCraft(actor, { ...brew.plan, wealth: null }, crafted);
    await postBrewEvent(actor, potion?.name ?? null);
    const { knowledge: next, learned } = learn(knowledge, brew.mixture.revealed);
    const pairs = unboundPairs(brew.ingredients.map((item) => item.ingredient));
    const fresh = pairs.filter((pair) => !unbound.includes(pair));
    let noted = successes;
    if (potion) {
      noted = noteSuccess(successes, brew.ingredients.map((item) => item.ingredient.key), brew.mixture.effects);
    }
    return {
      knowledge: next,
      unbound: noteUnbound(unbound, pairs),
      successes: noted,
      report: { kind: "brew", name: null, potion: potion && { name: potion.name, img: potion.img, sideEffects: potion.flags[MODULE_ID].potion.sideEffects }, learned, unbound: fresh, recipes }
    };
  },

  async study(actor, { itemId }, { index, knowledge, unbound, successes }) {
    const items = tradeApi().toResourceInventory(actor);
    const study = planStudy({ itemId, items, index, knowledge });
    const name = items.find((item) => item.id === itemId).name;
    await tradeApi().executeCraft(actor, { ...study.plan, wealth: null }, []);
    const { knowledge: next, learned } = learn(knowledge, study.revealed);
    return { knowledge: next, unbound, successes, report: { kind: "study", name, potion: null, learned, unbound: [], recipes: [] } };
  }
};

export async function handleAlchemyRequest(user, { action }) {
  const strategy = ACTIONS[action.type];
  if (!strategy) {
    throw new LocalizedError("SODLTRADE.Errors.UnknownAction");
  }
  const actor = alchemist(user, action.actorId);
  const notebook = readCharacterAlchemy(actor);
  // The essences, their contraries and the ingredients' essences follow the GM's essence book.
  const { index, rules, essences } = await loadEssences();
  const { knowledge, unbound, successes, report } = await strategy(actor, action, { index, rules, essences, knowledge: notebook.journal, unbound: notebook.unbound, successes: notebook.successes });
  // Runs on the player's own client: their character's sheet is theirs to write.
  await actor.setFlag(MODULE_ID, NOTEBOOK_FLAG, { journal: knowledge, unbound, successes, report: { id: foundry.utils.randomID(), ...report } });
}
