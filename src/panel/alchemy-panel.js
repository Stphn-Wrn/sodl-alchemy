import { ALCHEMY_REQUEST, ENABLED_SETTING, ESSENCE_REQUEST, MODULE_ID, modulePath } from "../constants.js";
import { MAX_INGREDIENTS, MIN_INGREDIENTS, VIAL_KEY, combine, findIngredient, isKnownInert, shelf } from "../rules/alchemy.js";
import { oppositeIn } from "../rules/essence-book.js";
import { describePotion } from "../rules/potion.js";
import { readCharacterAlchemy } from "../store/alchemy-store.js";
import { loadEssences } from "../store/essence-store.js";
import { t, tradeApi } from "../trade-api.js";

const PLAYER_STEPS = 5;
const GM_STEPS = 3;
// Two filters besides the essences: every ingredient, and those that still hide something.
const ALL = "all";
const UNEXPLORED = "unexplored";

function sendAlchemy(action) {
  tradeApi().sendRequest(ALCHEMY_REQUEST, { action });
}

function sendEssences(action) {
  tradeApi().sendRequest(ESSENCE_REQUEST, { action });
}

// The essences in play, read from the GM's essence book when the window is drawn.
// An essence removed since a brew keeps its key as its name, in a neutral colour.
function essenceOf(app, key) {
  return app.alchemyEssences.find((essence) => essence.key === key) ?? { key, name: key, color: "" };
}

function essenceName(app, key) {
  return essenceOf(app, key).name;
}

function chip(app, key) {
  const essence = essenceOf(app, key);
  return { key, name: essence.name, color: essence.color };
}

function helpSteps(isGM) {
  let role = "Player";
  let count = PLAYER_STEPS;
  if (isGM) {
    role = "Gm";
    count = GM_STEPS;
  }
  const steps = Array.from({ length: count }, (value, index) => t(`SODLALCHEMY.Help.${role}.Step${index + 1}`));
  let example = "";
  if (!isGM) {
    example = t("SODLALCHEMY.Help.Player.Example");
  }
  return { lead: t(`SODLALCHEMY.Help.${role}.Lead`), example, steps };
}

// The player filters by the essences they have found, so they see at once which ingredients go together.
function filterView(app, knowledge, active) {
  const found = app.alchemyEssences.map((essence) => essence.key).filter((essence) => Object.values(knowledge).some((essences) => essences.includes(essence)));
  return [
    { key: ALL, label: t("SODLALCHEMY.Filter.All"), essence: false, active: active === ALL },
    { key: UNEXPLORED, label: t("SODLALCHEMY.Filter.Unexplored"), essence: false, active: active === UNEXPLORED },
    ...found.map((essence) => ({ key: essence, label: essenceName(app, essence), color: essenceOf(app, essence).color, essence: true, active: active === essence }))
  ];
}

// Filtering only hides what is drawn, so the shelf does not flicker or lose its scroll.
function applyEssenceFilter(panel, filter) {
  let shown = 0;
  for (const entry of panel.querySelectorAll("[data-alchemy-ingredient]")) {
    let visible = true;
    if (filter === UNEXPLORED) {
      visible = entry.dataset.unexplored === "1";
    } else if (filter !== ALL) {
      visible = entry.dataset.knownEssences.split(",").includes(filter);
    }
    entry.hidden = !visible;
    if (visible) {
      shown += 1;
    }
  }
  for (const button of panel.querySelectorAll("[data-alchemy-filter]")) {
    button.classList.toggle("is-active", button.dataset.alchemyFilter === filter);
  }
  const noMatch = panel.querySelector("[data-alchemy-no-match]");
  if (noMatch) {
    noMatch.hidden = shown > 0;
  }
}

// Display names of every catalog resource, in the language of the table.
function catalogNames(catalog) {
  const names = {};
  for (const resource of catalog.folders.flatMap((folder) => folder.items)) {
    names[resource.key] = tradeApi().localizedName(resource.name, game.i18n.lang);
  }
  return names;
}

