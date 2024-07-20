import BattleScene from "#app/battle-scene";
import i18next from "i18next";
import { isNullOrUndefined, randSeedInt } from "#app/utils";
import { PokemonHeldItemModifier } from "#app/modifier/modifier";
import { VictoryPhase } from "#app/phases";
import { EnemyPokemon, PlayerPokemon } from "#app/field/pokemon";
import { doPokeballBounceAnim, getPokeballAtlasKey, getPokeballCatchMultiplier, getPokeballTintColor, PokeballType } from "#app/data/pokeball";
import { PlayerGender } from "#enums/player-gender";
import { addPokeballCaptureStars, addPokeballOpenParticles } from "#app/field/anims";
import { getStatusEffectCatchRateMultiplier, StatusEffect } from "#app/data/status-effect";
import { BattlerIndex } from "#app/battle";
import { achvs } from "#app/system/achv";
import { Mode } from "#app/ui/ui";
import { PartyOption, PartyUiMode } from "#app/ui/party-ui-handler";
import { Species } from "#enums/species";
import { Type } from "#app/data/type";
import PokemonSpecies, { getPokemonSpecies, speciesStarters } from "#app/data/pokemon-species";
import { showEncounterText } from "#app/data/mystery-encounters/utils/encounter-dialogue-utils";

/**
 *
 * Will never remove the player's last non-fainted Pokemon (if they only have 1)
 * Otherwise, picks a Pokemon completely at random and removes from the party
 * @param scene
 * @param isAllowedInBattle - default false. If true, only picks from unfainted mons. If there is only 1 unfainted mon left and doNotReturnLastAbleMon is also true, will return fainted mon
 * @param doNotReturnLastAbleMon - If true, will never return the last unfainted pokemon in the party. Useful when this function is being used to determine what Pokemon to remove from the party (Don't want to remove last unfainted)
 * @returns
 */
export function getRandomPlayerPokemon(scene: BattleScene, isAllowedInBattle: boolean = false, doNotReturnLastAbleMon: boolean = false): PlayerPokemon {
  const party = scene.getParty();
  let chosenIndex: number;
  let chosenPokemon: PlayerPokemon;
  const unfaintedMons = party.filter(p => p.isAllowedInBattle());
  const faintedMons = party.filter(p => !p.isAllowedInBattle());

  if (doNotReturnLastAbleMon && unfaintedMons.length === 1) {
    chosenIndex = randSeedInt(faintedMons.length);
    chosenPokemon = faintedMons.at(chosenIndex);
  } else if (isAllowedInBattle) {
    chosenIndex = randSeedInt(unfaintedMons.length);
    chosenPokemon = unfaintedMons.at(chosenIndex);
  } else {
    chosenIndex = randSeedInt(party.length);
    chosenPokemon = party.at(chosenIndex);
  }

  return chosenPokemon;
}

/**
 * Ties are broken by whatever mon is closer to the front of the party
 * @param scene
 * @param unfainted - default false. If true, only picks from unfainted mons.
 * @returns
 */
export function getHighestLevelPlayerPokemon(scene: BattleScene, unfainted: boolean = false): PlayerPokemon {
  const party = scene.getParty();
  let pokemon: PlayerPokemon;
  party.every(p => {
    if (unfainted && p.isFainted()) {
      return true;
    }

    pokemon = pokemon ? pokemon?.level < p?.level ? p : pokemon : p;
    return true;
  });

  return pokemon;
}

/**
 * Ties are broken by whatever mon is closer to the front of the party
 * @param scene
 * @param unfainted - default false. If true, only picks from unfainted mons.
 * @returns
 */
export function getLowestLevelPlayerPokemon(scene: BattleScene, unfainted: boolean = false): PlayerPokemon {
  const party = scene.getParty();
  let pokemon: PlayerPokemon;
  party.every(p => {
    if (unfainted && p.isFainted()) {
      return true;
    }

    pokemon = pokemon ? pokemon?.level > p?.level ? p : pokemon : p;
    return true;
  });

  return pokemon;
}

/**
 *
 * NOTE: This returns ANY random species, including those locked behind eggs, etc.
 * @param starterTiers
 * @param excludedSpecies
 * @param types
 * @returns
 */
