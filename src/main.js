import { ALCHEMY_REQUEST, ENABLED_SETTING, ESSENCE_BOOK_SETTING, ESSENCE_REQUEST, MODULE_ID } from "./constants.js";
import { alchemyPanel } from "./panel/alchemy-panel.js";
import { emptyEssenceBook } from "./rules/essence-book.js";
import { CAULDRON_DISCOVERY, cauldronDiscovery, handleAlchemyRequest } from "./store/alchemy-store.js";
import { handleEssenceRequest } from "./store/essence-store.js";
import { connectTradeApi, tradeApi } from "./trade-api.js";

function enabled() {
  return game.settings.get(MODULE_ID, ENABLED_SETTING);
}

// What the GM sees in the list of requests when a brew waits for approval: the ingredients thrown in.
function describeBrew(actor, action) {
  const items = (action.itemIds ?? []).map((itemId) => actor.items.get(itemId)).filter(Boolean);
  return { name: items.map((item) => item.name).join(" + "), img: items[0]?.img ?? "" };
}

// The trade module calls this once its own settings are registered, during init.
Hooks.once("sodlTrade.init", (api) => {
  connectTradeApi(api);

  // A house rule, not in the books: the GM has to turn it on.
  game.settings.register(MODULE_ID, ENABLED_SETTING, {
    name: "SODLALCHEMY.Settings.Enabled.Name",
    hint: "SODLALCHEMY.Settings.Enabled.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    onChange: () => api.onFeatureToggled()
  });
  // The GM's changes to the essences: created, rewritten, removed, and given to other ingredients.
  game.settings.register(MODULE_ID, ESSENCE_BOOK_SETTING, {
    scope: "world",
    config: false,
    type: Object,
    default: emptyEssenceBook(),
    onChange: () => api.refresh()
  });

  api.registerPanel(alchemyPanel, { before: "harvest" });
  // Brewing and studying only touch the player's own character, so they run on their client;
  // a brew creates a potion, so it waits for the GM when crafting needs approval.
  api.registerRequest(ALCHEMY_REQUEST, { handler: handleAlchemyRequest, enabled, ownClient: true, approvalActions: ["brew"], describeCreation: describeBrew });
  api.registerRequest(ESSENCE_REQUEST, { handler: handleEssenceRequest, enabled });
  api.registerRecipeDiscovery(CAULDRON_DISCOVERY, cauldronDiscovery);
});

// Without the trade module there is nothing to plug into; Foundry's dependency check normally prevents it.
Hooks.once("ready", () => {
  if (!tradeApi() && game.user.isGM) {
    ui.notifications.error(game.i18n.localize("SODLALCHEMY.Errors.NoTradeModule"));
  }
});
