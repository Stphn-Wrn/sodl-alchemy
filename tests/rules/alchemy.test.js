import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ESSENCES, brewQuality, characterAlchemy, combine, noteSuccess, drawSideEffects, ingredientIndex, isKnownInert, learn, noteUnbound, planBrew, planStudy, rediscoveredRecipes, shelf, unboundPairs } from "../../src/rules/alchemy.js";

// A catalog of the given resources, each hiding the essences it lists.
function indexOf(items) {
  const catalog = { folders: [{ key: "plants", items }] };
  return ingredientIndex(catalog, Object.fromEntries(items.map((item) => [item.key, item.essences ?? []])));
}

// The trade module matches an item to a recipe's ingredient by name, among other things.
function byName(item, ingredient) {
  return item.name === ingredient.name;
}

test("une essence partagée par deux ingrédients se manifeste et se révèle sur les deux", () => {
  const ingredients = [
    { key: "root", essences: ["purge", "vigil"] },
    { key: "gland", essences: ["venom", "purge"] }
  ];

  const mixture = combine(ingredients);

  assert.deepEqual(mixture, { effects: ["purge"], revealed: { root: ["purge"], gland: ["purge"] }, unstable: false });
});

test("une essence portée par un seul ingrédient reste cachée, et sans rien en commun la mixture est inerte", () => {
  const ingredients = [
    { key: "root", essences: ["purge"] },
    { key: "moss", essences: ["shadow"] }
  ];

  const mixture = combine(ingredients);

  assert.deepEqual(mixture, { effects: [], revealed: {}, unstable: false });
});

test("les effets les plus partagés viennent en premier", () => {
  const ingredients = [
    { key: "a", essences: ["shadow", "venom"] },
    { key: "b", essences: ["venom", "shadow"] },
    { key: "c", essences: ["venom"] }
  ];

  const mixture = combine(ingredients);

  assert.deepEqual(mixture.effects, ["venom", "shadow"]);
});

test("deux essences opposées dans la même mixture la rendent instable", () => {
  const ingredients = [
    { key: "a", essences: ["vitality", "decay"] },
    { key: "b", essences: ["vitality", "decay"] }
  ];

  const mixture = combine(ingredients);

  assert.equal(mixture.unstable, true);
});

test("le jet d'Intellect fixe la qualité : 20 et plus puissante, 10 et plus normale, sinon altérée", () => {
  const totals = [25, 20, 19, 10, 9, 1];

  const qualities = totals.map(brewQuality);

  assert.deepEqual(qualities, ["potent", "potent", "normal", "normal", "flawed", "flawed"]);
});

test("les effets secondaires sont tirés au d6 sans doublon", () => {
  const dice = [3, 3];

  const sideEffects = drawSideEffects(2, dice);

  assert.deepEqual(sideEffects, ["nausea", "eruption"]);
});

test("aucun effet secondaire n'est tiré quand il n'y en a pas à tirer", () => {
  const dice = [];

  const sideEffects = drawSideEffects(0, dice);

  assert.deepEqual(sideEffects, []);
});

test("un objet est reconnu comme ingrédient par sa clé de ressource, ou par son nom en français comme en anglais", () => {
  const index = indexOf([
    { key: "bitter-root", name: { fr: "Racine amère", en: "Bitter root" }, essences: ["purge", "vigil"] },
    { key: "hardwood", name: { fr: "Bois dur", en: "Hardwood" } }
  ]);
  const items = [
    { id: "1", name: "Ma racine", resourceKey: "bitter-root", quantity: 2 },
    { id: "2", name: "racine amere", resourceKey: null, quantity: 1 },
    { id: "3", name: "Bitter Root", resourceKey: null, quantity: 1 },
    { id: "4", name: "Bois dur", resourceKey: "hardwood", quantity: 1 },
    { id: "5", name: "Épée", resourceKey: null, quantity: 1 }
  ];

  const found = shelf(items, index).map((item) => [item.id, item.ingredient.key]);

  assert.deepEqual(found, [["1", "bitter-root"], ["2", "bitter-root"], ["3", "bitter-root"]]);
});

