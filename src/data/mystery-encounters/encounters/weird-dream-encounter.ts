import { Type } from "#app/data/type";
import { MysteryEncounterType } from "#enums/mystery-encounter-type";
import { Species } from "#enums/species";
import BattleScene from "#app/battle-scene";
import IMysteryEncounter, { MysteryEncounterBuilder } from "../mystery-encounter";
import { MysteryEncounterOptionBuilder } from "../mystery-encounter-option";
import { leaveEncounterWithoutBattle, setEncounterRewards, } from "../utils/encounter-phase-utils";
import { MysteryEncounterTier } from "#enums/mystery-encounter-tier";
import { MysteryEncounterOptionMode } from "#enums/mystery-encounter-option-mode";
import Pokemon, { PlayerPokemon, PokemonMove } from "#app/field/pokemon";
import { IntegerHolder, randSeedInt, randSeedShuffle } from "#app/utils";
import PokemonSpecies, { allSpecies, getPokemonSpecies } from "#app/data/pokemon-species";
import { HiddenAbilityRateBoosterModifier, PokemonBaseStatTotalModifier, PokemonFormChangeItemModifier, PokemonHeldItemModifier } from "#app/modifier/modifier";
import { achvs } from "#app/system/achv";
import { speciesEggMoves } from "#app/data/egg-moves";
import { MysteryEncounterPokemonData } from "#app/data/mystery-encounters/mystery-encounter-pokemon-data";
import { queueEncounterMessage, showEncounterText } from "#app/data/mystery-encounters/utils/encounter-dialogue-utils";
import { modifierTypes } from "#app/modifier/modifier-type";
import { Stat } from "#app/data/pokemon-stat";
import i18next from "#app/plugins/i18n";
import { doPokemonTransformationSequence, TransformationScreenPosition } from "#app/data/mystery-encounters/utils/encounter-transformation-sequence";
import { getLevelTotalExp } from "#app/data/exp";

/** i18n namespace for encounter */
const namespace = "mysteryEncounter:weirdDream";

/** Exclude Ultra Beasts (inludes Cosmog/Solgaleo/Lunala/Necrozma), Paradox (includes Miraidon/Koraidon), Eternatus, Urshifu, the Poison Chain trio, Ogerpon */
const excludedPokemon = [
  Species.ETERNATUS,
  /** UBs */
  Species.NIHILEGO,
  Species.BUZZWOLE,
  Species.PHEROMOSA,
  Species.XURKITREE,
  Species.CELESTEELA,
  Species.KARTANA,
  Species.GUZZLORD,
  Species.POIPOLE,
  Species.NAGANADEL,
  Species.STAKATAKA,
  Species.BLACEPHALON,
  /** Paradox */
  Species.GREAT_TUSK,
  Species.SCREAM_TAIL,
  Species.BRUTE_BONNET,
  Species.FLUTTER_MANE,
  Species.SLITHER_WING,
  Species.SANDY_SHOCKS,
  Species.ROARING_MOON,
  Species.WALKING_WAKE,
  Species.GOUGING_FIRE,
  Species.RAGING_BOLT,
  Species.IRON_TREADS,
  Species.IRON_BUNDLE,
  Species.IRON_HANDS,
  Species.IRON_JUGULIS,
  Species.IRON_MOTH,
  Species.IRON_THORNS,
  Species.IRON_VALIANT,
  Species.IRON_LEAVES,
  Species.IRON_BOULDER,
  Species.IRON_CROWN,
  /** These are banned so they don't appear in the < 570 BST pool */
  Species.URSHIFU,
  Species.CUBCHOO,
  Species.OKIDOGI,
  Species.MUNKIDORI,
  Species.FEZANDIPITI,
  Species.OGERPON,
  Species.CALYREX,
  Species.TYPE_NULL,
  Species.TERAPAGOS,
  Species.COSMOG,
  Species.COSMOEM,
];

