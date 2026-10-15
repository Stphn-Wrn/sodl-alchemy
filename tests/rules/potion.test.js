import { test } from "node:test";
import assert from "node:assert/strict";
import { describePotion, potionItemData } from "../../src/rules/potion.js";
import { t } from "../helpers/i18n.js";

test("une potion est nommée d'après ses effets et sa qualité, avec l'icône de son effet principal", () => {
  const brew = { effects: ["vitality", "purge"], quality: "potent", sideEffects: [] };

  const potion = describePotion(brew, t, "fr");

  assert.equal(potion.name, "Élixir puissant de vitalité et de purge");
  assert.equal(potion.img, "icons/consumables/potions/bottle-round-corked-red.webp");
});

test("la description donne l'effet de chaque essence selon la qualité, puis les effets secondaires", () => {
  const brew = { effects: ["vitality"], quality: "flawed", sideEffects: ["madness"] };

  const potion = describePotion(brew, t, "fr");

  assert.equal(potion.name, "Élixir trouble de vitalité");
  assert.ok(potion.description.includes(t("SODLALCHEMY.Essences.vitality.Normal")));
  assert.ok(!potion.description.includes(t("SODLALCHEMY.Essences.vitality.Potent")));
  assert.ok(potion.description.includes(t("SODLALCHEMY.SideEffects.madness")));
});

test("la potion devient un consommable de type potion du système, qui garde ce qu'elle contient", () => {
  const brew = { effects: ["venom"], quality: "normal", sideEffects: [] };

  const item = potionItemData(brew, t, "fr");

  assert.equal(item.name, "Élixir de venin");
  assert.equal(item.type, "item");
  assert.equal(item.system.quantity, 1);
  assert.equal(item.system.consumabletype, "P");
  assert.deepEqual(item.flags["sodl-alchemy"].potion, { effects: ["venom"], quality: "normal", sideEffects: [] });
});

test("une potion faite d'une essence créée par le MJ prend ses textes et son icône", () => {
  const brew = { effects: ["custom-frost"], quality: "potent", sideEffects: [] };
  const essences = [{ key: "custom-frost", name: "Givre", of: "de givre", normal: "Froid supportable.", potent: "Insensible au froid.", color: "#88ccff", icon: "frost.webp", opposite: "" }];

  const potion = describePotion(brew, t, "fr", essences);

  assert.equal(potion.name, "Élixir puissant de givre");
  assert.equal(potion.img, "frost.webp");
  assert.ok(potion.description.includes("Insensible au froid."));
});