test("brasser consomme un exemplaire de chaque ingrédient et une fiole vide", () => {
  const index = indexOf([
    { key: "bitter-root", name: { fr: "Racine amère", en: "Bitter root" }, essences: ["purge", "vigil"] },
    { key: "venom-gland", name: { fr: "Glande à venin", en: "Venom gland" }, essences: ["venom", "purge"] },
    { key: "empty-vial", name: { fr: "Fiole vide", en: "Empty vial" } }
  ]);
  const items = [
    { id: "root", name: "Racine amère", resourceKey: "bitter-root", quantity: 3 },
    { id: "gland", name: "Glande à venin", resourceKey: "venom-gland", quantity: 1 },
    { id: "vial", name: "Fiole vide", resourceKey: "empty-vial", quantity: 2 }
  ];

  const brew = planBrew({ itemIds: ["root", "gland"], items, index });

  assert.deepEqual(brew.mixture.effects, ["purge"]);
  assert.deepEqual(brew.plan, { deleteItemIds: ["gland"], updateItems: [{ _id: "root", "system.quantity": 2 }, { _id: "vial", "system.quantity": 1 }] });
});

test("une mixture inerte perd ses ingrédients mais garde la fiole", () => {
  const index = indexOf([
    { key: "root", name: { fr: "Racine", en: "Root" }, essences: ["purge"] },
    { key: "moss", name: { fr: "Mousse", en: "Moss" }, essences: ["shadow"] },
    { key: "empty-vial", name: { fr: "Fiole vide", en: "Empty vial" } }
  ]);
  const items = [
    { id: "root", name: "Racine", resourceKey: "root", quantity: 1 },
    { id: "moss", name: "Mousse", resourceKey: "moss", quantity: 1 },
    { id: "vial", name: "Fiole vide", resourceKey: "empty-vial", quantity: 1 }
  ];

  const brew = planBrew({ itemIds: ["root", "moss"], items, index });

  assert.deepEqual(brew.plan, { deleteItemIds: ["root", "moss"], updateItems: [] });
});

test("il faut entre deux et quatre ingrédients différents et une fiole vide pour brasser", () => {
  const index = indexOf([
    { key: "root", name: { fr: "Racine", en: "Root" }, essences: ["purge"] },
    { key: "moss", name: { fr: "Mousse", en: "Moss" }, essences: ["purge"] },
    { key: "empty-vial", name: { fr: "Fiole vide", en: "Empty vial" } }
  ]);
  const withVial = [
    { id: "root", name: "Racine", resourceKey: "root", quantity: 2 },
    { id: "root2", name: "Racine", resourceKey: "root", quantity: 1 },
    { id: "moss", name: "Mousse", resourceKey: "moss", quantity: 1 },
    { id: "vial", name: "Fiole vide", resourceKey: "empty-vial", quantity: 1 }
  ];
  const withoutVial = withVial.filter((item) => item.id !== "vial");

  assert.throws(() => planBrew({ itemIds: ["root"], items: withVial, index }), { message: "SODLALCHEMY.Errors.BrewCount" });
  assert.throws(() => planBrew({ itemIds: ["root", "root2"], items: withVial, index }), { message: "SODLALCHEMY.Errors.BrewDuplicate" });
  assert.throws(() => planBrew({ itemIds: ["root", "vial"], items: withVial, index }), { message: "SODLALCHEMY.Errors.NotAnIngredient" });
  assert.throws(() => planBrew({ itemIds: ["root", "moss"], items: withoutVial, index }), { message: "SODLALCHEMY.Errors.NoVial" });
});

test("le carnet retient les essences révélées et dit lesquelles sont nouvelles", () => {
  const knowledge = { root: ["purge"] };
  const revealed = { root: ["purge", "vigil"], gland: ["purge"] };

  const result = learn(knowledge, revealed);

  assert.deepEqual(result, {
    knowledge: { root: ["purge", "vigil"], gland: ["purge"] },
    learned: [{ ingredient: "root", essence: "vigil" }, { ingredient: "gland", essence: "purge" }]
  });
});

