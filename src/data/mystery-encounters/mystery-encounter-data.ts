import { MysteryEncounterTier } from "#app/data/mystery-encounters/mystery-encounter";
import { MysteryEncounterType } from "#enums/mystery-encounter-type";
import { BASE_MYSTERY_ENCOUNTER_SPAWN_WEIGHT } from "#app/data/mystery-encounters/mystery-encounters";
import { isNullOrUndefined } from "#app/utils";
import { EnemyPokemon, PlayerPokemon } from "field/pokemon";
import BattleScene from "../../battle-scene";
import { TempBattleStat } from "#app/data/temp-battle-stat";

export class MysteryEncounterData {
  encounteredEvents: [MysteryEncounterType, MysteryEncounterTier][] = [];
  encounterSpawnChance: number = BASE_MYSTERY_ENCOUNTER_SPAWN_WEIGHT;
  nextEncounterQueue: [MysteryEncounterType, integer][] = [];

  constructor(flags: MysteryEncounterData) {
    if (!isNullOrUndefined(flags)) {
      Object.assign(this, flags);
    }
  }
}

export class MysteryEncounterAuras {
  public auraList: Aura[];

  constructor() {
    this.auraList = [];
  }


  //AddAura(targetOrAura: number[] | Aura, auraStrength: number, duration: number, auraType: number, team: number, timeUntilActive: number = 0) {
  //  this.auraList.push(new Aura(targetOrAura, auraStrength, duration, auraType, team, timeUntilActive));
  //}

  AddAura(aura: Aura) {
    this.auraList.push(aura);
  }

  UpdateAurasDurations(scene: BattleScene) {
    for (let i = 0; i < this.auraList.length; i++) {
      if (this.auraList[i].timeUntilActive !== 0) {
        this.auraList[i].timeUntilActive -= 1; // removes a turn from the timeUntilActive
      } else {
        if (this.auraList[i].duration > 0) {
          this.auraList[i].duration -= 1; // removes a counter from the duration
          if (this.auraList[i].isInstant() && this.auraList[i].duration === 0 && this.auraList[i].timeUntilActive === 0) { // this checks if the aura is an instant effect
            this.TriggerInstantAura(this.auraList[i], scene);
          }
        }
      }
    }
    this.auraList = this.auraList.filter(aura => aura.duration !== 0 && aura.timeUntilActive !== 0); // this updates our list to make sure to only have things that are peristent or still counting down
  }

  /* this method will find all auras of a certain type and add up their total strengths.
   * For example, if you wanted to find the total strength of all luck related auras
   * or all income related auras. Note that this make the percentage additive.
   * This does not filter by pokemon or team
  */
  FindAuraTotals(auraType: number): number {
    let total = 0;
    const filteredAuras = this.FindAura(auraType);
    if (filteredAuras.length > 0) {
      for (let i = 0; i < filteredAuras.length; i++) {
        const auraValue = filteredAuras[i].auraStrength;
        if (auraType === AuraType.LUCK && auraValue === 0) { // this is used to check if luck has "Set to 0"
          total = 0.5;
          break;
        }
        total += filteredAuras[i].timeUntilActive > 0 ? 0 : auraValue; // this checks to make sure the aura is active before adding it to our totals
      }
    }
    return total;
  }

  FindAura(auraType: number): Aura[] { // this method will find all auras of a certain type (for example, all income related auras)
    return this.auraList.filter(auras => auras.auraType === auraType);
  }

  FindAurasByPokemon(pokemon: PlayerPokemon | EnemyPokemon, auraType?: number): Aura[] { // this method finds an aura by pokemon, with optional filtering for type
    const allAuras: Aura[] = [];
    const pokemonId = pokemon.id;
    const isPlayer = pokemon.isPlayer();
    auraType = auraType || 0;
    for (let i = 0; i < this.auraList.length; i++) {
      const auraTeam = this.auraList[i].team;
      if (this.auraList[i].auraType === auraType || auraType === 0) {
        if (this.auraList[i].target.includes(pokemonId) || this.auraList[i].target[0] === 0) { // the target[0] being 0 is our way of saying it's for all valid pokemon
          if ((auraTeam === TeamTarget.ALL || auraTeam === TeamTarget.PLAYER) && isPlayer) {
            allAuras.push(this.auraList[i]);
            continue;
          }
          if ((auraTeam === TeamTarget.ALL || auraTeam === TeamTarget.ENEMY) && !isPlayer) {
            allAuras.push(this.auraList[i]);
            continue;
          }
        }
      }
    }
    return allAuras;
  }

