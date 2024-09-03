import { generateModifierType, leaveEncounterWithoutBattle, selectPokemonForOption, setEncounterExp, updatePlayerMoney, } from "#app/data/mystery-encounters/utils/encounter-phase-utils";
import { StatusEffect } from "#app/data/status-effect";
import Pokemon, { PlayerPokemon } from "#app/field/pokemon";
import { modifierTypes } from "#app/modifier/modifier-type";
import { randSeedInt } from "#app/utils";
import { MysteryEncounterType } from "#enums/mystery-encounter-type";
import { Species } from "#enums/species";
import BattleScene from "#app/battle-scene";
import MysteryEncounter, { MysteryEncounterBuilder } from "../mystery-encounter";
import { MysteryEncounterOptionBuilder } from "../mystery-encounter-option";
import { MoneyRequirement } from "../mystery-encounter-requirements";
import { getEncounterText, queueEncounterMessage } from "#app/data/mystery-encounters/utils/encounter-dialogue-utils";
import { applyDamageToPokemon, applyModifierTypeToPlayerPokemon } from "#app/data/mystery-encounters/utils/encounter-pokemon-utils";
import { MysteryEncounterTier } from "#enums/mystery-encounter-tier";
import { MysteryEncounterOptionMode } from "#enums/mystery-encounter-option-mode";

/** the i18n namespace for this encounter */
const namespace = "mysteryEncounter:shadyVitaminDealer";

/**
 * Shady Vitamin Dealer encounter.
 * @see {@link https://github.com/pagefaultgames/pokerogue/issues/3798 | GitHub Issue #3798}
 * @see For biome requirements check {@linkcode mysteryEncountersByBiome}
 */
