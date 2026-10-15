# L'Ombre du Seigneur Démon - Alchimie à essences

[English version](README.md)

Module complémentaire pour Foundry VTT et le système **Shadow of the Demon Lord**. Il ajoute un onglet **Alchimie** à la fenêtre du module [Échanges et artisanat](https://github.com/Stphn-Wrn/sodl-trade) : les ingrédients cachent des essences que les personnages découvrent en les mélangeant au chaudron.

**C'est une règle maison, absente des livres.** Les livres passent par l'onglet Artisanat (Demon Lord's Companion) et par les sorts Identify Substance et Brew Potion de l'onglet Laboratoire, tous fournis par le module Échanges et artisanat.

## Prérequis

- Foundry VTT 13 ou plus récent, système Shadow of the Demon Lord.
- Le module **Échanges et artisanat** (`sodl-trade`) 1.2.0 ou plus récent, activé dans le monde. Foundry refuse d'activer l'alchimie sans lui.

## Ce qu'il y a dedans

- **Absente des livres** — Cette alchimie est une règle maison. Elle reste éteinte tant que le MJ ne l'allume pas dans les paramètres.
- **Sans MJ** — Quand le MJ a désactivé la validation des fabrications, brasser et étudier ne touchent que le personnage du joueur : cela marche sans MJ connecté. Avec la validation, chaque brassage est une demande que le MJ valide. Le carnet est gardé sur la fiche du personnage. Seule la découverte d'une recette d'artisanat au chaudron demande un MJ, qui l'enregistre.
- **Essences cachées** — 68 des ressources sont des ingrédients alchimiques. Chacun cache deux à quatre essences parmi 14 (Vitalité, Purge, Venin, Vigilance, Cendre, Ombre, Pierre, Fureur, Clarté, Célérité, Putréfaction, Songe, Abîme, Garde).
- **Brasser** — Le joueur jette de 2 à 4 ingrédients différents dans le chaudron et clique sur **Brasser** (il faut une fiole vide). Les essences que partagent au moins deux ingrédients passent dans la potion ; les autres restent secrètes. Sans rien en commun, la mixture est inerte : les ingrédients sont perdus, la fiole est gardée, et le carnet note les paires d'ingrédients sans affinité ; le chaudron prévient si on retente un mélange connu pour rester inerte.
- **Qualité** — Un jet d'Intellect fixe la qualité : 20 ou plus, puissante ; 10 ou plus, ordinaire ; en dessous, trouble, avec un effet secondaire tiré au d6 (Corruption, Folie, nausée, éruption, visions, stigmate). Deux essences opposées (Vitalité et Putréfaction, Purge et Venin, Clarté et Songe, Garde et Abîme, Célérité et Pierre) rendent la mixture instable : un effet secondaire de plus.
- **Potions** — La potion arrive dans l'inventaire comme un objet dont la description donne les effets en termes de jeu ; le MJ arbitre quand elle est bue ou enduite sur une arme.
- **Carnet** — Les essences révélées s'inscrivent dans le carnet du personnage et s'affichent sur ses ingrédients. La loupe sacrifie un ingrédient pour révéler une essence de plus. Mettre dans le chaudron exactement les ingrédients d'une recette d'artisanat, sans rien de plus, l'ajoute aux recettes connues du personnage (onglet Artisanat) ; la fiole seule ne suffit pas.
- **Mélanges réussis** — Le carnet liste les mélanges qui ont donné une potion : la potion obtenue, ses ingrédients et ses essences ; survoler une ligne montre ses effets. Un clic remet les mêmes ingrédients dans le chaudron, si le personnage les a encore.
- **Codex** — Le MJ voit dans l'onglet les essences de chaque ingrédient. L'onglet a son propre interrupteur dans les paramètres.
- **Modifier les essences** — Depuis le codex, le MJ crée des essences, réécrit leur nom et leurs effets (normal et puissant), choisit leur couleur, l'icône de leurs potions et leur contraire, et donne une essence à n'importe quel ingrédient du catalogue ou la lui retire. Une essence d'origine retirée peut être remise ; « Tout remettre comme au départ » annule tous les changements. Les potions déjà brassées ne changent pas, et une essence que les joueurs avaient découverte puis que le MJ retire disparaît de leurs ingrédients.

## Paramètres

| Paramètre | Par défaut |
|---|---|
| Activer l'alchimie expérimentale (règle maison) | désactivé |

Brasser crée une potion : quand le paramètre « Les fabrications doivent être validées par le MJ » du module Échanges et artisanat est activé, chaque brassage devient une demande que le MJ valide dans l'onglet Artisanat.

## Données

Le carnet de chaque personnage est rangé sur sa fiche (`flags.sodl-alchemy.notebook`). Un carnet écrit par une version d'Échanges et artisanat qui contenait encore l'alchimie (`flags.sodl-trade.alchemy`) est repris tant que le personnage n'a pas brassé à nouveau. Le livre des essences du MJ est un paramètre du monde (`sodl-alchemy.essenceBook`).

## Développement

```bash
npm test
```

Les tests couvrent les règles (essences, brassage, qualité, carnet, découverte de recettes, livre des essences, potions) et tournent avec `node --test`, sans Foundry. Le module ne dépend que de l'API publiée par Échanges et artisanat (`game.modules.get("sodl-trade").api`), jamais de ses fichiers.

## Licence

MIT