/**
 * Weird Dream encounter.
 * @see {@link https://github.com/AsdarDevelops/PokeRogue-Events/issues/137 | GitHub Issue #137}
 * @see For biome requirements check {@linkcode mysteryEncountersByBiome}
 */
export const WeirdDreamEncounter: IMysteryEncounter =
  MysteryEncounterBuilder.withEncounterType(MysteryEncounterType.WEIRD_DREAM)
    .withEncounterTier(MysteryEncounterTier.ROGUE)
    .withIntroSpriteConfigs([
      {
        spriteKey: "girawitch",
        fileRoot: "mystery-encounters",
        hasShadow: false,
        y: 4
      },
    ])
    .withIntroDialogue([
      {
        text: `${namespace}.intro`,
      },
      {
        speaker: `${namespace}.speaker`,
        text: `${namespace}.intro_dialogue`,
      },
    ])
    .withSceneWaveRangeRequirement(10, 180)
    .withTitle(`${namespace}.title`)
    .withDescription(`${namespace}.description`)
    .withQuery(`${namespace}.query`)
    .withOnInit((scene: BattleScene) => {
      scene.loadBgm("mystery_encounter_weird_dream", "mystery_encounter_weird_dream.mp3");
      return true;
    })
    .withOnVisualsStart((scene: BattleScene) => {
      // Change the bgm
      scene.fadeOutBgm(3000, false);
      scene.time.delayedCall(3000, () => {
        scene.playBgm("mystery_encounter_weird_dream");
      });

      return true;
    })
    .withOption(
      new MysteryEncounterOptionBuilder()
        .withOptionMode(MysteryEncounterOptionMode.DEFAULT)
        .withHasDexProgress(true)
        .withDialogue({
          buttonLabel: `${namespace}.option.1.label`,
          buttonTooltip: `${namespace}.option.1.tooltip`,
          selected: [
            {
              text: `${namespace}.option.1.selected`,
            }
          ],
        })
        .withPreOptionPhase(async (scene: BattleScene) => {
          // Play the animation as the player goes through the dialogue
          scene.time.delayedCall(1000, () => {
            doShowDreamBackground(scene);
          });

          // Calculate all the newly transformed Pokemon and begin asset load
          const teamTransformations = getTeamTransformations(scene);
          const loadAssets = teamTransformations.map(t => (t.newPokemon as PlayerPokemon).loadAssets());
          scene.currentBattle.mysteryEncounter.misc = {
            teamTransformations,
            loadAssets
          };
        })
        .withOptionPhase(async (scene: BattleScene) => {
          // Starts cutscene dialogue, but does not await so that cutscene plays as player goes through dialogue
          const cutsceneDialoguePromise = showEncounterText(scene, `${namespace}.option.1.cutscene`);

          // Change the entire player's party
          // Wait for all new Pokemon assets to be loaded before showing transformation animations
          await Promise.all(scene.currentBattle.mysteryEncounter.misc.loadAssets);
          const transformations = scene.currentBattle.mysteryEncounter.misc.teamTransformations;

          // If there are 1-3 transformations, do them centered back to back
          // Otherwise, the first 3 transformations are executed side-by-side, then any remaining 1-3 transformations occur in those same respective positions
          if (transformations.length <= 3) {
            for (const transformation of transformations) {
              const pokemon1 = transformation.previousPokemon;
              const pokemon2 = transformation.newPokemon;

              await doPokemonTransformationSequence(scene, pokemon1, pokemon2, TransformationScreenPosition.CENTER);
            }
          } else {
            await doSideBySideTransformations(scene, transformations);
          }

          // Make sure player has finished cutscene dialogue
          await cutsceneDialoguePromise;

          doHideDreamBackground(scene);
          await showEncounterText(scene, `${namespace}.option.1.dream_complete`);

          await doNewTeamPostProcess(scene, transformations);
          setEncounterRewards(scene, { guaranteedModifierTypeFuncs: [modifierTypes.MEMORY_MUSHROOM, modifierTypes.ROGUE_BALL, modifierTypes.MINT, modifierTypes.MINT]});
          leaveEncounterWithoutBattle(scene, true);
        })
        .build()
    )
    .withSimpleOption(
      {
        buttonLabel: `${namespace}.option.2.label`,
        buttonTooltip: `${namespace}.option.2.tooltip`,
        selected: [
          {
            text: `${namespace}.option.2.selected`,
          },
        ],
      },
      async (scene: BattleScene) => {
        // Reduce party levels by 20%
        for (const pokemon of scene.getParty()) {
          pokemon.level = Math.max(Math.ceil(0.8 * pokemon.level), 1);
          pokemon.exp = getLevelTotalExp(pokemon.level, pokemon.species.growthRate);
          pokemon.levelExp = 0;

          pokemon.calculateStats();
          pokemon.updateInfo();
        }

        leaveEncounterWithoutBattle(scene, true);
        return true;
      }
    )
    .withOutroDialogue([
      {
        text: `${namespace}.outro`
      }
    ])
    .build();

