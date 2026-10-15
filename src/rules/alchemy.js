import { LocalizedError } from "../i18n.js";

// Every alchemical ingredient hides two to four essences. Those shared by at least two ingredients
// in the cauldron show in the brew; the others stay secret until another mixture or a study reveals them.
export const ESSENCES = ["vitality", "purge", "venom", "vigil", "cinder", "shadow", "stone", "fury", "clarity", "haste", "decay", "dream", "abyss", "ward"];

// A brew holding both essences of a pair is unstable and always goes wrong somehow.
const OPPOSITES = [["vitality", "decay"], ["purge", "venom"], ["clarity", "dream"], ["ward", "abyss"], ["haste", "stone"]];

export function oppositeOf(essence) {
  const pair = OPPOSITES.find((entry) => entry.includes(essence));
  if (!pair) {
    return null;
  }
  return pair.find((entry) => entry !== essence);
}

// Rolled on a d6 when the brew is flawed or unstable.
export const SIDE_EFFECTS = ["corruption", "madness", "nausea", "eruption", "visions", "stigma"];

export const VIAL_KEY = "empty-vial";
export const MIN_INGREDIENTS = 2;
export const MAX_INGREDIENTS = 4;

const POTENT_TOTAL = 20;
const SUCCESS_TOTAL = 10;

// A character's notebook lives on their sheet, so their player can write it without the GM.
// The one the trade module kept before the alchemy had its own module is read until the character writes a new one.
export function characterAlchemy(flag, earlier) {
  const notebook = flag ?? earlier ?? {};
  return { journal: notebook.journal ?? {}, unbound: notebook.unbound ?? [], successes: notebook.successes ?? [], report: notebook.report ?? null };
}

// The mixes that made a potion, so the player can see what worked and brew it again.
// The same ingredients in another order are the same mix.
export function noteSuccess(successes, ingredientKeys, effects) {
  const keys = [...new Set(ingredientKeys)].sort();
  const same = (entry) => entry.keys.join("|") === keys.join("|");
  if (successes.some(same)) {
    return successes.map((entry) => {
      if (same(entry)) {
        return { keys, effects: [...effects] };
      }
      return entry;
    });
  }
  return [...successes, { keys, effects: [...effects] }];
}

