import { generateModifierTypeOption, leaveEncounterWithoutBattle, queueEncounterMessage, selectPokemonForOption, setEncounterExp, updatePlayerMoney, } from "#app/data/mystery-encounters/mystery-encounter-utils";
import { StatusEffect } from "#app/data/status-effect";
import Pokemon, { PlayerPokemon } from "#app/field/pokemon";
import { modifierTypes } from "#app/modifier/modifier-type";
import { randSeedInt } from "#app/utils";
import { MysteryEncounterType } from "#enums/mystery-encounter-type";
import { Species } from "#enums/species";
import i18next from "i18next";
import BattleScene from "../../../battle-scene";
import IMysteryEncounter, { MysteryEncounterBuilder, MysteryEncounterTier, } from "../mystery-encounter";
import { EncounterOptionMode, MysteryEncounterOptionBuilder } from "../mystery-encounter-option";
import { MoneyRequirement } from "../mystery-encounter-requirements";

/** the i18n namespace for this encounter */
const namespace = "mysteryEncounter:shady_vitamin_dealer";

export const ShadyVitaminDealerEncounter: IMysteryEncounter =
  MysteryEncounterBuilder.withEncounterType(
    MysteryEncounterType.SHADY_VITAMIN_DEALER
  )
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
        x: 10,
        y: -1,
      },
      {
        spriteKey: "b2w2_veteran_m",
        fileRoot: "mystery-encounters",
        hasShadow: true,
        x: -10,
        y: 2,
      },
    ])
    .withIntroDialogue([
      {
        text: `${namespace}_intro_message`,
      },
      {
        text: `${namespace}_intro_dialogue`,
        speaker: `${namespace}_speaker`,
      },
    ])
    .withTitle(`${namespace}_title`)
    .withDescription(`${namespace}_description`)
    .withQuery(`${namespace}_query`)
    .withOption(
      new MysteryEncounterOptionBuilder()
        .withOptionMode(EncounterOptionMode.DISABLED_OR_DEFAULT)
        .withSceneMoneyRequirement(0, 2) // Wave scaling money multiplier of 2
        .withDialogue({
          buttonLabel: `${namespace}_option_1_label`,
          buttonTooltip: `${namespace}_option_1_tooltip`,
          selected: [
            {
              text: `${namespace}_option_selected`,
            },
          ],
        })
        .withPreOptionPhase(async (scene: BattleScene): Promise<boolean> => {
          const encounter = scene.currentBattle.mysteryEncounter;
          const onPokemonSelected = (pokemon: PlayerPokemon) => {
            // Update money
            updatePlayerMoney(scene, -(encounter.options[0].requirements[0] as MoneyRequirement).requiredMoney);
            // Calculate modifiers and dialogue tokens
            const modifiers = [
              generateModifierTypeOption(scene, modifierTypes.BASE_STAT_BOOSTER).type,
              generateModifierTypeOption(scene, modifierTypes.BASE_STAT_BOOSTER).type,
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
              return i18next.t(`${namespace}_invalid_selection`);
            }

            return null;
          };

          return selectPokemonForOption(scene, onPokemonSelected, null, selectableFilter);
        })
        .withOptionPhase(async (scene: BattleScene) => {
          // Choose Cheap Option
          const encounter = scene.currentBattle.mysteryEncounter;
          const chosenPokemon = encounter.misc.chosenPokemon;
          const modifiers = encounter.misc.modifiers;

          for (const modType of modifiers) {
            const modifier = modType.newModifier(chosenPokemon);
            await scene.addModifier(modifier, true, false, false, true);
          }
          scene.updateModifiers(true);

          leaveEncounterWithoutBattle(scene);
        })
        .withPostOptionPhase(async (scene: BattleScene) => {
          // Damage and status applied after dealer leaves (to make thematic sense)
          const encounter = scene.currentBattle.mysteryEncounter;
          const chosenPokemon = encounter.misc.chosenPokemon;

          // Pokemon takes 1/3 max HP damage
          const damage = Math.round(chosenPokemon.getMaxHp() / 3);
          chosenPokemon.hp = Math.max(chosenPokemon.hp - damage, 0);

          // Roll for poison (80%)
          if (randSeedInt(10) < 8) {
            if (chosenPokemon.trySetStatus(StatusEffect.TOXIC)) {
              // Toxic applied
              queueEncounterMessage(scene, `${namespace}_bad_poison`);
            } else {
              // Pokemon immune or something else prevents status
              queueEncounterMessage(scene, `${namespace}_damage_only`);
            }
          } else {
            queueEncounterMessage(scene, `${namespace}_damage_only`);
          }

          setEncounterExp(scene, [chosenPokemon.id], 100);

          chosenPokemon.updateInfo();
        })
        .build()
    )
    .withOption(
      new MysteryEncounterOptionBuilder()
        .withOptionMode(EncounterOptionMode.DISABLED_OR_DEFAULT)
        .withSceneMoneyRequirement(0, 5) // Wave scaling money multiplier of 5
        .withDialogue({
          buttonLabel: `${namespace}_option_2_label`,
          buttonTooltip: `${namespace}_option_2_tooltip`,
          selected: [
            {
              text: `${namespace}_option_selected`,
            },
          ],
        })
        .withPreOptionPhase(async (scene: BattleScene): Promise<boolean> => {
          const encounter = scene.currentBattle.mysteryEncounter;
          const onPokemonSelected = (pokemon: PlayerPokemon) => {
            // Update money
            updatePlayerMoney(scene, -(encounter.options[1].requirements[0] as MoneyRequirement).requiredMoney);
            // Calculate modifiers and dialogue tokens
            const modifiers = [
              generateModifierTypeOption(scene, modifierTypes.BASE_STAT_BOOSTER).type,
              generateModifierTypeOption(scene, modifierTypes.BASE_STAT_BOOSTER).type,
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
              return i18next.t(`${namespace}_invalid_selection`);
            }

            return null;
          };

          return selectPokemonForOption(scene, onPokemonSelected, null, selectableFilter);
        })
        .withOptionPhase(async (scene: BattleScene) => {
          // Choose Expensive Option
          const encounter = scene.currentBattle.mysteryEncounter;
          const chosenPokemon = encounter.misc.chosenPokemon;
          const modifiers = encounter.misc.modifiers;

          for (const modType of modifiers) {
            const modifier = modType.newModifier(chosenPokemon);
            await scene.addModifier(modifier, true, false, false, true);
          }
          scene.updateModifiers(true);

          leaveEncounterWithoutBattle(scene);
        })
        .withPostOptionPhase(async (scene: BattleScene) => {
          // Status applied after dealer leaves (to make thematic sense)
          const encounter = scene.currentBattle.mysteryEncounter;
          const chosenPokemon = encounter.misc.chosenPokemon;

          // Roll for poison (20%)
          if (randSeedInt(10) < 2) {
            if (chosenPokemon.trySetStatus(StatusEffect.POISON)) {
              // Poison applied
              queueEncounterMessage(scene, `${namespace}_poison`);
            } else {
              // Pokemon immune or something else prevents status
              queueEncounterMessage(scene, `${namespace}_no_bad_effects`);
            }
          } else {
            queueEncounterMessage(scene, `${namespace}_no_bad_effects`);
          }

          setEncounterExp(scene, [chosenPokemon.id], 100);

          chosenPokemon.updateInfo();
        })
        .build()
    )
    .withSimpleOption(
      {
        buttonLabel: `${namespace}_option_3_label`,
        buttonTooltip: `${namespace}_option_3_tooltip`,
      },
      async (scene: BattleScene) => {
        // Leave encounter with no rewards or exp
        leaveEncounterWithoutBattle(scene, true);
        return true;
      }
    )
    .build();