interface PokemonTransformation {
  previousPokemon: PlayerPokemon;
  newSpecies: PokemonSpecies;
  newPokemon: PlayerPokemon;
  heldItems: PokemonHeldItemModifier[];
}

function getTeamTransformations(scene: BattleScene): PokemonTransformation[] {
  const party = scene.getParty();
  // Removes all pokemon from the party
  const alreadyUsedSpecies: PokemonSpecies[] = [];
  const pokemonTransformations: PokemonTransformation[] = party.map(p => {
    return {
      previousPokemon: p
    } as PokemonTransformation;
  });

  // Only 1 Pokemon can be transformed into BST higher than 600
  let hasPokemonBstHigherThan600 = false;
  // Only 1 other Pokemon can be transformed into BST between 570-600
  let hasPokemonBstBetween570And600 = false;

  // First, roll 2 of the party members to new Pokemon at a +90 to +110 BST difference
  // Then, roll the remainder of the party members at a +40 to +50 BST difference
  const numPokemon = party.length;
  for (let i = 0; i < numPokemon; i++) {
    const removed = party[randSeedInt(party.length)];
    const index = pokemonTransformations.findIndex(p => p.previousPokemon.id === removed.id);
    pokemonTransformations[index].heldItems = removed.getHeldItems().filter(m => !(m instanceof PokemonFormChangeItemModifier));
    scene.removePokemonFromPlayerParty(removed, false);

    const bst = getOriginalBst(scene, removed);
    let newBstRange;
    if (i < 2) {
      newBstRange = [90, 110];
    } else {
      newBstRange = [40, 50];
    }

    const newSpecies = getTransformedSpecies(bst, newBstRange, hasPokemonBstHigherThan600, hasPokemonBstBetween570And600, alreadyUsedSpecies);

    const newSpeciesBst = newSpecies.getBaseStatTotal();
    if (newSpeciesBst > 600) {
      hasPokemonBstHigherThan600 = true;
    }
    if (newSpeciesBst <= 600 && newSpeciesBst >= 570) {
      hasPokemonBstBetween570And600 = true;
    }


    pokemonTransformations[index].newSpecies = newSpecies;
    alreadyUsedSpecies.push(newSpecies);
  }

  for (const transformation of pokemonTransformations) {
    const newAbilityIndex = randSeedInt(transformation.newSpecies.getAbilityCount());
    const newPlayerPokemon = scene.addPlayerPokemon(transformation.newSpecies, transformation.previousPokemon.level, newAbilityIndex, undefined);
    transformation.newPokemon = newPlayerPokemon;
    scene.getParty().push(newPlayerPokemon);
  }

  return pokemonTransformations;
}