export function getRandomSpeciesByStarterTier(starterTiers: number | [number, number], excludedSpecies?: Species[], types?: Type[]): Species {
  let min = Array.isArray(starterTiers) ? starterTiers[0] : starterTiers;
  let max = Array.isArray(starterTiers) ? starterTiers[1] : starterTiers;

  let filteredSpecies: [PokemonSpecies, number][] = Object.keys(speciesStarters)
    .map(s => [parseInt(s) as Species, speciesStarters[s] as number])
    .filter(s => getPokemonSpecies(s[0]) && (!excludedSpecies || !excludedSpecies.includes(s[0])))
    .map(s => [getPokemonSpecies(s[0]), s[1]]);

  if (!isNullOrUndefined(types) && types.length > 0) {
    filteredSpecies = filteredSpecies.filter(s => types.includes(s[0].type1) || types.includes(s[0].type2));
  }

  // If no filtered mons exist at specified starter tiers, will expand starter search range until there are
  // Starts by decrementing starter tier min until it is 0, then increments tier max up to 10
  let tryFilterStarterTiers: [PokemonSpecies, number][] = filteredSpecies.filter(s => (s[1] >= min && s[1] <= max));
  while (tryFilterStarterTiers.length === 0 && (min !== 0 && max !== 10)) {
    if (min > 0) {
      min--;
    } else {
      max++;
    }

    tryFilterStarterTiers = filteredSpecies.filter(s => s[1] >= min && s[1] <= max);
  }

  if (tryFilterStarterTiers.length > 0) {
    const index = randSeedInt(tryFilterStarterTiers.length);
    return Phaser.Math.RND.shuffle(tryFilterStarterTiers)[index][0].speciesId;
  }

  return Species.BULBASAUR;
}

export function koPlayerPokemon(pokemon: PlayerPokemon) {
  pokemon.hp = 0;
  pokemon.trySetStatus(StatusEffect.FAINT);
  pokemon.updateInfo();
}

/**
 * Alternative to using AttemptCapturePhase
 * Assumes player sprite is visible on the screen (this is intended for non-combat uses)
 *
 * Can await returned promise to wait for throw animation completion before continuing
 *
 * @param scene
 * @param pokemon
 * @param pokeballType
 * @param ballTwitchRate - can pass custom ball catch rates (for special events, like safari)
 */
