import { MoveCategory } from "#app/data/move";
import { EncounterOptionMode, MysteryEncounterOptionBuilder } from "#app/data/mystery-encounters/mystery-encounter-option";
import {
  generateModifierTypeOption,
  leaveEncounterWithoutBattle,
  selectPokemonForOption,
  setEncounterExp,
  setEncounterRewards,
} from "#app/data/mystery-encounters/mystery-encounter-utils";
import { TempBattleStat } from "#app/data/temp-battle-stat";
import { PlayerPokemon, PokemonMove } from "#app/field/pokemon";
import { modifierTypes } from "#app/modifier/modifier-type";
import { OptionSelectItem } from "#app/ui/abstact-option-select-ui-handler";
import { MysteryEncounterType } from "#enums/mystery-encounter-type";
import BattleScene from "../../../battle-scene";
import IMysteryEncounter, {
  MysteryEncounterBuilder,
  MysteryEncounterTier,
} from "../mystery-encounter";

/** i18n namespace for the encounter */
const namespace = "mysteryEncounter:field_trip";

export const FieldTripEncounter: IMysteryEncounter =
  MysteryEncounterBuilder.withEncounterType(MysteryEncounterType.FIELD_TRIP)
    .withEncounterTier(MysteryEncounterTier.COMMON)
    .withSceneWaveRangeRequirement(10, 180)
    .withIntroSpriteConfigs([
      {
        spriteKey: "preschooler_m",
        fileRoot: "trainer",
        hasShadow: true,
      },
      {
        spriteKey: "teacher",
        fileRoot: "mystery-encounters",
        hasShadow: true,
      },
      {
        spriteKey: "preschooler_f",
        fileRoot: "trainer",
        hasShadow: true,
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
    .withHideIntroVisuals(false)
    .withTitle(`${namespace}_title`)
    .withDescription(`${namespace}_description`)
    .withQuery(`${namespace}_query`)
    .withOption(
      new MysteryEncounterOptionBuilder()
        .withOptionMode(EncounterOptionMode.DEFAULT)
        .withDialogue({
          buttonLabel: `${namespace}_option_1_label`,
          buttonTooltip: `${namespace}_option_1_tooltip`,
          secondOptionPrompt: `${namespace}_second_option_prompt`,
          selected: [
            {
              text: `${namespace}_option_selected`,
            },
          ],
        })
        .withPreOptionPhase(async (scene: BattleScene): Promise<boolean> => {
          const encounter = scene.currentBattle.mysteryEncounter;
          const onPokemonSelected = (pokemon: PlayerPokemon) => {
            // Return the options for Pokemon move valid for this option
            return pokemon.moveset.map((move: PokemonMove) => {
              const option: OptionSelectItem = {
                label: move.getName(),
                handler: () => {
                  // Pokemon and move selected
                  const correctMove = move.getMove().category === MoveCategory.PHYSICAL;
                  encounter.setDialogueToken("moveCategory", "Physical");
                  if (!correctMove) {
                    encounter.options[0].dialogue.selected = [
                      {
                        text: `${namespace}_option_incorrect`,
                        speaker: `${namespace}_speaker`,
                      },
                      {
                        text: `${namespace}_lesson_learned`,
                      },
                    ];
                    setEncounterExp(scene, scene.getParty().map((p) => p.id), 50);
                  } else {
                    encounter.setDialogueToken("pokeName", pokemon.name);
                    encounter.setDialogueToken("move", move.getName());
                    encounter.options[0].dialogue.selected = [
                      {
                        text: `${namespace}_option_selected`,
                      },
                    ];
                    setEncounterExp(scene, [pokemon.id], 100);
                  }
                  encounter.misc = {
                    correctMove: correctMove,
                  };
                  return true;
                },
              };
              return option;
            });
          };

          return selectPokemonForOption(scene, onPokemonSelected);
        })
        .withOptionPhase(async (scene: BattleScene) => {
          const encounter = scene.currentBattle.mysteryEncounter;
          if (encounter.misc.correctMove) {
            const modifiers = [
              generateModifierTypeOption(scene, modifierTypes.TEMP_STAT_BOOSTER, [TempBattleStat.ATK]),
              generateModifierTypeOption(scene, modifierTypes.TEMP_STAT_BOOSTER, [TempBattleStat.DEF]),
              generateModifierTypeOption(scene, modifierTypes.TEMP_STAT_BOOSTER, [TempBattleStat.SPD]),
              generateModifierTypeOption(scene, modifierTypes.DIRE_HIT),
            ];

            setEncounterRewards(scene, { guaranteedModifierTypeOptions: modifiers, fillRemaining: false });
          }

          leaveEncounterWithoutBattle(scene, !encounter.misc.correctMove);
        })
        .build()
    )
    .withOption(
      new MysteryEncounterOptionBuilder()
        .withOptionMode(EncounterOptionMode.DEFAULT)
        .withDialogue({
          buttonLabel: `${namespace}_option_2_label`,
          buttonTooltip: `${namespace}_option_2_tooltip`,
          secondOptionPrompt: `${namespace}_second_option_prompt`,
          selected: [
            {
              text: `${namespace}_option_selected`,
            },
          ],
        })
        .withPreOptionPhase(async (scene: BattleScene): Promise<boolean> => {
          const encounter = scene.currentBattle.mysteryEncounter;
          const onPokemonSelected = (pokemon: PlayerPokemon) => {
            // Return the options for Pokemon move valid for this option
            return pokemon.moveset.map((move: PokemonMove) => {
              const option: OptionSelectItem = {
                label: move.getName(),
                handler: () => {
                  // Pokemon and move selected
                  const correctMove = move.getMove().category === MoveCategory.SPECIAL;
                  encounter.setDialogueToken("moveCategory", "Special");
                  if (!correctMove) {
                    encounter.options[1].dialogue.selected = [
                      {
                        text: `${namespace}_option_incorrect`,
                        speaker: `${namespace}_speaker`,
                      },
                      {
                        text: `${namespace}_lesson_learned`,
                      },
                    ];
                    setEncounterExp(scene, scene.getParty().map((p) => p.id), 50);
                  } else {
                    encounter.setDialogueToken("pokeName", pokemon.name);
                    encounter.setDialogueToken("move", move.getName());
                    encounter.options[1].dialogue.selected = [
                      {
                        text: `${namespace}_option_selected`,
                      },
                    ];
                    setEncounterExp(scene, [pokemon.id], 100);
                  }
                  encounter.misc = {
                    correctMove: correctMove,
                  };
                  return true;
                },
              };
              return option;
            });
          };

          return selectPokemonForOption(scene, onPokemonSelected);
        })
        .withOptionPhase(async (scene: BattleScene) => {
          const encounter = scene.currentBattle.mysteryEncounter;
          if (encounter.misc.correctMove) {
            const modifiers = [
              generateModifierTypeOption(scene, modifierTypes.TEMP_STAT_BOOSTER, [TempBattleStat.SPATK]),
              generateModifierTypeOption(scene, modifierTypes.TEMP_STAT_BOOSTER, [TempBattleStat.SPDEF]),
              generateModifierTypeOption(scene, modifierTypes.TEMP_STAT_BOOSTER, [TempBattleStat.SPD]),
              generateModifierTypeOption(scene, modifierTypes.DIRE_HIT),
            ];

            setEncounterRewards(scene, { guaranteedModifierTypeOptions: modifiers, fillRemaining: false });
          }

          leaveEncounterWithoutBattle(scene, !encounter.misc.correctMove);
        })
        .build()
    )
    .withOption(
      new MysteryEncounterOptionBuilder()
        .withOptionMode(EncounterOptionMode.DEFAULT)
        .withDialogue({
          buttonLabel: `${namespace}_option_3_label`,
          buttonTooltip: `${namespace}_option_3_tooltip`,
          secondOptionPrompt: `${namespace}_second_option_prompt`,
          selected: [
            {
              text: `${namespace}_option_selected`,
            },
          ],
        })
        .withPreOptionPhase(async (scene: BattleScene): Promise<boolean> => {
          const encounter = scene.currentBattle.mysteryEncounter;
          const onPokemonSelected = (pokemon: PlayerPokemon) => {
            // Return the options for Pokemon move valid for this option
            return pokemon.moveset.map((move: PokemonMove) => {
              const option: OptionSelectItem = {
                label: move.getName(),
                handler: () => {
                  // Pokemon and move selected
                  const correctMove = move.getMove().category === MoveCategory.STATUS;
                  encounter.setDialogueToken("moveCategory", "Status");
                  if (!correctMove) {
                    encounter.options[2].dialogue.selected = [
                      {
                        text: `${namespace}_option_incorrect`,
                        speaker: `${namespace}_speaker`,
                      },
                      {
                        text: `${namespace}_lesson_learned`,
                      },
                    ];
                    setEncounterExp(
                      scene,
                      scene.getParty().map((p) => p.id),
                      50
                    );
                  } else {
                    encounter.setDialogueToken("pokeName", pokemon.name);
                    encounter.setDialogueToken("move", move.getName());
                    encounter.options[2].dialogue.selected = [
                      {
                        text: `${namespace}_option_selected`,
                      },
                    ];
                    setEncounterExp(scene, [pokemon.id], 100);
                  }
                  encounter.misc = {
                    correctMove: correctMove,
                  };
                  return true;
                },
              };
              return option;
            });
          };

          return selectPokemonForOption(scene, onPokemonSelected);
        })
        .withOptionPhase(async (scene: BattleScene) => {
          const encounter = scene.currentBattle.mysteryEncounter;
          if (encounter.misc.correctMove) {
            const modifiers = [
              generateModifierTypeOption(scene, modifierTypes.TEMP_STAT_BOOSTER, [TempBattleStat.ACC]),
              generateModifierTypeOption(scene, modifierTypes.TEMP_STAT_BOOSTER, [TempBattleStat.SPD]),
              generateModifierTypeOption(scene, modifierTypes.GREAT_BALL),
              generateModifierTypeOption(scene, modifierTypes.IV_SCANNER),
            ];

            setEncounterRewards(scene, { guaranteedModifierTypeOptions: modifiers, fillRemaining: false });
          }

          leaveEncounterWithoutBattle(scene, !encounter.misc.correctMove);
        })
        .build()
    )
    .build();