async function doNewTeamPostProcess(scene: BattleScene, transformations: PokemonTransformation[]) {
  let atLeastOneNewStarter = false;
  for (const transformation of transformations) {
    const previousPokemon = transformation.previousPokemon;
    const newPokemon = transformation.newPokemon;
    const speciesRootForm = newPokemon.species.getRootSpeciesId();

    // Roll HA a second time
    if (newPokemon.species.abilityHidden) {
      const hiddenIndex = newPokemon.species.ability2 ? 2 : 1;
      if (newPokemon.abilityIndex < hiddenIndex) {
        const hiddenAbilityChance = new IntegerHolder(256);
        scene.applyModifiers(HiddenAbilityRateBoosterModifier, true, hiddenAbilityChance);

        const hasHiddenAbility = !randSeedInt(hiddenAbilityChance.value);

        if (hasHiddenAbility) {
          newPokemon.abilityIndex = hiddenIndex;
        }
      }
    }

    // Roll IVs a second time
    newPokemon.ivs = newPokemon.ivs.map(iv => {
      const newValue = randSeedInt(31);
      return newValue > iv ? newValue : iv;
    });


    // For pokemon at/below 570 BST or any shiny pokemon, unlock it permanently as if you had caught it
    if (newPokemon.getSpeciesForm().getBaseStatTotal() <= 570 || newPokemon.isShiny()) {
      if (newPokemon.getSpeciesForm().abilityHidden && newPokemon.abilityIndex === newPokemon.getSpeciesForm().getAbilityCount() - 1) {
        scene.validateAchv(achvs.HIDDEN_ABILITY);
      }

      if (newPokemon.species.subLegendary) {
        scene.validateAchv(achvs.CATCH_SUB_LEGENDARY);
      }

      if (newPokemon.species.legendary) {
        scene.validateAchv(achvs.CATCH_LEGENDARY);
      }

      if (newPokemon.species.mythical) {
        scene.validateAchv(achvs.CATCH_MYTHICAL);
      }

      scene.gameData.updateSpeciesDexIvs(newPokemon.species.getRootSpeciesId(true), newPokemon.ivs);
      const newStarterUnlocked = await scene.gameData.setPokemonCaught(newPokemon, true, false, false);
      if (newStarterUnlocked) {
        atLeastOneNewStarter = true;
        queueEncounterMessage(scene, i18next.t("battle:addedAsAStarter", { pokemonName: getPokemonSpecies(speciesRootForm).getName() }));
      }
    }

    // If the previous pokemon had higher IVs, override to those (after updating dex IVs > prevents perfect 31s on a new unlock)
    newPokemon.ivs = newPokemon.ivs.map((iv, index) => {
      return previousPokemon.ivs[index] > iv ? previousPokemon.ivs[index] : iv;
    });

    // For pokemon that the player owns (including ones just caught), gain a candy
    if (!!scene.gameData.dexData[speciesRootForm].caughtAttr) {
      scene.gameData.addStarterCandy(getPokemonSpecies(speciesRootForm), 1);
    }

    // Set the moveset of the new pokemon to be the same as previous, but with 1 egg move of the new species
    newPokemon.moveset = previousPokemon.moveset;
    if (speciesEggMoves.hasOwnProperty(speciesRootForm)) {
      const eggMoves = speciesEggMoves[speciesRootForm];
      const eggMoveIndex = randSeedInt(4);
      const randomEggMove = eggMoves[eggMoveIndex];
      if (newPokemon.moveset.length < 4) {
        newPokemon.moveset.push(new PokemonMove(randomEggMove));
      } else {
        newPokemon.moveset[randSeedInt(4)] = new PokemonMove(randomEggMove);
      }
      // For pokemon that the player owns (including ones just caught), unlock the egg move
      if (!!scene.gameData.dexData[speciesRootForm].caughtAttr) {
        await scene.gameData.setEggMoveUnlocked(getPokemonSpecies(speciesRootForm), eggMoveIndex, true);
      }
    }

    // Randomize the second type of the pokemon
    // If the pokemon does not normally have a second type, it will gain 1
    const newTypes = [newPokemon.getTypes()[0]];
    let newType = randSeedInt(18) as Type;
    while (newType === newTypes[0]) {
      newType = randSeedInt(18) as Type;
    }
    newTypes.push(newType);
    if (!newPokemon.mysteryEncounterData) {
      newPokemon.mysteryEncounterData = new MysteryEncounterPokemonData(null, null, null, newTypes);
    } else {
      newPokemon.mysteryEncounterData.types = newTypes;
    }

    for (const item of transformation.heldItems) {
      item.pokemonId = newPokemon.id;
      scene.addModifier(item, false, false, false, true);
    }

    // Any pokemon that is at or below 450 BST gets +20 permanent BST to 3 stats:  HP, lowest of Atk/SpAtk, and lowest of Def/SpDef
    if (newPokemon.getSpeciesForm().getBaseStatTotal() <= 600) {
      const stats: Stat[] = [Stat.HP];
      const baseStats = newPokemon.getSpeciesForm().baseStats.slice(0);
      // Attack or SpAtk
      stats.push(baseStats[Stat.ATK] < baseStats[Stat.SPATK] ? Stat.ATK : Stat.SPATK);
      // Def or SpDef
      stats.push(baseStats[Stat.DEF] < baseStats[Stat.SPDEF] ? Stat.DEF : Stat.SPDEF);
      // const mod = modifierTypes.MYSTERY_ENCOUNTER_OLD_GATEAU().newModifier(newPokemon, 20, stats);
      const modType = modifierTypes.MYSTERY_ENCOUNTER_OLD_GATEAU().generateType(null, [20, stats]);
      const modifier = modType.newModifier(newPokemon);
      scene.addModifier(modifier);
    }

    // Enable passive if previous had it
    newPokemon.passive = previousPokemon.passive;

    newPokemon.calculateStats();
    newPokemon.initBattleInfo();
  }

  // One random pokemon will get its passive unlocked
  const passiveDisabledPokemon = scene.getParty().filter(p => !p.passive);
  if (passiveDisabledPokemon?.length > 0) {
    passiveDisabledPokemon[randSeedInt(passiveDisabledPokemon.length)].passive = true;
  }

  // If at least one new starter was unlocked, play 1 fanfare
  if (atLeastOneNewStarter) {
    scene.playSound("level_up_fanfare");
  }
}

