import { EnemyPartyConfig, initBattleWithEnemyConfig, leaveEncounterWithoutBattle, selectPokemonForOption, setEncounterRewards, transitionMysteryEncounterIntroVisuals, } from "#app/data/mystery-encounters/utils/encounter-phase-utils";
import Pokemon, { PlayerPokemon, PokemonMove } from "#app/field/pokemon";
import { MysteryEncounterType } from "#enums/mystery-encounter-type";
import { Species } from "#enums/species";
import BattleScene from "#app/battle-scene";
import MysteryEncounter, { MysteryEncounterBuilder } from "../mystery-encounter";
import { MysteryEncounterOptionBuilder } from "../mystery-encounter-option";
import { MysteryEncounterTier } from "#enums/mystery-encounter-tier";
import { MysteryEncounterOptionMode } from "#enums/mystery-encounter-option-mode";
import { getPokemonSpecies } from "#app/data/pokemon-species";
import { Moves } from "#enums/moves";
import { TrainerSlot } from "#app/data/trainer-config";
import PokemonData from "#app/system/pokemon-data";
import { Biome } from "#enums/biome";
import { EncounterAnim, EncounterBattleAnim } from "#app/data/battle-anims";
import { BattlerTagType } from "#enums/battler-tag-type";
import { getEncounterText, queueEncounterMessage } from "#app/data/mystery-encounters/utils/encounter-dialogue-utils";
import { LearnMovePhase, StatChangePhase } from "#app/phases";
import { BattleStat } from "#app/data/battle-stat";
import { MoveRequirement } from "#app/data/mystery-encounters/mystery-encounter-requirements";
import { DANCING_MOVES } from "#app/data/mystery-encounters/requirements/requirement-groups";
import { OptionSelectItem } from "#app/ui/abstact-option-select-ui-handler";
import { BattlerIndex } from "#app/battle";
import { catchPokemon } from "#app/data/mystery-encounters/utils/encounter-pokemon-utils";
import { PokeballType } from "#enums/pokeball";
import { modifierTypes } from "#app/modifier/modifier-type";

/** the i18n namespace for this encounter */
const namespace = "mysteryEncounter:dancingLessons";

// Fire form
const BAILE_STYLE_BIOMES = [
  Biome.VOLCANO,
  Biome.BEACH,
  Biome.ISLAND,
  Biome.WASTELAND,
  Biome.MOUNTAIN,
  Biome.BADLANDS,
  Biome.DESERT
];

// Electric form
const POM_POM_STYLE_BIOMES = [
  Biome.CONSTRUCTION_SITE,
  Biome.POWER_PLANT,
  Biome.FACTORY,
  Biome.LABORATORY,
  Biome.SLUM,
  Biome.METROPOLIS,
  Biome.DOJO
];

// Psychic form
const PAU_STYLE_BIOMES = [
  Biome.JUNGLE,
  Biome.FAIRY_CAVE,
  Biome.MEADOW,
  Biome.PLAINS,
  Biome.GRASS,
  Biome.TALL_GRASS,
  Biome.FOREST
];

// Ghost form
const SENSU_STYLE_BIOMES = [
  Biome.RUINS,
  Biome.SWAMP,
  Biome.CAVE,
  Biome.ABYSS,
  Biome.GRAVEYARD,
  Biome.LAKE,
  Biome.TEMPLE
];

/**
 * Dancing Lessons encounter.
 * @see {@link https://github.com/AsdarDevelops/PokeRogue-Events/issues/130 | GitHub Issue #130}
 * @see For biome requirements check {@linkcode mysteryEncountersByBiome}
 */