// The player only sees the essences their character has found; the others are question marks.
function essenceChips(app, ingredient, known) {
  return ingredient.essences.map((essence) => {
    if (known.includes(essence)) {
      return { known: true, ...chip(app, essence) };
    }
    return { known: false };
  });
}

function shelfView(app, items, knowledge) {
  return items.map((item) => {
    const known = knowledge[item.ingredient.key] ?? [];
    return {
      id: item.id,
      name: item.name,
      img: item.img,
      quantity: item.quantity,
      ingredientKey: item.ingredient.key,
      known: known.join(","),
      essences: essenceChips(app, item.ingredient, known),
      canStudy: item.ingredient.essences.some((essence) => !known.includes(essence))
    };
  });
}

// What the character can foresee from their notebook: the essences they know the ingredients share,
// or that these ingredients were already found to have nothing in common.
function foreseen(app, chosen, unbound) {
  if (chosen.length < MIN_INGREDIENTS) {
    return { text: t("SODLALCHEMY.SlotHint"), tone: "is-hint" };
  }
  const mixture = combine(chosen.map((entry) => ({ key: entry.dataset.ingredientKey, essences: entry.dataset.known.split(",").filter(Boolean) })), app.alchemyRules);
  if (mixture.effects.length > 0) {
    return { text: t("SODLALCHEMY.Foreseen", { essences: mixture.effects.map((essence) => essenceName(app, essence)).join(", ") }), tone: "" };
  }
  if (isKnownInert(chosen.map((entry) => entry.dataset.ingredientKey), unbound)) {
    return { text: t("SODLALCHEMY.KnownInert"), tone: "is-warning" };
  }
  return { text: t("SODLALCHEMY.ForeseenNone"), tone: "" };
}

// The potion a mix gives, as an ordinary brew: the roll only makes it potent or cloudy.
function potionOf(app, effects) {
  const potion = describePotion({ effects, quality: "normal", sideEffects: [] }, t, game.i18n.lang, app.alchemyEssences);
  const lines = effects.map((key) => {
    const essence = essenceOf(app, key);
    return `${essence.name} : ${essence.normal ?? ""}`;
  });
  return { name: potion.name, img: potion.img, effects: lines.join("\n") };
}

// The mixes that worked, what they give, and whether the character still has every ingredient to brew it again.
function successView(app, successes, names, items) {
  return successes.map((entry) => {
    const itemIds = entry.keys.map((key) => items.find((item) => item.ingredient.key === key)?.id);
    let ready = "";
    if (itemIds.every(Boolean)) {
      ready = itemIds.join(",");
    }
    return {
      ingredients: entry.keys.map((key) => names[key] ?? key).join(" + "),
      essences: entry.effects.map((essence) => chip(app, essence)),
      potion: potionOf(app, entry.effects),
      ready
    };
  });
}

function pairNames(pair, names) {
  const [first, second] = pair.split("|");
  return { first: names[first] ?? first, second: names[second] ?? second };
}

function fillSlot(slot, entry) {
  slot.replaceChildren();
  slot.disabled = !entry;
  slot.classList.toggle("is-filled", Boolean(entry));
  if (!entry) {
    slot.removeAttribute("title");
    return;
  }
  const img = document.createElement("img");
  img.src = entry.dataset.img;
  img.alt = "";
  img.dataset.craftIngredient = "";
  slot.append(img);
  slot.dataset.itemId = entry.dataset.alchemyAdd;
  slot.title = `${t("SODLALCHEMY.Remove")} : ${entry.dataset.name}`;
}