function getOriginalBst(scene: BattleScene, pokemon: Pokemon) {
  const baseStats = pokemon.getSpeciesForm().baseStats.slice(0);
  scene.applyModifiers(PokemonBaseStatTotalModifier, true, pokemon, baseStats);
  if (pokemon.fusionSpecies) {
    const fusionBaseStats = pokemon.getFusionSpeciesForm().baseStats;
    for (let s = 0; s < pokemon.stats.length; s++) {
      baseStats[s] = Math.ceil((baseStats[s] + fusionBaseStats[s]) / 2);
    }
  } else if (scene.gameMode.isSplicedOnly) {
    for (let s = 0; s < pokemon.stats.length; s++) {
      baseStats[s] = Math.ceil(baseStats[s] / 2);
    }
  }
  return baseStats.reduce((a, b) => a + b, 0);
}

function getTransformedSpecies(originalBst: number, bstSearchRange: [number, number], hasPokemonBstHigherThan600: boolean, hasPokemonBstBetween570And600: boolean, alreadyUsedSpecies: PokemonSpecies[]): PokemonSpecies {
  let newSpecies: PokemonSpecies;
  while (!newSpecies) {
    const bstCap = originalBst + bstSearchRange[1];
    const bstMin = Math.max(originalBst + bstSearchRange[0], 0);

    // Get any/all species that fall within the Bst range requirements
    let validSpecies = allSpecies
      .filter(s => {
        const speciesBst = s.getBaseStatTotal();
        const bstInRange = speciesBst >= bstMin && speciesBst <= bstCap;
        // Checks that a Pokemon has not already been added in the +600 or 570-600 slots;
        const validBst = (!hasPokemonBstBetween570And600 || (speciesBst < 570 || speciesBst > 600)) &&
          (!hasPokemonBstHigherThan600 || speciesBst <= 600);
        return bstInRange && validBst && !excludedPokemon.includes(s.speciesId);
      });

    // There must be at least 20 species available before it will choose one
    if (validSpecies?.length > 20) {
      validSpecies = randSeedShuffle(validSpecies);
      newSpecies = validSpecies.pop();
      while (alreadyUsedSpecies.includes(newSpecies)) {
        newSpecies = validSpecies.pop();
      }
    } else {
      // Expands search rand until a Pokemon is found
      bstSearchRange[0] -= 10;
      bstSearchRange[1] += 10;
    }
  }

  return newSpecies;
}