export const DancingLessonsEncounter: MysteryEncounter =
  MysteryEncounterBuilder.withEncounterType(MysteryEncounterType.DANCING_LESSONS)
    .withEncounterTier(MysteryEncounterTier.GREAT)
    .withSceneWaveRangeRequirement(10, 180)
    .withIntroSpriteConfigs([]) // Uses a real Pokemon sprite instead of ME Intro Visuals
    .withAnimations(EncounterAnim.DANCE)
    .withHideWildIntroMessage(true)
    .withAutoHideIntroVisuals(false)
    .withCatchAllowed(true)
    .withOnVisualsStart((scene: BattleScene) => {
      const danceAnim = new EncounterBattleAnim(EncounterAnim.DANCE, scene.getEnemyPokemon()!, scene.getPlayerPokemon());
      danceAnim.play(scene);

      return true;
    })
    .withIntroDialogue([
      {
        text: `${namespace}.intro`,
      }
    ])
    .withTitle(`${namespace}.title`)
    .withDescription(`${namespace}.description`)
    .withQuery(`${namespace}.query`)
    .withOnInit((scene: BattleScene) => {
      const encounter = scene.currentBattle.mysteryEncounter;

      const species = getPokemonSpecies(Species.ORICORIO);
      const enemyPokemon = scene.addEnemyPokemon(species, scene.currentBattle.enemyLevels![0], TrainerSlot.NONE, false);
      if (!enemyPokemon.moveset.some(m => m && m.getMove().id === Moves.REVELATION_DANCE)) {
        if (enemyPokemon.moveset.length < 4) {
          enemyPokemon.moveset.push(new PokemonMove(Moves.REVELATION_DANCE));
        } else {
          enemyPokemon.moveset[0] = new PokemonMove(Moves.REVELATION_DANCE);
        }
      }

      // Set the form index based on the biome
      // Defaults to Baile style if somehow nothing matches
      const currentBiome = scene.arena.biomeType;
      if (BAILE_STYLE_BIOMES.includes(currentBiome)) {
        enemyPokemon.formIndex = 0;
      } else if (POM_POM_STYLE_BIOMES.includes(currentBiome)) {
        enemyPokemon.formIndex = 1;
      } else if (PAU_STYLE_BIOMES.includes(currentBiome)) {
        enemyPokemon.formIndex = 2;
      } else if (SENSU_STYLE_BIOMES.includes(currentBiome)) {
        enemyPokemon.formIndex = 3;
      } else {
        enemyPokemon.formIndex = 0;
      }

      const oricorioData = new PokemonData(enemyPokemon);

      // Adds a real Pokemon sprite to the field (required for the animation)
      scene.currentBattle.enemyParty[0] = enemyPokemon;
      scene.field.add(enemyPokemon);

      const config: EnemyPartyConfig = {
        levelAdditiveMultiplier: 1,
        pokemonConfigs: [{
          species: species,
          dataSource: oricorioData,
          isBoss: true,
          // Gets +1 to all stats on battle start
          tags: [BattlerTagType.MYSTERY_ENCOUNTER_POST_SUMMON],
          mysteryEncounterBattleEffects: (pokemon: Pokemon) => {
            queueEncounterMessage(pokemon.scene, `${namespace}.option.1.boss_enraged`);
            pokemon.scene.unshiftPhase(new StatChangePhase(pokemon.scene, pokemon.getBattlerIndex(), true, [BattleStat.ATK, BattleStat.DEF, BattleStat.SPATK, BattleStat.SPDEF, BattleStat.SPD], 1));
          }
        }],
      };
      encounter.enemyPartyConfigs = [config];
      encounter.misc = {
        oricorioData
      };

      return true;
    })
    .withOption(
      MysteryEncounterOptionBuilder
        .newOptionWithMode(MysteryEncounterOptionMode.DEFAULT)
        .withDialogue({
          buttonLabel: `${namespace}.option.1.label`,
          buttonTooltip: `${namespace}.option.1.tooltip`,
          selected: [
            {
              text: `${namespace}.option.1.selected`,
            },
          ],
        })
        .withOptionPhase(async (scene: BattleScene) => {
          // Pick battle
          const encounter = scene.currentBattle.mysteryEncounter;

          transitionMysteryEncounterIntroVisuals(scene, true, true, 500);

          encounter.startOfBattleEffects.push({
            sourceBattlerIndex: BattlerIndex.ENEMY,
            targets: [BattlerIndex.PLAYER],
            move: new PokemonMove(Moves.REVELATION_DANCE),
            ignorePp: true
          });

          setEncounterRewards(scene, { guaranteedModifierTypeFuncs: [modifierTypes.BATON], fillRemaining: true });
          await initBattleWithEnemyConfig(scene, encounter.enemyPartyConfigs[0]);
        })
        .build()
    )
    .withOption(
      MysteryEncounterOptionBuilder
        .newOptionWithMode(MysteryEncounterOptionMode.DEFAULT)
        .withDialogue({
          buttonLabel: `${namespace}.option.2.label`,
          buttonTooltip: `${namespace}.option.2.tooltip`,
          selected: [
            {
              text: `${namespace}.option.2.selected`,
            },
          ],
        })
        .withPreOptionPhase(async (scene: BattleScene) => {
          // Learn its Dance
          const encounter = scene.currentBattle.mysteryEncounter;

          const onPokemonSelected = (pokemon: PlayerPokemon) => {
            encounter.setDialogueToken("selectedPokemon", pokemon.getNameToRender());
            scene.unshiftPhase(new LearnMovePhase(scene, scene.getParty().indexOf(pokemon), Moves.REVELATION_DANCE));

            // Play animation again to "learn" the dance
            const danceAnim = new EncounterBattleAnim(EncounterAnim.DANCE, scene.getEnemyPokemon()!, scene.getPlayerPokemon());
            danceAnim.play(scene);
          };

          return selectPokemonForOption(scene, onPokemonSelected);
        })
        .withOptionPhase(async (scene: BattleScene) => {
          // Learn its Dance
          leaveEncounterWithoutBattle(scene, true);
        })
        .build()
    )
    .withOption(
      MysteryEncounterOptionBuilder
        .newOptionWithMode(MysteryEncounterOptionMode.DISABLED_OR_SPECIAL)
        .withPrimaryPokemonRequirement(new MoveRequirement(DANCING_MOVES)) // Will set option3PrimaryName and option3PrimaryMove dialogue tokens automatically
        .withDialogue({
          buttonLabel: `${namespace}.option.3.label`,
          buttonTooltip: `${namespace}.option.3.tooltip`,
          disabledButtonTooltip: `${namespace}.option.3.disabled_tooltip`,
          secondOptionPrompt: `${namespace}.option.3.select_prompt`,
          selected: [
            {
              text: `${namespace}.option.3.selected`,
            },
          ],
        })
        .withPreOptionPhase(async (scene: BattleScene) => {
          // Open menu for selecting pokemon with a Dancing move
          const encounter = scene.currentBattle.mysteryEncounter;
          const onPokemonSelected = (pokemon: PlayerPokemon) => {
            // Return the options for nature selection
            return pokemon.moveset
              .filter(move => move && DANCING_MOVES.includes(move.getMove().id))
              .map((move: PokemonMove) => {
                const option: OptionSelectItem = {
                  label: move.getName(),
                  handler: () => {
                    // Pokemon and second option selected
                    encounter.setDialogueToken("selectedPokemon", pokemon.getNameToRender());
                    encounter.setDialogueToken("selectedMove", move.getName());
                    encounter.misc.selectedMove = move;

                    return true;
                  },
                };
                return option;
              });
          };

          // Only Pokemon that have a Dancing move can be selected
          const selectableFilter = (pokemon: Pokemon) => {
            // If pokemon meets primary pokemon reqs, it can be selected
            const meetsReqs = encounter.options[2].pokemonMeetsPrimaryRequirements(scene, pokemon);
            if (!meetsReqs) {
              return getEncounterText(scene, `${namespace}.invalid_selection`) ?? null;
            }

            return null;
          };

          return selectPokemonForOption(scene, onPokemonSelected, undefined, selectableFilter);
        })
        .withOptionPhase(async (scene: BattleScene) => {
          // Show the Oricorio a dance, and recruit it
          const encounter = scene.currentBattle.mysteryEncounter;
          const oricorio = encounter.misc.oricorioData.toPokemon(scene);
          oricorio.passive = true;

          // Ensure the Oricorio's moveset gains the Dance move the player used
          const move = encounter.misc.selectedMove?.getMove().id;
          if (!oricorio.moveset.some(m => m.getMove().id === move)) {
            if (oricorio.moveset.length < 4) {
              oricorio.moveset.push(new PokemonMove(move));
            } else {
              oricorio.moveset[3] = new PokemonMove(move);
            }
          }

          transitionMysteryEncounterIntroVisuals(scene, true, true, 500);
          await catchPokemon(scene, oricorio, null, PokeballType.POKEBALL, false);
          leaveEncounterWithoutBattle(scene, true);
        })
        .build()
    )
    .build();