function normalizeName(name) {
  return String(name ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

// Catalog resources by key, with their names in every language so an item without the module's flag is still found.
// The essences each resource hides come from this module's own data, keyed by resource.
export function ingredientIndex(catalog, essencesByResource) {
  return catalog.folders
    .flatMap((folder) => folder.items)
    .map((resource) => ({ key: resource.key, names: Object.values(resource.name ?? {}).map(normalizeName), essences: essencesByResource[resource.key] ?? [] }));
}

export function findIngredient(index, item) {
  if (item.resourceKey) {
    const byKey = index.find((ingredient) => ingredient.key === item.resourceKey);
    if (byKey) {
      return byKey;
    }
  }
  const name = normalizeName(item.name);
  return index.find((ingredient) => ingredient.names.includes(name)) ?? null;
}

// What a character can throw into the cauldron: the items whose ingredient has essences.
export function shelf(items, index) {
  return items
    .map((item) => ({ ...item, ingredient: findIngredient(index, item) }))
    .filter((item) => item.ingredient && item.ingredient.essences.length > 0);
}

// The essences of the books; the GM's essence book replaces them at the table.
const BOOK_RULES = { order: ESSENCES, opposites: OPPOSITES };

export function combine(ingredients, rules = BOOK_RULES) {
  const essenceOrder = (essence) => rules.order.indexOf(essence);
  const counts = new Map();
  for (const ingredient of ingredients) {
    for (const essence of new Set(ingredient.essences)) {
      counts.set(essence, (counts.get(essence) ?? 0) + 1);
    }
  }
  const effects = [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .sort(([first, firstCount], [second, secondCount]) => secondCount - firstCount || essenceOrder(first) - essenceOrder(second))
    .map(([essence]) => essence);
  const revealed = {};
  for (const ingredient of ingredients) {
    const shown = effects.filter((essence) => ingredient.essences.includes(essence));
    if (shown.length > 0) {
      revealed[ingredient.key] = shown;
    }
  }
  const unstable = rules.opposites.some(([first, second]) => effects.includes(first) && effects.includes(second));
  return { effects, revealed, unstable };
}

export function brewQuality(total) {
  if (total >= POTENT_TOTAL) {
    return "potent";
  }
  if (total >= SUCCESS_TOTAL) {
    return "normal";
  }
  return "flawed";
}

export function sideEffectCount(quality, unstable) {
  let count = 0;
  if (quality === "flawed") {
    count += 1;
  }
  if (unstable) {
    count += 1;
  }
  return count;
}

// A repeated die moves on to the next side effect, so the same one never comes twice.
export function drawSideEffects(count, dice) {
  const drawn = [];
  for (const die of dice.slice(0, count)) {
    let index = (die - 1) % SIDE_EFFECTS.length;
    while (drawn.includes(SIDE_EFFECTS[index])) {
      index = (index + 1) % SIDE_EFFECTS.length;
    }
    drawn.push(SIDE_EFFECTS[index]);
  }
  return drawn;
}

function takeOne(item, plan) {
  if (item.quantity <= 1) {
    plan.deleteItemIds.push(item.id);
  } else {
    plan.updateItems.push({ _id: item.id, "system.quantity": item.quantity - 1 });
  }
}

function emptyPlan() {
  return { deleteItemIds: [], updateItems: [] };
}

function shelfItem(items, index, itemId) {
  const item = shelf(items, index).find((entry) => entry.id === itemId && entry.quantity > 0);
  if (!item) {
    throw new LocalizedError("SODLALCHEMY.Errors.NotAnIngredient");
  }
  return item;
}

function findVial(items, index) {
  return items.find((item) => item.quantity > 0 && findIngredient(index, item)?.key === VIAL_KEY) ?? null;
}

// The ingredients are lost whatever comes out; the vial is only used when there is something to bottle.
export function planBrew({ itemIds, items, index, rules = BOOK_RULES }) {
  if (itemIds.length < MIN_INGREDIENTS || itemIds.length > MAX_INGREDIENTS) {
    throw new LocalizedError("SODLALCHEMY.Errors.BrewCount", { min: MIN_INGREDIENTS, max: MAX_INGREDIENTS });
  }
  const chosen = itemIds.map((itemId) => shelfItem(items, index, itemId));
  const keys = chosen.map((item) => item.ingredient.key);
  if (new Set(keys).size !== keys.length) {
    throw new LocalizedError("SODLALCHEMY.Errors.BrewDuplicate");
  }
  const vial = findVial(items, index);
  if (!vial) {
    throw new LocalizedError("SODLALCHEMY.Errors.NoVial");
  }
  const mixture = combine(chosen.map((item) => item.ingredient), rules);
  const plan = emptyPlan();
  for (const item of chosen) {
    takeOne(item, plan);
  }
  if (mixture.effects.length > 0) {
    takeOne(vial, plan);
  }
  return { ingredients: chosen, vial, mixture, plan };
}

export function learn(knowledge, revealed) {
  const next = { ...knowledge };
  const learned = [];
  for (const [ingredient, essences] of Object.entries(revealed)) {
    const known = next[ingredient] ?? [];
    const fresh = essences.filter((essence) => !known.includes(essence));
    next[ingredient] = [...known, ...fresh];
    learned.push(...fresh.map((essence) => ({ ingredient, essence })));
  }
  return { knowledge: next, learned };
}

function pairKey(first, second) {
  return [first, second].sort().join("|");
}

function pairsOf(keys) {
  const pairs = [];
  keys.forEach((first, index) => {
    for (const second of keys.slice(index + 1)) {
      pairs.push(pairKey(first, second));
    }
  });
  return pairs;
}

// Any essence two ingredients share shows in the brew, so two ingredients with nothing in common
// are proven to have no affinity: the notebook keeps them so the same failure is not tried again.
export function unboundPairs(ingredients) {
  const pairs = [];
  ingredients.forEach((first, index) => {
    for (const second of ingredients.slice(index + 1)) {
      if (!first.essences.some((essence) => second.essences.includes(essence))) {
        pairs.push(pairKey(first.key, second.key));
      }
    }
  });
  return pairs;
}

export function noteUnbound(known, pairs) {
  return [...known, ...pairs.filter((pair, index) => !known.includes(pair) && pairs.indexOf(pair) === index)];
}

export function isKnownInert(keys, unbound) {
  const pairs = pairsOf(keys);
  return pairs.length > 0 && pairs.every((pair) => unbound.includes(pair));
}

// Tasting, grinding and burning a sample uses it up and reveals one more of its essences.
export function planStudy({ itemId, items, index, knowledge }) {
  const item = shelfItem(items, index, itemId);
  const known = knowledge[item.ingredient.key] ?? [];
  const essence = item.ingredient.essences.find((entry) => !known.includes(entry));
  if (!essence) {
    throw new LocalizedError("SODLALCHEMY.Errors.NothingToLearn", { name: item.name });
  }
  const plan = emptyPlan();
  takeOne(item, plan);
  return { revealed: { [item.ingredient.key]: [essence] }, plan };
}

// A character who put exactly the ingredients of a recipe in the cauldron, nothing more, has found that recipe.
// The vial goes into every brew, so it completes a recipe but never reveals one on its own.
// How an item is matched to a recipe's ingredient is the trade module's rule, passed in.
export function rediscoveredRecipes(recipes, used, actorId, matchesIngredient) {
  const thrown = used.filter((item) => !item.container);
  return recipes
    .filter((recipe) => recipe.result && recipe.ingredients.length > 0 && !recipe.knownBy.includes(actorId))
    .filter((recipe) => recipe.ingredients.every((ingredient) => used.some((item) => matchesIngredient(item, ingredient))))
    .filter((recipe) => thrown.length > 0 && thrown.every((item) => recipe.ingredients.some((ingredient) => matchesIngredient(item, ingredient))))
    .map((recipe) => recipe.id);
}
