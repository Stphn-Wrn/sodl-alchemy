export const MODULE_ID = "sodl-alchemy";
export const TRADE_MODULE_ID = "sodl-trade";
export const ENABLED_SETTING = "enabled";
export const ESSENCE_BOOK_SETTING = "essenceBook";
export const NOTEBOOK_FLAG = "notebook";
// The kinds of request this module adds to the trade module's queue.
export const ALCHEMY_REQUEST = "sodl-alchemy";
export const ESSENCE_REQUEST = "sodl-alchemy-essences";

export function modulePath(relativePath) {
  return `modules/${MODULE_ID}/${relativePath}`;
}