function doShowDreamBackground(scene: BattleScene) {
  const transformationContainer = scene.add.container(0, -scene.game.canvas.height / 6);
  transformationContainer.name = "Dream Background";

  // In case it takes a bit for video to load
  const transformationStaticBg = scene.add.rectangle(0, 0, scene.game.canvas.width / 6, scene.game.canvas.height / 6, 0);
  transformationStaticBg.setName("Black Background");
  transformationStaticBg.setOrigin(0, 0);
  transformationContainer.add(transformationStaticBg);
  transformationStaticBg.setVisible(true);

  const transformationVideoBg: Phaser.GameObjects.Video = scene.add.video(0, 0, "evo_bg").stop();
  transformationVideoBg.setLoop(true);
  transformationVideoBg.setOrigin(0, 0);
  transformationVideoBg.setScale(0.4359673025);
  transformationContainer.add(transformationVideoBg);

  scene.fieldUI.add(transformationContainer);
  scene.fieldUI.bringToTop(transformationContainer);
  transformationVideoBg.play();

  transformationContainer.setVisible(true);
  transformationContainer.alpha = 0;

  scene.tweens.add({
    targets: transformationContainer,
    alpha: 1,
    duration: 3000,
    ease: "Sine.easeInOut"
  });
}

function doHideDreamBackground(scene: BattleScene) {
  const transformationContainer = scene.fieldUI.getByName("Dream Background");

  scene.tweens.add({
    targets: transformationContainer,
    alpha: 0,
    duration: 3000,
    ease: "Sine.easeInOut",
    onComplete: () => {
      scene.fieldUI.remove(transformationContainer, true);
    }
  });
}

function doSideBySideTransformations(scene: BattleScene, transformations: PokemonTransformation[]) {
  return new Promise<void>(resolve => {
    const allTransformationPromises = [];
    for (let i = 0; i < 3; i++) {
      const delay = i * 4000;
      scene.time.delayedCall(delay, () => {
        const transformation = transformations[i];
        const pokemon1 = transformation.previousPokemon;
        const pokemon2 = transformation.newPokemon;
        const screenPosition = i as TransformationScreenPosition;

        const transformationPromise = doPokemonTransformationSequence(scene, pokemon1, pokemon2, screenPosition)
          .then(() => {
            if (transformations.length > i + 3) {
              const nextTransformationAtPosition = transformations[i + 3];
              const nextPokemon1 = nextTransformationAtPosition.previousPokemon;
              const nextPokemon2 = nextTransformationAtPosition.newPokemon;

              allTransformationPromises.push(doPokemonTransformationSequence(scene, nextPokemon1, nextPokemon2, screenPosition));
            }
          });
        allTransformationPromises.push(transformationPromise);
      });
    }

    // Wait for all transformations to be loaded into promise array
    const id = setInterval(checkAllPromisesExist, 500);
    async function checkAllPromisesExist() {
      if (allTransformationPromises.length === transformations.length) {
        clearInterval(id);
        await Promise.all(allTransformationPromises);
        resolve();
      }
    }
  });
}
