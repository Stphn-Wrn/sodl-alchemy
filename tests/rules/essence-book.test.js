import { test } from "node:test";
import assert from "node:assert/strict";
import { applyBook, applyEssenceAction, emptyEssenceBook, essenceRules, oppositeIn, removedEssences, resolveEssences } from "../../src/rules/essence-book.js";

function builtin(key, opposite = "") {
  return { key, name: key, of: `de ${key}`, normal: `${key} normal`, potent: `${key} puissant`, color: "#111111", icon: `${key}.webp`, opposite };
}

function gm(book, action, context) {
  return applyEssenceAction(book, action, context);
}

test("sans rien changer, les essences sont celles des livres du module", () => {
  const builtins = [builtin("vitality", "decay"), builtin("decay", "vitality")];

  const essences = resolveEssences(emptyEssenceBook(), builtins);

  assert.deepEqual(essences.map((essence) => [essence.key, essence.builtin]), [["vitality", true], ["decay", true]]);
});

test("le MJ crée une essence, lui donne ses textes, sa couleur et son contraire", () => {
  const builtins = [builtin("vitality")];
  const context = { builtins, index: [] };
  let book = gm(emptyEssenceBook(), { type: "addEssence", key: "custom-frost", name: " Givre " }, context);
  book = gm(book, { type: "updateEssence", key: "custom-frost", field: "normal", value: "Le buveur ne craint pas le froid." }, context);
  book = gm(book, { type: "updateEssence", key: "custom-frost", field: "color", value: "#88ccff" }, context);
  book = gm(book, { type: "updateEssence", key: "custom-frost", field: "opposite", value: "vitality" }, context);

  const frost = resolveEssences(book, builtins).find((essence) => essence.key === "custom-frost");

  assert.equal(frost.name, "Givre");
  assert.equal(frost.normal, "Le buveur ne craint pas le froid.");
  assert.equal(frost.color, "#88ccff");
  assert.equal(frost.builtin, false);
  assert.equal(oppositeIn(resolveEssences(book, builtins), "vitality"), "custom-frost");
});

test("une essence ne peut ni s'opposer à elle-même, ni recevoir un champ inconnu, ni avoir un nom vide", () => {
  const context = { builtins: [builtin("vitality")], index: [] };

  assert.throws(() => gm(emptyEssenceBook(), { type: "updateEssence", key: "vitality", field: "opposite", value: "vitality" }, context), { message: "SODLALCHEMY.Errors.InvalidEssence" });
  assert.throws(() => gm(emptyEssenceBook(), { type: "updateEssence", key: "vitality", field: "hack", value: "x" }, context), { message: "SODLALCHEMY.Errors.InvalidEssence" });
  assert.throws(() => gm(emptyEssenceBook(), { type: "updateEssence", key: "vitality", field: "name", value: "  " }, context), { message: "SODLALCHEMY.Errors.InvalidEssence" });
  assert.throws(() => gm(emptyEssenceBook(), { type: "updateEssence", key: "ghost", field: "name", value: "Fantôme" }, context), { message: "SODLALCHEMY.Errors.InvalidEssence" });
});

test("le MJ réécrit une essence des livres sans toucher aux autres", () => {
  const builtins = [builtin("vitality"), builtin("purge")];
  const book = gm(emptyEssenceBook(), { type: "updateEssence", key: "vitality", field: "name", value: "Sève" }, { builtins, index: [] });

  const essences = resolveEssences(book, builtins);

  assert.deepEqual(essences.map((essence) => essence.name), ["Sève", "purge"]);
  assert.equal(essences[0].normal, "vitality normal");
});

test("une essence des livres retirée disparaît des ingrédients et peut être remise ; une essence créée est supprimée pour de bon", () => {
  const builtins = [builtin("vitality"), builtin("purge")];
  const index = [{ key: "herbs", names: ["herbes"], essences: ["vitality", "purge"] }];
  const context = { builtins, index };
  let book = gm(emptyEssenceBook(), { type: "addEssence", key: "custom-frost", name: "Givre" }, context);
  book = gm(book, { type: "addIngredient", key: "custom-frost", ingredient: "herbs" }, context);
  book = gm(book, { type: "removeEssence", key: "vitality" }, context);
  book = gm(book, { type: "removeEssence", key: "custom-frost" }, context);

  const essences = resolveEssences(book, builtins);

  assert.deepEqual(essences.map((essence) => essence.key), ["purge"]);
  assert.deepEqual(removedEssences(book, builtins).map((essence) => essence.key), ["vitality"]);
  assert.deepEqual(applyBook(index, book, essences)[0].essences, ["purge"]);

  book = gm(book, { type: "restoreEssence", key: "vitality" }, context);
  assert.deepEqual(applyBook(index, book, resolveEssences(book, builtins))[0].essences, ["vitality", "purge"]);
});

test("le MJ donne une essence à un ingrédient ou la lui retire", () => {
  const builtins = [builtin("vitality"), builtin("purge")];
  const index = [{ key: "herbs", names: ["herbes"], essences: ["vitality"] }, { key: "root", names: ["racine"], essences: ["purge"] }];
  const context = { builtins, index };
  let book = gm(emptyEssenceBook(), { type: "addIngredient", key: "purge", ingredient: "herbs" }, context);
  book = gm(book, { type: "addIngredient", key: "purge", ingredient: "herbs" }, context);
  book = gm(book, { type: "removeIngredient", key: "purge", ingredient: "root" }, context);

  const ingredients = applyBook(index, book, resolveEssences(book, builtins));

  assert.deepEqual(ingredients.map((ingredient) => ingredient.essences), [["vitality", "purge"], []]);
});

test("on ne donne pas une essence à un ingrédient qui n'est pas au catalogue", () => {
  const context = { builtins: [builtin("vitality")], index: [] };

  assert.throws(() => gm(emptyEssenceBook(), { type: "addIngredient", key: "vitality", ingredient: "ghost" }, context), { message: "SODLALCHEMY.Errors.InvalidEssence" });
});

test("les paires d'essences contraires ne gardent que les essences encore présentes", () => {
  const builtins = [builtin("vitality", "decay"), builtin("decay", "vitality"), builtin("purge", "venom"), builtin("venom", "purge")];
  const book = gm(emptyEssenceBook(), { type: "removeEssence", key: "venom" }, { builtins, index: [] });

  const rules = essenceRules(resolveEssences(book, builtins));

  assert.deepEqual(rules.order, ["vitality", "decay", "purge"]);
  assert.deepEqual(rules.opposites, [["vitality", "decay"]]);
});

test("tout remettre comme dans les livres efface les changements du MJ", () => {
  const context = { builtins: [builtin("vitality")], index: [] };
  const book = gm(emptyEssenceBook(), { type: "removeEssence", key: "vitality" }, context);

  assert.deepEqual(gm(book, { type: "reset" }, context), emptyEssenceBook());
});