test("étudier un ingrédient en consomme un et révèle sa première essence encore inconnue", () => {
  const index = indexOf([
    { key: "root", name: { fr: "Racine", en: "Root" }, essences: ["purge", "vigil", "stone"] }
  ]);
  const items = [{ id: "root", name: "Racine", resourceKey: "root", quantity: 1 }];

  const study = planStudy({ itemId: "root", items, index, knowledge: { root: ["purge"] } });

  assert.deepEqual(study, { revealed: { root: ["vigil"] }, plan: { deleteItemIds: ["root"], updateItems: [] } });
});

test("un ingrédient dont tout est connu n'a plus rien à apprendre", () => {
  const index = indexOf([
    { key: "root", name: { fr: "Racine", en: "Root" }, essences: ["purge"] }
  ]);
  const items = [{ id: "root", name: "Racine", resourceKey: "root", quantity: 1 }];

  assert.throws(() => planStudy({ itemId: "root", items, index, knowledge: { root: ["purge"] } }), { message: "SODLALCHEMY.Errors.NothingToLearn" });
});

test("retrouver tous les ingrédients d'une recette, fiole comprise, l'ajoute au grimoire du personnage", () => {
  const recipes = [
    { id: "antitoxin", knownBy: [], result: { name: "Anti-toxine" }, ingredients: [{ name: "Racine amère", sourceUuid: null }, { name: "Glande à venin", sourceUuid: null }, { name: "Fiole vide", sourceUuid: null }] },
    { id: "healing", knownBy: [], result: { name: "Soins" }, ingredients: [{ name: "Herbes médicinales", sourceUuid: null }, { name: "Fiole vide", sourceUuid: null }] },
    { id: "known", knownBy: ["hero"], result: { name: "Déjà" }, ingredients: [{ name: "Racine amère", sourceUuid: null }] },
    { id: "torch", knownBy: [], result: { name: "Torche" }, ingredients: [] }
  ];
  const used = [{ name: "Racine amère", sourceUuids: [] }, { name: "Glande à venin", sourceUuids: [] }, { name: "Fiole vide", sourceUuids: [] }];

  const found = rediscoveredRecipes(recipes, used, "hero", byName);

  assert.deepEqual(found, ["antitoxin"]);
});

test("chaque ingrédient du catalogue cache 2 à 4 essences connues, et chaque essence peut se découvrir", () => {
  const { essences: byResource } = JSON.parse(readFileSync(new URL("../../data/essences.json", import.meta.url), "utf8"));

  const ingredients = Object.values(byResource);

  assert.ok(ingredients.every((essences) => essences.length >= 2 && essences.length <= 4));
  assert.ok(ingredients.every((essences) => essences.every((essence) => ESSENCES.includes(essence))));
  assert.ok(ESSENCES.every((essence) => ingredients.filter((essences) => essences.includes(essence)).length >= 4));
});

test("deux ingrédients qui n'ont aucune essence en commun sont notés sans affinité, même dans une potion réussie", () => {
  const ingredients = [
    { key: "root", essences: ["purge", "vigil"] },
    { key: "gland", essences: ["venom", "purge"] },
    { key: "moss", essences: ["shadow", "decay"] }
  ];

  const pairs = unboundPairs(ingredients);

  assert.deepEqual(pairs, ["moss|root", "gland|moss"]);
});

test("le carnet ajoute les paires sans affinité sans doublon", () => {
  const known = ["moss|root"];

  const merged = noteUnbound(known, ["moss|root", "gland|moss"]);

  assert.deepEqual(merged, ["moss|root", "gland|moss"]);
});

test("un mélange dont toutes les paires sont sans affinité est connu pour rester inerte", () => {
  const unbound = ["moss|root", "gland|moss", "gland|root"];

  const known = [isKnownInert(["root", "moss"], unbound), isKnownInert(["root", "gland", "moss"], unbound), isKnownInert(["root", "ash"], unbound)];

  assert.deepEqual(known, [true, true, false]);
});

