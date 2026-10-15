// An error whose message is a translation key; the trade module shows it to the player instead of logging it.
export class LocalizedError extends Error {
  constructor(key, data = {}) {
    super(key);
    this.data = data;
    this.localized = true;
  }
}

function lookup(dictionary, key) {
  return key.split(".").reduce((node, part) => node?.[part], dictionary);
}

function interpolate(text, data) {
  return text.replace(/\{(\w+)\}/g, (match, name) => {
    if (data[name] === undefined) {
      return match;
    }
    return String(data[name]);
  });
}

// Used by the tests; in Foundry, game.i18n does the same.
export function createTranslator(dictionary) {
  return (key, data = {}) => {
    const text = lookup(dictionary, key);
    if (typeof text !== "string") {
      return key;
    }
    return interpolate(text, data);
  };
}