// The cauldron is filled on the page itself: throwing an ingredient in or taking it out
// never renders the window again, so it answers at once.
function refreshTable(app, panel) {
  const table = panel.querySelector("[data-alchemy-table]");
  if (!table) {
    return;
  }
  const entries = [...panel.querySelectorAll("[data-alchemy-add]")];
  app.alchemySelection = app.alchemySelection.filter((itemId) => entries.some((entry) => entry.dataset.alchemyAdd === itemId));
  const chosen = app.alchemySelection.map((itemId) => entries.find((entry) => entry.dataset.alchemyAdd === itemId));
  for (const entry of entries) {
    entry.closest("[data-alchemy-ingredient]").classList.toggle("is-chosen", app.alchemySelection.includes(entry.dataset.alchemyAdd));
  }
  panel.querySelectorAll("[data-alchemy-slot]").forEach((slot, index) => fillSlot(slot, chosen[index]));
  const canBrew = chosen.length >= MIN_INGREDIENTS && Number(table.dataset.vials) > 0;
  table.classList.toggle("is-ready", canBrew);
  panel.querySelector("[data-action=alchemyBrew]").disabled = !canBrew;
  const hint = panel.querySelector("[data-alchemy-hint]");
  const { text, tone } = foreseen(app, chosen, table.dataset.unbound.split(",").filter(Boolean));
  hint.textContent = text;
  hint.classList.toggle("is-hint", tone === "is-hint");
  hint.classList.toggle("is-warning", tone === "is-warning");
}

function toggleIngredient(app, itemId) {
  if (app.alchemySelection.includes(itemId)) {
    app.alchemySelection = app.alchemySelection.filter((id) => id !== itemId);
    return;
  }
  if (app.alchemySelection.length < MAX_INGREDIENTS) {
    app.alchemySelection = [...app.alchemySelection, itemId];
  }
}

function opposesText(essences, essence) {
  const opposite = oppositeIn(essences, essence.key);
  if (!opposite) {
    return "";
  }
  return t("SODLALCHEMY.Opposes", { essence: essences.find((entry) => entry.key === opposite).name });
}

function ingredientsWith(index, names, key) {
  return index
    .filter((ingredient) => ingredient.essences.includes(key))
    .map((ingredient) => ({ key: ingredient.key, name: names[ingredient.key] ?? ingredient.key }))
    .sort((first, second) => first.name.localeCompare(second.name));
}

// The ingredients the GM can give an essence to, grouped like the catalog; the vial only holds the brew.
function addableIngredients(catalog, index, names, key) {
  return catalog.folders
    .map((folder) => ({
      label: tradeApi().localizedName(folder.name, game.i18n.lang),
      ingredients: folder.items
        .filter((resource) => resource.key !== VIAL_KEY)
        .filter((resource) => !index.find((ingredient) => ingredient.key === resource.key)?.essences.includes(key))
        .map((resource) => ({ key: resource.key, name: names[resource.key] ?? resource.key }))
        .sort((first, second) => first.name.localeCompare(second.name))
    }))
    .filter((group) => group.ingredients.length > 0);
}

// While editing, one essence at a time unfolds into its form; the others stay one line each.
function codexView({ catalog, essences, removed, index }, names, editing, openKey) {
  const entries = essences.map((essence) => {
    const entry = {
      ...essence,
      open: editing && essence.key === openKey,
      opposes: opposesText(essences, essence),
      ingredients: ingredientsWith(index, names, essence.key)
    };
    if (entry.open) {
      const opposite = oppositeIn(essences, essence.key);
      entry.oppositeChoices = essences
        .filter((other) => other.key !== essence.key)
        .map((other) => ({ key: other.key, name: other.name, selected: other.key === opposite }));
      entry.addable = addableIngredients(catalog, index, names, essence.key);
    }
    return entry;
  });
  return { editing, entries, removed: removed.map((essence) => ({ key: essence.key, name: essence.name, color: essence.color })) };
}

function reportView(app, report, names, dismissedId) {
  if (!report || report.id === dismissedId) {
    return null;
  }
  const learned = report.learned.map((entry) => t("SODLALCHEMY.Learned", { ingredient: names[entry.ingredient] ?? entry.ingredient, essence: essenceName(app, entry.essence) }));
  let title = t("SODLALCHEMY.LastBrew");
  if (report.kind === "study") {
    title = t("SODLALCHEMY.Studied", { name: report.name });
  }
  let outcome = "";
  if (report.kind === "brew" && report.potion) {
    outcome = t("SODLALCHEMY.Made", { name: report.potion.name });
  } else if (report.kind === "brew") {
    outcome = t("SODLALCHEMY.Inert");
  }
  return {
    id: report.id,
    title,
    outcome,
    img: report.potion?.img ?? "",
    sideEffects: (report.potion?.sideEffects ?? []).map((effect) => t(`SODLALCHEMY.SideEffects.${effect}`)),
    learned,
    unbound: (report.unbound ?? []).map((pair) => t("SODLALCHEMY.UnboundNoted", pairNames(pair, names))),
    recipes: (report.recipes ?? []).map((name) => t("SODLALCHEMY.RecipesFound", { names: name }))
  };
}

