# Shadow of the Demon Lord - Essence Alchemy

[Version française](README.fr.md)

Add-on module for Foundry VTT and the **Shadow of the Demon Lord** system. It adds an **Alchemy** tab to the window of the [Trades and Crafting](https://github.com/Stphn-Wrn/sodl-trade) module: ingredients hide essences that characters find out by mixing them in the cauldron.

**This is a house rule, not in the books.** The books go through the Crafting tab (Demon Lord's Companion) and the Identify Substance and Brew Potion spells of the Laboratory tab, all provided by the Trades and Crafting module.

## Requirements

- Foundry VTT 13 or later, Shadow of the Demon Lord system.
- The **Trades and Crafting** module (`sodl-trade`) in a version that publishes the extension API (planned for 1.2.0), enabled in the world. Foundry will not enable the alchemy without it.

## Features

- **Not in the books** — This alchemy is a house rule. It is off until the GM turns it on in the settings.
- **No GM needed** — When the GM has turned crafting approval off, brewing and studying only change the player's own character, so they work without a GM connected; with approval on, each brew is a request the GM approves. The notebook is kept on the character's sheet. Only finding a crafting recipe in the cauldron needs a GM, who records it.
- **Hidden essences** — 68 of the resources are alchemical ingredients. Each hides two to four essences among 14 (Vitality, Purge, Venom, Vigilance, Cinder, Shadow, Stone, Fury, Clarity, Haste, Decay, Dream, Abyss, Ward).
- **Brew** — The player throws 2 to 4 different ingredients into the cauldron and clicks **Brew** (an empty vial is needed). The essences shared by at least two ingredients go into the potion; the others stay secret. With nothing in common, the mixture is inert: the ingredients are lost, the vial is kept, and the notebook records the pairs of ingredients with no affinity; the cauldron warns when a mix known to stay inert is tried again.
- **Quality** — An Intellect roll sets the quality: 20 or more, potent; 10 or more, ordinary; below, murky, with a side effect rolled on a d6 (Corruption, Insanity, nausea, eruption, visions, stigma). Two opposed essences (Vitality and Decay, Purge and Venom, Clarity and Dream, Ward and Abyss, Haste and Stone) make the brew unstable: one more side effect.
- **Potions** — The potion arrives in the inventory as an item whose description gives its effects in game terms; the GM rules on them when it is drunk or coated on a weapon.
- **Notebook** — Revealed essences go into the character's notebook and show on their ingredients. The magnifier sacrifices one ingredient to reveal one more essence. Putting exactly the ingredients of a crafting recipe into the cauldron, nothing more, adds it to the character's known recipes (Crafting tab); the vial alone is not enough.
- **Successful mixes** — The notebook lists the mixes that made a potion, with the potion, its ingredients and its essences; hovering a line shows its effects. One click puts the same ingredients back into the cauldron, if the character still has them.
- **Codex** — The GM sees every ingredient's essences in the tab. The tab has its own switch in the settings.
- **Edit essences** — From the codex, the GM creates essences, rewrites their name and effects (normal and potent), picks their colour, their potions' icon and their contrary, and gives an essence to any catalog ingredient or takes it away. A removed original essence can be restored; "Restore everything" undoes every change. Potions already brewed do not change, and an essence the players had found that the GM removes leaves their ingredients.

## Settings

| Setting | Default |
|---|---|
| Enable experimental alchemy (house rule) | off |

Brewing creates a potion: when the Trades and Crafting setting "Crafting must be approved by the GM" is on, each brew becomes a request the GM approves in the Crafting tab.

## Data

Each character's notebook is kept on their sheet (`flags.sodl-alchemy.notebook`). A notebook written by a version of Trades and Crafting that still held the alchemy (`flags.sodl-trade.alchemy`) is read until the character brews again. The GM's essence book is a world setting (`sodl-alchemy.essenceBook`).

## Development

```bash
npm test
```

The tests cover the rules (essences, brewing, quality, notebook, recipe discovery, essence book, potions) and run with `node --test`, without Foundry. The module only relies on the API published by Trades and Crafting (`game.modules.get("sodl-trade").api`), never on its files.

## License

MIT
