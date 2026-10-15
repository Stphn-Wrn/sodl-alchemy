// The trade module's API, handed over when it is set up. Everything this module needs
// from it goes through here, never through its files.
let api = null;

export function connectTradeApi(tradeApi) {
  api = tradeApi;
}

export function tradeApi() {
  return api;
}

export function t(key, data) {
  if (data) {
    return game.i18n.format(key, data);
  }
  return game.i18n.localize(key);
}