export function trainerThrowPokeball(scene: BattleScene, pokemon: EnemyPokemon, pokeballType: PokeballType, ballTwitchRate?: number): Promise<boolean> {
  const originalY: number = pokemon.y;

  if (!ballTwitchRate) {
    const _3m = 3 * pokemon.getMaxHp();
    const _2h = 2 * pokemon.hp;
    const catchRate = pokemon.species.catchRate;
    const pokeballMultiplier = getPokeballCatchMultiplier(this.pokeballType);
    const statusMultiplier = pokemon.status ? getStatusEffectCatchRateMultiplier(pokemon.status.effect) : 1;
    const x = Math.round((((_3m - _2h) * catchRate * pokeballMultiplier) / _3m) * statusMultiplier);
    ballTwitchRate = Math.round(65536 / Math.sqrt(Math.sqrt(255 / x)));
  }

  const fpOffset = pokemon.getFieldPositionOffset();
  const pokeballAtlasKey = getPokeballAtlasKey(pokeballType);
  const pokeball: Phaser.GameObjects.Sprite = scene.addFieldSprite(16 + 75, 80 + 25, "pb", pokeballAtlasKey);
  pokeball.setOrigin(0.5, 0.625);
  scene.field.add(pokeball);

  scene.time.delayedCall(300, () => {
    scene.field.moveBelow(pokeball as Phaser.GameObjects.GameObject, pokemon);
  });

  return new Promise(resolve => {
    scene.trainer.setTexture(`trainer_${scene.gameData.gender === PlayerGender.FEMALE ? "f" : "m"}_back_pb`);
    scene.time.delayedCall(512, () => {
      scene.playSound("pb_throw");

      // Trainer throw frames
      scene.trainer.setFrame("2");
      scene.time.delayedCall(256, () => {
        scene.trainer.setFrame("3");
        scene.time.delayedCall(768, () => {
          scene.trainer.setTexture(`trainer_${scene.gameData.gender === PlayerGender.FEMALE ? "f" : "m"}_back`);
        });
      });

      // Pokeball move and catch logic
      scene.tweens.add({
        targets: pokeball,
        x: { value: 236 + fpOffset[0], ease: "Linear" },
        y: { value: 16 + fpOffset[1], ease: "Cubic.easeOut" },
        duration: 500,
        onComplete: () => {
          pokeball.setTexture("pb", `${pokeballAtlasKey}_opening`);
          scene.time.delayedCall(17, () => pokeball.setTexture("pb", `${pokeballAtlasKey}_open`));
          scene.playSound("pb_rel");
          pokemon.tint(getPokeballTintColor(pokeballType));

          addPokeballOpenParticles(scene, pokeball.x, pokeball.y, pokeballType);

          scene.tweens.add({
            targets: pokemon,
            duration: 500,
            ease: "Sine.easeIn",
            scale: 0.25,
            y: 20,
            onComplete: () => {
              pokeball.setTexture("pb", `${pokeballAtlasKey}_opening`);
              pokemon.setVisible(false);
              scene.playSound("pb_catch");
              scene.time.delayedCall(17, () => pokeball.setTexture("pb", `${pokeballAtlasKey}`));

              const doShake = () => {
                let shakeCount = 0;
                const pbX = pokeball.x;
                const shakeCounter = scene.tweens.addCounter({
                  from: 0,
                  to: 1,
                  repeat: 4,
                  yoyo: true,
                  ease: "Cubic.easeOut",
                  duration: 250,
                  repeatDelay: 500,
                  onUpdate: t => {
                    if (shakeCount && shakeCount < 4) {
                      const value = t.getValue();
                      const directionMultiplier = shakeCount % 2 === 1 ? 1 : -1;
                      pokeball.setX(pbX + value * 4 * directionMultiplier);
                      pokeball.setAngle(value * 27.5 * directionMultiplier);
                    }
                  },
                  onRepeat: () => {
                    if (!pokemon.species.isObtainable()) {
                      shakeCounter.stop();
                      failCatch(scene, pokemon, originalY, pokeball, pokeballType).then(() => resolve(false));
                    } else if (shakeCount++ < 3) {
                      if (randSeedInt(65536) < ballTwitchRate) {
                        scene.playSound("pb_move");
                      } else {
                        shakeCounter.stop();
                        failCatch(scene, pokemon, originalY, pokeball, pokeballType).then(() => resolve(false));
                      }
                    } else {
                      scene.playSound("pb_lock");
                      addPokeballCaptureStars(scene, pokeball);

                      const pbTint = scene.add.sprite(pokeball.x, pokeball.y, "pb", "pb");
                      pbTint.setOrigin(pokeball.originX, pokeball.originY);
                      pbTint.setTintFill(0);
                      pbTint.setAlpha(0);
                      scene.field.add(pbTint);
                      scene.tweens.add({
                        targets: pbTint,
                        alpha: 0.375,
                        duration: 200,
                        easing: "Sine.easeOut",
                        onComplete: () => {
                          scene.tweens.add({
                            targets: pbTint,
                            alpha: 0,
                            duration: 200,
                            easing: "Sine.easeIn",
                            onComplete: () => pbTint.destroy()
                          });
                        }
                      });
                    }
                  },
                  onComplete: () => {
                    catchPokemon(scene, pokemon, pokeball, pokeballType).then(() => resolve(true));
                  }
                });
              };

              scene.time.delayedCall(250, () => doPokeballBounceAnim(scene, pokeball, 16, 72, 350, doShake));
            }
          });
        }
      });
    });
  });
}

function failCatch(scene: BattleScene, pokemon: EnemyPokemon, originalY: number, pokeball: Phaser.GameObjects.Sprite, pokeballType: PokeballType) {
  return new Promise<void>(resolve => {
    scene.playSound("pb_rel");
    pokemon.setY(originalY);
    if (pokemon.status?.effect !== StatusEffect.SLEEP) {
      pokemon.cry(pokemon.getHpRatio() > 0.25 ? undefined : { rate: 0.85 });
    }
    pokemon.tint(getPokeballTintColor(pokeballType));
    pokemon.setVisible(true);
    pokemon.untint(250, "Sine.easeOut");

    const pokeballAtlasKey = getPokeballAtlasKey(pokeballType);
    pokeball.setTexture("pb", `${pokeballAtlasKey}_opening`);
    scene.time.delayedCall(17, () => pokeball.setTexture("pb", `${pokeballAtlasKey}_open`));

    scene.tweens.add({
      targets: pokemon,
      duration: 250,
      ease: "Sine.easeOut",
      scale: 1
    });

    scene.currentBattle.lastUsedPokeball = pokeballType;
    removePb(scene, pokeball);

    scene.ui.showText(i18next.t("battle:pokemonBrokeFree", { pokemonName: pokemon.name }), null, () => resolve(), null, true);
  });
}

