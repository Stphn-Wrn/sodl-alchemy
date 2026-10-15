import { LocalizedError } from "../i18n.js";
import { ESSENCES, oppositeOf } from "./alchemy.js";

// The GM's changes to the essences the module ships with: essences they created,
// the texts they rewrote, the ones they removed, and the ingredients they gave new essences.
export function emptyEssenceBook() {
  return { custom: [], edited: {}, removed: [], ingredients: {} };
}

// How each essence of the books looks: its colour in the window and the icon of the potions it leads.
export const BUILTIN_LOOKS = {
  vitality: { color: "#d9534f", icon: "icons/consumables/potions/bottle-round-corked-red.webp" },
  purge: { color: "#c9b458", icon: "icons/consumables/potions/potion-flask-corked-yellow.webp" },
  venom: { color: "#6dbb3c", icon: "icons/consumables/potions/bottle-conical-corked-labeled-skull-poison-green.webp" },
  vigil: { color: "#e0a040", icon: "icons/consumables/potions/bottle-round-corked-orange.webp" },
  cinder: { color: "#e0672a", icon: "icons/consumables/potions/potion-flask-corked-orange.webp" },
  shadow: { color: "#8a7bb8", icon: "icons/consumables/potions/bottle-bulb-corked-purple.webp" },
  stone: { color: "#8f969e", icon: "icons/consumables/potions/bottle-metal-yellow-gray.webp" },
  fury: { color: "#c0392b", icon: "icons/consumables/potions/flask-corked-red-glow.webp" },
  clarity: { color: "#6fa8d6", icon: "icons/consumables/potions/flask-corked-blue-glow.webp" },
  haste: { color: "#4fb8a8", icon: "icons/consumables/potions/bottle-conical-bubbling-blue.webp" },
  decay: { color: "#8a7a3a", icon: "icons/consumables/potions/potion-jug-corked-skull-poison-brown-green.webp" },
  dream: { color: "#b07cc6", icon: "icons/consumables/potions/bottle-round-flask-fumes-purple.webp" },
  abyss: { color: "#a3324e", icon: "icons/consumables/potions/flask-red-bubbles-vortex.webp" },
  ward: { color: "#b8b8c8", icon: "icons/consumables/potions/potion-bottle-corked-white.webp" }
};

const DEFAULT_LOOK = { color: "#b0a07a", icon: "icons/consumables/potions/bottle-round-corked-pink.webp" };

const EDITABLE_FIELDS = ["name", "of", "normal", "potent", "color", "icon", "opposite"];

// The essences of the books, in the language of the table.
export function builtinEssences(t) {
  return ESSENCES.map((key) => ({
    key,
    name: t(`SODLALCHEMY.Essences.${key}.Name`),
    of: t(`SODLALCHEMY.Essences.${key}.Of`),
    normal: t(`SODLALCHEMY.Essences.${key}.Normal`),
    potent: t(`SODLALCHEMY.Essences.${key}.Potent`),
    ...BUILTIN_LOOKS[key],
    opposite: oppositeOf(key) ?? ""
  }));
}

function withEdits(book, essence) {
  return { ...essence, ...(book.edited?.[essence.key] ?? {}), builtin: true };
}

export function resolveEssences(book, builtins) {
  const removed = book.removed ?? [];
  return [
    ...builtins.filter((essence) => !removed.includes(essence.key)).map((essence) => withEdits(book, essence)),
    ...(book.custom ?? []).map((essence) => ({ ...essence, builtin: false }))
  ];
}

export function removedEssences(book, builtins) {
  const removed = book.removed ?? [];
  return builtins.filter((essence) => removed.includes(essence.key)).map((essence) => withEdits(book, essence));
}

// Two essences are contrary when either one names the other.
export function oppositeIn(essences, key) {
  const own = essences.find((essence) => essence.key === key)?.opposite;
  if (own && essences.some((essence) => essence.key === own)) {
    return own;
  }
  return essences.find((essence) => essence.opposite === key)?.key ?? null;
}

// What brewing needs: the order effects are listed in, and the pairs that make a brew unstable.
export function essenceRules(essences) {
  const keys = essences.map((essence) => essence.key);
  const opposites = [];
  for (const essence of essences) {
    const other = essence.opposite;
    if (!other || !keys.includes(other)) {
      continue;
    }
    const known = opposites.some((pair) => pair.includes(essence.key) && pair.includes(other));
    if (!known) {
      opposites.push([essence.key, other]);
    }
  }
  return { order: keys, opposites };
}