  UpdateStats(pokemon: PlayerPokemon | EnemyPokemon) {
    const pokemonAuras = this.FindAurasByPokemon(pokemon);
    const pokemonSummonData = pokemon.summonData ? pokemon.summonData : pokemon.getPrimeSummonData();
    if (pokemonAuras.length > 0) {
      for (let i = 0; i < pokemonSummonData.battleStats.length; i++) {
        const mysteryStatAura = pokemonAuras.filter(aura => aura.auraType === auraStatMap[i]);
        const totalStatChange = mysteryStatAura.reduce((accumulator, current) => accumulator + current.auraStrength, 0);
        pokemonSummonData.battleStats[i] += mysteryStatAura.length > 0 ? totalStatChange : 0;
      }
    }
    pokemon.updateInfo();
  }

  TriggerInstantAura(aura: Aura, scene: BattleScene) {
    if (aura.auraType === AuraType.MONEY) {
      scene.addMoney(aura.auraStrength);
    }
  }
}

export class Aura {
  public target: number[]; // this can be used to target specific pokemon (using an array of pokemon ID) or all pokemon (using [-1])
  public auraStrength: number; // this is the amount boosted/reduced - can be positive or negative
  public duration: number; // this is how many waves the aura lasts for; use a number > 0 for timed auras, or -1 for auras for the rest of the game
  public auraType: number; // this is the aura type - for now, for example, what stat will be changed
  public team: number; // this is the team using the team enum of Team.PLAYER, Team.ENEMY, Team.ALL to target the player, enemy or everyone respectively.
  public timeUntilActive: number; // this will be the amount of waves until an aura is active; for example, a positive aura being activated when a negative one runs out.

  constructor(target: number[], auraStrength: number, duration: number, auraType: number, team: number, timeUntilActive: number) {
    this.target = target;
    this.auraStrength = auraStrength;
    this.duration = duration;
    this.auraType = auraType;
    this.team = team;
    this.timeUntilActive = timeUntilActive;
  }

  isInstant() {
    return this.auraType === AuraType.MONEY || this.auraType === AuraType.CANDY;
  }
}

export enum TeamTarget {
  ENEMY = -1,
  ALL,
  PLAYER
}

export enum AuraType {
  INCOME,
  MONEY,
  ATK,
  DEF,
  SPATK,
  SPDEF,
  ACC,
  EVA,
  SPD,
  LUCK,
  XP,
  CANDY,
  PP,
  PASSIVE,
  CRIT
}

export function getAuraName(aura: AuraType) {
  switch (aura) {
  case AuraType.INCOME:
    return "INCOME";
  case AuraType.MONEY:
    return "MONEY";
  case AuraType.ATK:
    return "ATK";
  case AuraType.SPATK:
    return "SP. ATK";
  case AuraType.DEF:
    return "DEF";
  case AuraType.SPDEF:
    return "SP. DEF";
  case AuraType.SPD:
    return "SPEED";
  case AuraType.ACC:
    return "ACC";
  case AuraType.EVA:
    return "EVA";
  case AuraType.LUCK:
    return "LUCK";
  case AuraType.XP:
    return "EXP";
  case AuraType.CANDY:
    return "CANDY";
  case AuraType.PP:
    return "PP";
  case AuraType.PASSIVE:
    return "PASSIVE";
  case AuraType.CRIT:
    return "CRIT";
  default:
    return "???";
  }
}

export function ConvertAuraToBattleStat(auraType: AuraType): Number {
  switch (auraType) {
  case AuraType.ATK:
    return TempBattleStat.ATK;
  case AuraType.DEF:
    return TempBattleStat.DEF;
  case AuraType.SPATK:
    return TempBattleStat.SPATK;
  case AuraType.SPDEF:
    return TempBattleStat.SPDEF;
  case AuraType.ACC:
    return TempBattleStat.ACC;
  case AuraType.EVA:
    return -1;
  case AuraType.SPD:
    return TempBattleStat.SPD;
  case AuraType.CRIT:
    return TempBattleStat.CRIT;
  default:
    return -1;
  }
}

export const auraStatMap = [AuraType.ATK, AuraType.DEF, AuraType.SPATK, AuraType.SPDEF, AuraType.ACC, AuraType.EVA, AuraType.SPD];