function vialCount(actor, index) {
  return tradeApi().toResourceInventory(actor)
    .filter((item) => findIngredient(index, item)?.key === VIAL_KEY)
    .reduce((total, item) => total + item.quantity, 0);
}

export const alchemyPanel = {
  id: "alchemy",
  template: modulePath("src/panel/alchemy-panel.html"),

  label() {
    return t("SODLALCHEMY.Tab");
  },

  enabled() {
    return game.settings.get(MODULE_ID, ENABLED_SETTING);
  },

  // The cauldron's state lives on the trade window, one per window.
  setup(app) {
    // Ingredients waiting in the cauldron, in the order they were thrown in.
    app.alchemySelection = [];
    app.alchemyHelpOpen = false;
    // The essences in play and the cauldron's rules, read from the essence book on each render.
    app.alchemyEssences = [];
    app.alchemyRules = { order: [], opposites: [] };
    // Whether the GM has the essence book open for editing, and which essence's form is unfolded.
    app.essencesEditing = false;
    app.openEssenceKey = null;
    // Essence the player filters their ingredients by, or every ingredient.
    app.alchemyFilter = ALL;
    // Last brew report the player closed, so it does not come back on every render.
    app.dismissedAlchemyReport = null;
  },

  async prepare(app, base) {
    const book = await loadEssences();
    const { catalog, index } = book;
    app.alchemyEssences = book.essences;
    app.alchemyRules = book.rules;
    const names = catalogNames(catalog);
    const view = { help: helpSteps(base.isGM), helpOpen: app.alchemyHelpOpen, cauldron: tradeApi().stationSvg("cauldron", "sodl-alchemy-cauldron"), slots: Array.from({ length: MAX_INGREDIENTS }) };
    if (base.isGM) {
      return { ...view, codex: codexView(book, names, app.essencesEditing, app.openEssenceKey) };
    }
    const actor = game.actors.get(app.actingId);
    if (!actor) {
      return view;
    }
    const notebook = readCharacterAlchemy(actor);
    const knowledge = notebook.journal;
    const unbound = notebook.unbound;
    const items = shelf(tradeApi().toResourceInventory(actor), index);
    // An essence filter the character no longer has (another character picked) falls back to everything.
    const filters = filterView(app, knowledge, app.alchemyFilter);
    if (!filters.some((filter) => filter.active)) {
      app.alchemyFilter = ALL;
      filters[0].active = true;
    }
    return {
      ...view,
      filters,
      shelf: shelfView(app, items, knowledge),
      vials: vialCount(actor, index),
      unbound: unbound.join(","),
      unboundPairs: unbound.map((pair) => pairNames(pair, names)),
      successes: successView(app, notebook.successes, names, items),
      report: reportView(app, notebook.report, names, app.dismissedAlchemyReport)
    };
  },

  bind(app) {
    const panel = app.element.querySelector("[data-panel=alchemy]");
    // The GM rewrites an essence field by field; each change is saved when the field is left.
    for (const input of panel.querySelectorAll("[data-essence-field]")) {
      input.addEventListener("change", () => sendEssences({ type: "updateEssence", key: input.dataset.essenceKey, field: input.dataset.essenceField, value: input.value }));
    }
    for (const select of panel.querySelectorAll("[data-essence-add-ingredient]")) {
      select.addEventListener("change", () => {
        if (select.value) {
          sendEssences({ type: "addIngredient", key: select.dataset.essenceAddIngredient, ingredient: select.value });
        }
      });
    }
    panel.querySelector("[data-alchemy-help]")?.addEventListener("toggle", (event) => {
      app.alchemyHelpOpen = event.target.open;
    });
    // Ingredients used up or given away since they were picked leave the cauldron here.
    refreshTable(app, panel);
    applyEssenceFilter(panel, app.alchemyFilter);
    for (const button of panel.querySelectorAll("[data-alchemy-filter]")) {
      button.addEventListener("click", () => {
        app.alchemyFilter = button.dataset.alchemyFilter;
        applyEssenceFilter(panel, app.alchemyFilter);
      });
    }
    for (const button of panel.querySelectorAll("[data-alchemy-add]")) {
      button.addEventListener("click", () => {
        toggleIngredient(app, button.dataset.alchemyAdd);
        refreshTable(app, panel);
      });
    }
    // A mix that worked goes back into the cauldron in one click.
    for (const button of panel.querySelectorAll("[data-alchemy-repeat]")) {
      button.addEventListener("click", () => {
        app.alchemySelection = button.dataset.alchemyRepeat.split(",");
        refreshTable(app, panel);
        panel.querySelector("[data-alchemy-table]")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      });
    }
    for (const slot of panel.querySelectorAll("[data-alchemy-slot]")) {
      slot.addEventListener("click", () => {
        toggleIngredient(app, slot.dataset.itemId);
        refreshTable(app, panel);
      });
    }
  },

  actions: {
    async alchemyBrew(event, target) {
      const action = { type: "brew", actorId: this.actingId, itemIds: [...this.alchemySelection] };
      target.disabled = true;
      // With the GM approving creations, the brew is only a request: the cauldron says so.
      let mode = "immediate";
      if (tradeApi().requiresApproval({ type: ALCHEMY_REQUEST, data: { action } })) {
        mode = "request";
      }
      await tradeApi().playBrew(target.closest("[data-craft-bench]"), mode);
      this.alchemySelection = [];
      sendAlchemy(action);
    },
    alchemyStudy(event, target) {
      sendAlchemy({ type: "study", actorId: this.actingId, itemId: target.dataset.itemId });
    },
    essenceToggleEdit() {
      this.essencesEditing = !this.essencesEditing;
      this.openEssenceKey = null;
      this.render();
    },
    essenceOpen(event, target) {
      const key = target.dataset.essenceKey;
      if (this.openEssenceKey === key) {
        this.openEssenceKey = null;
      } else {
        this.openEssenceKey = key;
      }
      this.render();
    },
    // The new essence opens straight in its form; the window renders when the book is saved.
    essenceAdd() {
      const key = `custom-${foundry.utils.randomID()}`;
      this.openEssenceKey = key;
      sendEssences({ type: "addEssence", key, name: t("SODLALCHEMY.Book.NewName") });
    },
    async essenceRemove(event, target) {
      const confirmed = await foundry.applications.api.DialogV2.confirm({
        window: { title: t("SODLALCHEMY.Book.Remove") },
        content: `<p>${t("SODLALCHEMY.Book.ConfirmRemove", { name: target.dataset.essenceName })}</p>`
      });
      if (confirmed) {
        sendEssences({ type: "removeEssence", key: target.dataset.essenceKey });
      }
    },
    essenceRestore(event, target) {
      sendEssences({ type: "restoreEssence", key: target.dataset.essenceKey });
    },
    essenceRemoveIngredient(event, target) {
      sendEssences({ type: "removeIngredient", key: target.dataset.essenceKey, ingredient: target.dataset.ingredient });
    },
    essencePickIcon(event, target) {
      const picker = new foundry.applications.apps.FilePicker.implementation({
        type: "image",
        current: target.dataset.current,
        callback: (path) => sendEssences({ type: "updateEssence", key: target.dataset.essenceKey, field: "icon", value: path })
      });
      picker.render(true);
    },
    async essenceReset() {
      const confirmed = await foundry.applications.api.DialogV2.confirm({
        window: { title: t("SODLALCHEMY.Book.Reset") },
        content: `<p>${t("SODLALCHEMY.Book.ConfirmReset")}</p>`
      });
      if (confirmed) {
        sendEssences({ type: "reset" });
      }
    },
    alchemyDismiss(event, target) {
      this.dismissedAlchemyReport = target.dataset.reportId;
      this.render();
    }
  }
};