test("le carnet d'alchimie se lit sur la fiche du personnage, et reprend à défaut celui qu'y avait laissé le module d'échanges", () => {
  const onSheet = { journal: { "bitter-root": ["purge"] }, unbound: ["a|b"], successes: [{ keys: ["a", "c"], effects: ["vigil"] }], report: { id: "r1", kind: "study" } };
  const earlier = { journal: { "bat-wing": ["shadow"] }, unbound: ["c|d"], report: { id: "old", kind: "brew" } };

  assert.deepEqual(characterAlchemy(onSheet, earlier), onSheet);
  assert.deepEqual(characterAlchemy(undefined, earlier), { journal: { "bat-wing": ["shadow"] }, unbound: ["c|d"], successes: [], report: { id: "old", kind: "brew" } });
  assert.deepEqual(characterAlchemy(undefined, undefined), { journal: {}, unbound: [], successes: [], report: null });
});

test("un mélange réussi est noté avec ses ingrédients et ses essences, une seule fois quel que soit l'ordre des ingrédients", () => {
  const first = noteSuccess([], ["bitter-root", "bat-wing"], ["vigil"]);
  const again = noteSuccess(first, ["bat-wing", "bitter-root"], ["vigil"]);
  const other = noteSuccess(again, ["healing-herbs", "venom-gland"], ["purge"]);

  assert.deepEqual(first, [{ keys: ["bat-wing", "bitter-root"], effects: ["vigil"] }]);
  assert.deepEqual(again, first);
  assert.deepEqual(other, [{ keys: ["bat-wing", "bitter-root"], effects: ["vigil"] }, { keys: ["healing-herbs", "venom-gland"], effects: ["purge"] }]);
});

test("la fiole seule ne fait retrouver aucune recette : il faut au moins un vrai ingrédient jeté au chaudron", () => {
  const recipes = [
    { id: "strength", knownBy: [], result: { name: "Potion de force" }, ingredients: [{ name: "Fiole vide", sourceUuid: null }] },
    { id: "antitoxin", knownBy: [], result: { name: "Anti-toxine" }, ingredients: [{ name: "Racine amère", sourceUuid: null }, { name: "Glande à venin", sourceUuid: null }, { name: "Fiole vide", sourceUuid: null }] }
  ];
  const used = [{ name: "Racine amère", sourceUuids: [] }, { name: "Glande à venin", sourceUuids: [] }, { name: "Fiole vide", sourceUuids: [], container: true }];

  const found = rediscoveredRecipes(recipes, used, "hero", byName);

  assert.deepEqual(found, ["antitoxin"]);
});

test("un ingrédient de trop dans le chaudron, et la recette n'est pas retrouvée : ce n'est pas elle qu'on a préparée", () => {
  const recipes = [
    { id: "spirits", knownBy: [], result: { name: "Alcool distillé" }, ingredients: [{ name: "Racine amère", sourceUuid: null }, { name: "Fiole vide", sourceUuid: null }] }
  ];
  const used = [{ name: "Racine amère", sourceUuids: [] }, { name: "Glande à venin", sourceUuids: [] }, { name: "Soufre", sourceUuids: [] }, { name: "Fiole vide", sourceUuids: [], container: true }];

  const found = rediscoveredRecipes(recipes, used, "hero", byName);

  assert.deepEqual(found, []);
});

test("le brassage suit les essences et les contraires du livre du MJ", () => {
  const ingredients = [
    { key: "ice", essences: ["custom-frost", "custom-ember"] },
    { key: "coal", essences: ["custom-frost", "custom-ember"] }
  ];
  const rules = { order: ["custom-ember", "custom-frost"], opposites: [["custom-frost", "custom-ember"]] };

  const mixture = combine(ingredients, rules);

  assert.deepEqual(mixture.effects, ["custom-ember", "custom-frost"]);
  assert.equal(mixture.unstable, true);
});