function baseEssences(index, ingredientKey) {
  return index.find((ingredient) => ingredient.key === ingredientKey)?.essences ?? [];
}

function currentEssences(book, index, ingredientKey) {
  return book.ingredients?.[ingredientKey] ?? baseEssences(index, ingredientKey);
}

// The catalog's ingredients with the GM's changes; an essence no longer in the book is dropped.
export function applyBook(index, book, essences) {
  const keys = essences.map((essence) => essence.key);
  return index.map((ingredient) => ({
    ...ingredient,
    essences: currentEssences(book, index, ingredient.key).filter((essence) => keys.includes(essence))
  }));
}

function invalid() {
  return new LocalizedError("SODLALCHEMY.Errors.InvalidEssence");
}

function findEssence(book, builtins, key) {
  const custom = (book.custom ?? []).find((essence) => essence.key === key);
  if (custom) {
    return custom;
  }
  if (builtins.some((essence) => essence.key === key)) {
    return withEdits(book, builtins.find((essence) => essence.key === key));
  }
  throw invalid();
}

function cleanValue(field, value) {
  const text = String(value ?? "").trim();
  if (field === "name" && !text) {
    throw invalid();
  }
  return text;
}

function addEssence(book, { key, name }) {
  const essence = { key, name: cleanValue("name", name), of: "", normal: "", potent: "", ...DEFAULT_LOOK, opposite: "" };
  return { ...book, custom: [...(book.custom ?? []), essence] };
}

function updateEssence(book, { key, field, value }, { builtins }) {
  if (!EDITABLE_FIELDS.includes(field)) {
    throw invalid();
  }
  findEssence(book, builtins, key);
  const text = cleanValue(field, value);
  if (field === "opposite" && text === key) {
    throw invalid();
  }
  if (builtins.some((essence) => essence.key === key)) {
    return { ...book, edited: { ...(book.edited ?? {}), [key]: { ...(book.edited?.[key] ?? {}), [field]: text } } };
  }
  return { ...book, custom: book.custom.map((essence) => {
    if (essence.key === key) {
      return { ...essence, [field]: text };
    }
    return essence;
  }) };
}

function withoutEssenceInIngredients(ingredients, key) {
  const next = {};
  for (const [ingredient, essences] of Object.entries(ingredients ?? {})) {
    next[ingredient] = essences.filter((essence) => essence !== key);
  }
  return next;
}

// An essence of the books is only set aside, so it can come back; one the GM made is deleted.
function removeEssence(book, { key }, { builtins }) {
  findEssence(book, builtins, key);
  if (builtins.some((essence) => essence.key === key)) {
    return { ...book, removed: [...new Set([...(book.removed ?? []), key])] };
  }
  const custom = book.custom
    .filter((essence) => essence.key !== key)
    .map((essence) => {
      if (essence.opposite === key) {
        return { ...essence, opposite: "" };
      }
      return essence;
    });
  return { ...book, custom, ingredients: withoutEssenceInIngredients(book.ingredients, key) };
}

function restoreEssence(book, { key }) {
  return { ...book, removed: (book.removed ?? []).filter((entry) => entry !== key) };
}

function catalogIngredient(index, ingredientKey) {
  if (!index.some((ingredient) => ingredient.key === ingredientKey)) {
    throw invalid();
  }
}

function addIngredient(book, { key, ingredient }, { builtins, index }) {
  findEssence(book, builtins, key);
  catalogIngredient(index, ingredient);
  const essences = currentEssences(book, index, ingredient);
  if (essences.includes(key)) {
    return book;
  }
  return { ...book, ingredients: { ...(book.ingredients ?? {}), [ingredient]: [...essences, key] } };
}

function removeIngredient(book, { key, ingredient }, { index }) {
  catalogIngredient(index, ingredient);
  const essences = currentEssences(book, index, ingredient).filter((essence) => essence !== key);
  return { ...book, ingredients: { ...(book.ingredients ?? {}), [ingredient]: essences } };
}

function reset() {
  return emptyEssenceBook();
}

const ACTIONS = { addEssence, updateEssence, removeEssence, restoreEssence, addIngredient, removeIngredient, reset };

export function applyEssenceAction(book, action, context) {
  const strategy = ACTIONS[action.type];
  if (!strategy) {
    throw new LocalizedError("SODLTRADE.Errors.UnknownAction");
  }
  return strategy({ ...emptyEssenceBook(), ...book }, action, context);
}