export const ShadyVitaminDealerEncounter: MysteryEncounter =
  MysteryEncounterBuilder.withEncounterType(MysteryEncounterType.SHADY_VITAMIN_DEALER)
    .withEncounterTier(MysteryEncounterTier.COMMON)
    .withSceneWaveRangeRequirement(10, 180)
    .withPrimaryPokemonStatusEffectRequirement([StatusEffect.NONE]) // Pokemon must not have status
    .withPrimaryPokemonHealthRatioRequirement([0.34, 1]) // Pokemon must have above 1/3rd HP
    .withIntroSpriteConfigs([
      {
        spriteKey: Species.KROOKODILE.toString(),
        fileRoot: "pokemon",
        hasShadow: true,
        repeat: true,
        x: 12,
        y: -5,
        yShadow: -5
      },
      {
        spriteKey: "b2w2_veteran_m",
        fileRoot: "mystery-encounters",
        hasShadow: true,
        x: -12,
        y: 3,
        yShadow: 3
      },
    ])
    .withIntroDialogue([
      {
        text: `${namespace}.intro`,
      },
      {
        text: `${namespace}.intro_dialogue`,
        speaker: `${namespace}.speaker`,
      },
    ])
    .withTitle(`${namespace}.title`)
    .withDescription(`${namespace}.description`)
    .withQuery(`${namespace}.query`)
    .withOption(
      MysteryEncounterOptionBuilder
        .newOptionWithMode(MysteryEncounterOptionMode.DISABLED_OR_DEFAULT)
        .withSceneMoneyRequirement(0, 2) // Wave scaling money multiplier of 2
        .withDialogue({
          buttonLabel: `${namespace}.option.1.label`,
          buttonTooltip: `${namespace}.option.1.tooltip`,
          selected: [
            {
              text: `${namespace}.option.selected`,
            },
          ],
        })
        .withPreOptionPhase(async (scene: BattleScene): Promise<boolean> => {
          const encounter = scene.currentBattle.mysteryEncounter!;
          const onPokemonSelected = (pokemon: PlayerPokemon) => {
            // Update money
            updatePlayerMoney(scene, -(encounter.options[0].requirements[0] as MoneyRequirement).requiredMoney);
            // Calculate modifiers and dialogue tokens
            const modifiers = [
              generateModifierType(scene, modifierTypes.BASE_STAT_BOOSTER)!,
              generateModifierType(scene, modifierTypes.BASE_STAT_BOOSTER)!,
            ];
            encounter.setDialogueToken("boost1", modifiers[0].name);
            encounter.setDialogueToken("boost2", modifiers[1].name);
            encounter.misc = {
              chosenPokemon: pokemon,
              modifiers: modifiers,
            };
          };

          // Only Pokemon that can gain benefits are above 1/3rd HP with no status
          const selectableFilter = (pokemon: Pokemon) => {
            // If pokemon meets primary pokemon reqs, it can be selected
            const meetsReqs = encounter.pokemonMeetsPrimaryRequirements(scene, pokemon);
            if (!meetsReqs) {
              return getEncounterText(scene, `${namespace}.invalid_selection`) ?? null;
            }

            return null;
          };

          return selectPokemonForOption(scene, onPokemonSelected, undefined, selectableFilter);
        })
        .withOptionPhase(async (scene: BattleScene) => {
          // Choose Cheap Option
          const encounter = scene.currentBattle.mysteryEncounter!;
          const chosenPokemon = encounter.misc.chosenPokemon;
          const modifiers = encounter.misc.modifiers;

          for (const modType of modifiers) {
            await applyModifierTypeToPlayerPokemon(scene, chosenPokemon, modType);
          }

          leaveEncounterWithoutBattle(scene);
        })
        .withPostOptionPhase(async (scene: BattleScene) => {
          // Damage and status applied after dealer leaves (to make thematic sense)
          const encounter = scene.currentBattle.mysteryEncounter!;
          const chosenPokemon = encounter.misc.chosenPokemon;

          // Pokemon takes 1/3 max HP damage
          applyDamageToPokemon(scene, chosenPokemon, Math.floor(chosenPokemon.getMaxHp() / 3));

          // Roll for poison (80%)
          if (randSeedInt(10) < 8) {
            if (chosenPokemon.trySetStatus(StatusEffect.TOXIC)) {
              // Toxic applied
              queueEncounterMessage(scene, `${namespace}.bad_poison`);
            } else {
              // Pokemon immune or something else prevents status
              queueEncounterMessage(scene, `${namespace}.damage_only`);
            }
          } else {
            queueEncounterMessage(scene, `${namespace}.damage_only`);
          }

          setEncounterExp(scene, [chosenPokemon.id], 100);

          chosenPokemon.updateInfo();
        })
        .build()
    )
    .withOption(
      MysteryEncounterOptionBuilder
        .newOptionWithMode(MysteryEncounterOptionMode.DISABLED_OR_DEFAULT)
        .withSceneMoneyRequirement(0, 5) // Wave scaling money multiplier of 5
        .withDialogue({
          buttonLabel: `${namespace}.option.2.label`,
          buttonTooltip: `${namespace}.option.2.tooltip`,
          selected: [
            {
              text: `${namespace}.option.selected`,
            },
          ],
        })
        .withPreOptionPhase(async (scene: BattleScene): Promise<boolean> => {
          const encounter = scene.currentBattle.mysteryEncounter!;
          const onPokemonSelected = (pokemon: PlayerPokemon) => {
            // Update money
            updatePlayerMoney(scene, -(encounter.options[1].requirements[0] as MoneyRequirement).requiredMoney);
            // Calculate modifiers and dialogue tokens
            const modifiers = [
              generateModifierType(scene, modifierTypes.BASE_STAT_BOOSTER)!,
              generateModifierType(scene, modifierTypes.BASE_STAT_BOOSTER)!,
            ];
            encounter.setDialogueToken("boost1", modifiers[0].name);
            encounter.setDialogueToken("boost2", modifiers[1].name);
            encounter.misc = {
              chosenPokemon: pokemon,
              modifiers: modifiers,
            };
          };

          // Only Pokemon that can gain benefits are above 1/3rd HP with no status
          const selectableFilter = (pokemon: Pokemon) => {
            // If pokemon meets primary pokemon reqs, it can be selected
            const meetsReqs = encounter.pokemonMeetsPrimaryRequirements(scene, pokemon);
            if (!meetsReqs) {
              return getEncounterText(scene, `${namespace}.invalid_selection`) ?? null;
            }

            return null;
          };

          return selectPokemonForOption(scene, onPokemonSelected, undefined, selectableFilter);
        })
        .withOptionPhase(async (scene: BattleScene) => {
          // Choose Expensive Option
          const encounter = scene.currentBattle.mysteryEncounter!;
          const chosenPokemon = encounter.misc.chosenPokemon;
          const modifiers = encounter.misc.modifiers;

          for (const modType of modifiers) {
            await applyModifierTypeToPlayerPokemon(scene, chosenPokemon, modType);
          }

          leaveEncounterWithoutBattle(scene);
        })
        .withPostOptionPhase(async (scene: BattleScene) => {
          // Status applied after dealer leaves (to make thematic sense)
          const encounter = scene.currentBattle.mysteryEncounter!;
          const chosenPokemon = encounter.misc.chosenPokemon;

          // Roll for poison (20%)
          if (randSeedInt(10) < 2) {
            if (chosenPokemon.trySetStatus(StatusEffect.POISON)) {
              // Poison applied
              queueEncounterMessage(scene, `${namespace}.poison`);
            } else {
              // Pokemon immune or something else prevents status
              queueEncounterMessage(scene, `${namespace}.no_bad_effects`);
            }
          } else {
            queueEncounterMessage(scene, `${namespace}.no_bad_effects`);
          }

          setEncounterExp(scene, [chosenPokemon.id], 100);

          chosenPokemon.updateInfo();
        })
        .build()
    )
    .withSimpleOption(
      {
        buttonLabel: `${namespace}.option.3.label`,
        buttonTooltip: `${namespace}.option.3.tooltip`,
        selected: [
          {
            text: `${namespace}.option.3.selected`,
            speaker: `${namespace}.speaker`
          }
        ]
      },
      async (scene: BattleScene) => {
        // Leave encounter with no rewards or exp
        leaveEncounterWithoutBattle(scene, true);
        return true;
      }
    )
    .build();