function catchPokemon(scene: BattleScene, pokemon: EnemyPokemon, pokeball: Phaser.GameObjects.Sprite, pokeballType: PokeballType): Promise<void> {
  scene.unshiftPhase(new VictoryPhase(scene, BattlerIndex.ENEMY));

  const speciesForm = !pokemon.fusionSpecies ? pokemon.getSpeciesForm() : pokemon.getFusionSpeciesForm();

  if (speciesForm.abilityHidden && (pokemon.fusionSpecies ? pokemon.fusionAbilityIndex : pokemon.abilityIndex) === speciesForm.getAbilityCount() - 1) {
    scene.validateAchv(achvs.HIDDEN_ABILITY);
  }

  if (pokemon.species.subLegendary) {
    scene.validateAchv(achvs.CATCH_SUB_LEGENDARY);
  }

  if (pokemon.species.legendary) {
    scene.validateAchv(achvs.CATCH_LEGENDARY);
  }

  if (pokemon.species.mythical) {
    scene.validateAchv(achvs.CATCH_MYTHICAL);
  }

  scene.pokemonInfoContainer.show(pokemon, true);

  scene.gameData.updateSpeciesDexIvs(pokemon.species.getRootSpeciesId(true), pokemon.ivs);

  return new Promise(resolve => {
    scene.ui.showText(i18next.t("battle:pokemonCaught", { pokemonName: pokemon.name }), null, () => {
      const end = () => {
        scene.pokemonInfoContainer.hide();
        removePb(scene, pokeball);
        resolve();
      };
      const removePokemon = () => {
        scene.field.remove(pokemon, true);
      };
      const addToParty = () => {
        const newPokemon = pokemon.addToParty(pokeballType);
        const modifiers = scene.findModifiers(m => m instanceof PokemonHeldItemModifier, false);
        if (scene.getParty().filter(p => p.isShiny()).length === 6) {
          scene.validateAchv(achvs.SHINY_PARTY);
        }
        Promise.all(modifiers.map(m => scene.addModifier(m, true))).then(() => {
          scene.updateModifiers(true);
          removePokemon();
          if (newPokemon) {
            newPokemon.loadAssets().then(end);
          } else {
            end();
          }
        });
      };
      Promise.all([pokemon.hideInfo(), scene.gameData.setPokemonCaught(pokemon)]).then(() => {
        if (scene.getParty().length === 6) {
          const promptRelease = () => {
            scene.ui.showText(i18next.t("battle:partyFull", { pokemonName: pokemon.name }), null, () => {
              scene.pokemonInfoContainer.makeRoomForConfirmUi();
              scene.ui.setMode(Mode.CONFIRM, () => {
                scene.ui.setMode(Mode.PARTY, PartyUiMode.RELEASE, 0, (slotIndex: integer, _option: PartyOption) => {
                  scene.ui.setMode(Mode.MESSAGE).then(() => {
                    if (slotIndex < 6) {
                      addToParty();
                    } else {
                      promptRelease();
                    }
                  });
                });
              }, () => {
                scene.ui.setMode(Mode.MESSAGE).then(() => {
                  removePokemon();
                  end();
                });
              });
            });
          };
          promptRelease();
        } else {
          addToParty();
        }
      });
    }, 0, true);
  });
}

function removePb(scene: BattleScene, pokeball: Phaser.GameObjects.Sprite) {
  scene.tweens.add({
    targets: pokeball,
    duration: 250,
    delay: 250,
    ease: "Sine.easeIn",
    alpha: 0,
    onComplete: () => pokeball.destroy()
  });
}

export async function doPokemonFlee(scene: BattleScene, pokemon: EnemyPokemon): Promise<void> {
  await new Promise<void>(resolve => {
    scene.playSound("flee");
    // Ease pokemon out
    scene.tweens.add({
      targets: pokemon,
      x: "+=16",
      y: "-=16",
      alpha: 0,
      duration: 1000,
      ease: "Sine.easeIn",
      scale: pokemon.getSpriteScale(),
      onComplete: () => {
        pokemon.setVisible(false);
        scene.field.remove(pokemon, true);
        showEncounterText(scene, i18next.t("battle:pokemonFled", { pokemonName: pokemon.name }), 600, false)
          .then(() => {
            resolve();
          });
      }
    });
  });
}

export function doPlayerFlee(scene: BattleScene, pokemon: EnemyPokemon): Promise<void> {
  return new Promise<void>(resolve => {
    // Ease pokemon out
    scene.tweens.add({
      targets: pokemon,
      x: "+=16",
      y: "-=16",
      alpha: 0,
      duration: 1000,
      ease: "Sine.easeIn",
      scale: pokemon.getSpriteScale(),
      onComplete: () => {
        pokemon.setVisible(false);
        scene.field.remove(pokemon, true);
        showEncounterText(scene, i18next.t("battle:playerFled", { pokemonName: pokemon.name }), 600, false)
          .then(() => {
            resolve();
          });
      }
    });
  });
}
