import { builtinEssences } from "./essence-book.js";

const POTION_TYPE = "P";

// A flawed brew still works as an ordinary one; its side effects are the price.
const STRENGTHS = { potent: "potent", normal: "normal", flawed: "normal" };

// An essence removed from the book since keeps its key as its name.
function essenceOf(essences, key) {
  return essences.find((essence) => essence.key === key) ?? { key, name: key, of: key, normal: "", potent: "", icon: "" };
}

function listItems(entries) {
  return `<ul>${entries.map((entry) => `<li>${entry}</li>`).join("")}</ul>`;
}

// The essences come from the GM's essence book; without one, from the books.
export function describePotion({ effects, quality, sideEffects }, t, lang, essences = builtinEssences(t)) {
  const used = effects.map((key) => essenceOf(essences, key));
  const list = new Intl.ListFormat(lang, { type: "conjunction" }).format(used.map((essence) => essence.of || essence.name));
  const strength = STRENGTHS[quality];
  const parts = [
    `<p><em>${t(`SODLALCHEMY.Quality.${quality}`)}</em></p>`,
    listItems(used.map((essence) => `<strong>${essence.name}</strong> : ${essence[strength]}`))
  ];
  if (sideEffects.length > 0) {
    parts.push(`<p><strong>${t("SODLALCHEMY.SideEffectsTitle")}</strong></p>`, listItems(sideEffects.map((effect) => t(`SODLALCHEMY.SideEffects.${effect}`))));
  }
  parts.push(`<p>${t("SODLALCHEMY.PotionUse")}</p>`);
  return {
    name: t(`SODLALCHEMY.Potion.${quality}`, { effects: list }),
    description: parts.join(""),
    img: used[0]?.icon
  };
}

export function potionItemData(brew, t, lang, essences = builtinEssences(t)) {
  const potion = describePotion(brew, t, lang, essences);
  return {
    name: potion.name,
    type: "item",
    img: potion.img,
    // Like the book's potions: an item whose consumable type is "Potion", drunk from the sheet.
    system: { description: potion.description, quantity: 1, consumabletype: POTION_TYPE },
    flags: { "sodl-alchemy": { potion: { effects: brew.effects, quality: brew.quality, sideEffects: brew.sideEffects } } }
  };
}
