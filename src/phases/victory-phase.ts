import BattleScene from "#app/battle-scene.js";
import { BattlerIndex, BattleType } from "#app/battle.js";
import { modifierTypes } from "#app/modifier/modifier-type.js";
import { ExpShareModifier, ExpBalanceModifier, MultipleParticipantExpBonusModifier, PokemonExpBoosterModifier } from "#app/modifier/modifier.js";
import * as Utils from "#app/utils.js";
import Overrides from "#app/overrides";
import { BattleEndPhase } from "./battle-end-phase";
import { NewBattlePhase } from "./new-battle-phase";
import { PokemonPhase } from "./pokemon-phase";
import { AddEnemyBuffModifierPhase } from "./add-enemy-buff-modifier-phase";
import { EggLapsePhase } from "./egg-lapse-phase";
import { ExpPhase } from "./exp-phase";
import { GameOverPhase } from "./game-over-phase";
import { ModifierRewardPhase } from "./modifier-reward-phase";
import { SelectModifierPhase } from "./select-modifier-phase";
import { ShowPartyExpBarPhase } from "./show-party-exp-bar-phase";
import { TrainerVictoryPhase } from "./trainer-victory-phase";
import { PokemonIncrementingStatModifier } from "#app/modifier/modifier";
import { handleMysteryEncounterVictory } from "#app/data/mystery-encounters/utils/encounter-phase-utils";

export class VictoryPhase extends PokemonPhase {
  /** If true, indicates that the phase is intended for EXP purposes only, and not to continue a battle to next phase */
  isExpOnly: boolean;

  constructor(scene: BattleScene, battlerIndex: BattlerIndex, isExpOnly: boolean = false) {
    super(scene, battlerIndex);

    this.isExpOnly = isExpOnly;
  }

  start() {
    super.start();

    this.scene.gameData.gameStats.pokemonDefeated++;

    const participantIds = this.scene.currentBattle.playerParticipantIds;
    const party = this.scene.getParty();
    const expShareModifier = this.scene.findModifier(m => m instanceof ExpShareModifier) as ExpShareModifier;
    const expBalanceModifier = this.scene.findModifier(m => m instanceof ExpBalanceModifier) as ExpBalanceModifier;
    const multipleParticipantExpBonusModifier = this.scene.findModifier(m => m instanceof MultipleParticipantExpBonusModifier) as MultipleParticipantExpBonusModifier;
    const nonFaintedPartyMembers = party.filter(p => p.hp);
    const expPartyMembers = nonFaintedPartyMembers.filter(p => p.level < this.scene.getMaxExpLevel());
    const partyMemberExp: number[] = [];

    if (participantIds.size) {
      let expValue = this.getPokemon().getExpValue();
      if (this.scene.currentBattle.battleType === BattleType.TRAINER) {
        expValue = Math.floor(expValue * 1.5);
      } else if (this.scene.currentBattle.battleType === BattleType.MYSTERY_ENCOUNTER && this.scene.currentBattle.mysteryEncounter) {
        expValue = Math.floor(expValue * this.scene.currentBattle.mysteryEncounter.expMultiplier);
      }
      for (const partyMember of nonFaintedPartyMembers) {
        const pId = partyMember.id;
        const participated = participantIds.has(pId);
        if (participated) {
          partyMember.addFriendship(2);
          const machoBraceModifier = partyMember.getHeldItems().find(m => m instanceof PokemonIncrementingStatModifier);
          if (machoBraceModifier && machoBraceModifier.stackCount < machoBraceModifier.getMaxStackCount(this.scene)) {
            machoBraceModifier.stackCount++;
            this.scene.updateModifiers(true, true);
            partyMember.updateInfo();
          }
        }
        if (!expPartyMembers.includes(partyMember)) {
          continue;
        }
        if (!participated && !expShareModifier) {
          partyMemberExp.push(0);
          continue;
        }
        let expMultiplier = 0;
        if (participated) {
          expMultiplier += (1 / participantIds.size);
          if (participantIds.size > 1 && multipleParticipantExpBonusModifier) {
            expMultiplier += multipleParticipantExpBonusModifier.getStackCount() * 0.2;
          }
        } else if (expShareModifier) {
          expMultiplier += (expShareModifier.getStackCount() * 0.2) / participantIds.size;
        }
        if (partyMember.pokerus) {
          expMultiplier *= 1.5;
        }
        if (Overrides.XP_MULTIPLIER_OVERRIDE !== null) {
          expMultiplier = Overrides.XP_MULTIPLIER_OVERRIDE;
        }
        const pokemonExp = new Utils.NumberHolder(expValue * expMultiplier);
        this.scene.applyModifiers(PokemonExpBoosterModifier, true, partyMember, pokemonExp);
        partyMemberExp.push(Math.floor(pokemonExp.value));
      }

      if (expBalanceModifier) {
        let totalLevel = 0;
        let totalExp = 0;
        expPartyMembers.forEach((expPartyMember, epm) => {
          totalExp += partyMemberExp[epm];
          totalLevel += expPartyMember.level;
        });

        const medianLevel = Math.floor(totalLevel / expPartyMembers.length);

        const recipientExpPartyMemberIndexes: number[] = [];
        expPartyMembers.forEach((expPartyMember, epm) => {
          if (expPartyMember.level <= medianLevel) {
            recipientExpPartyMemberIndexes.push(epm);
          }
        });

        const splitExp = Math.floor(totalExp / recipientExpPartyMemberIndexes.length);

        expPartyMembers.forEach((_partyMember, pm) => {
          partyMemberExp[pm] = Phaser.Math.Linear(partyMemberExp[pm], recipientExpPartyMemberIndexes.indexOf(pm) > -1 ? splitExp : 0, 0.2 * expBalanceModifier.getStackCount());
        });
      }

      for (let pm = 0; pm < expPartyMembers.length; pm++) {
        const exp = partyMemberExp[pm];

        if (exp) {
          const partyMemberIndex = party.indexOf(expPartyMembers[pm]);
          this.scene.unshiftPhase(expPartyMembers[pm].isOnField() ? new ExpPhase(this.scene, partyMemberIndex, exp) : new ShowPartyExpBarPhase(this.scene, partyMemberIndex, exp));
        }
      }
    }

    if (this.scene.currentBattle.battleType === BattleType.MYSTERY_ENCOUNTER) {
      handleMysteryEncounterVictory(this.scene, false, this.isExpOnly);
      return this.end();
    }

    if (!this.scene.getEnemyParty().find(p => this.scene.currentBattle.battleType === BattleType.WILD ? p.isOnField() : !p?.isFainted(true))) {
      this.scene.pushPhase(new BattleEndPhase(this.scene));
      if (this.scene.currentBattle.battleType === BattleType.TRAINER) {
        this.scene.pushPhase(new TrainerVictoryPhase(this.scene));
      }
      if (this.scene.gameMode.isEndless || !this.scene.gameMode.isWaveFinal(this.scene.currentBattle.waveIndex)) {
        this.scene.pushPhase(new EggLapsePhase(this.scene));
        if (this.scene.currentBattle.waveIndex % 10) {
          this.scene.pushPhase(new SelectModifierPhase(this.scene));
        } else if (this.scene.gameMode.isDaily) {
          this.scene.pushPhase(new ModifierRewardPhase(this.scene, modifierTypes.EXP_CHARM));
          if (this.scene.currentBattle.waveIndex > 10 && !this.scene.gameMode.isWaveFinal(this.scene.currentBattle.waveIndex)) {
            this.scene.pushPhase(new ModifierRewardPhase(this.scene, modifierTypes.GOLDEN_POKEBALL));
          }
        } else {
          const superExpWave = !this.scene.gameMode.isEndless ? (this.scene.offsetGym ? 0 : 20) : 10;
          if (this.scene.gameMode.isEndless && this.scene.currentBattle.waveIndex === 10) {
            this.scene.pushPhase(new ModifierRewardPhase(this.scene, modifierTypes.EXP_SHARE));
          }
          if (this.scene.currentBattle.waveIndex <= 750 && (this.scene.currentBattle.waveIndex <= 500 || (this.scene.currentBattle.waveIndex % 30) === superExpWave)) {
            this.scene.pushPhase(new ModifierRewardPhase(this.scene, (this.scene.currentBattle.waveIndex % 30) !== superExpWave || this.scene.currentBattle.waveIndex > 250 ? modifierTypes.EXP_CHARM : modifierTypes.SUPER_EXP_CHARM));
          }
          if (this.scene.currentBattle.waveIndex <= 150 && !(this.scene.currentBattle.waveIndex % 50)) {
            this.scene.pushPhase(new ModifierRewardPhase(this.scene, modifierTypes.GOLDEN_POKEBALL));
          }
          if (this.scene.gameMode.isEndless && !(this.scene.currentBattle.waveIndex % 50)) {
            this.scene.pushPhase(new ModifierRewardPhase(this.scene, !(this.scene.currentBattle.waveIndex % 250) ? modifierTypes.VOUCHER_PREMIUM : modifierTypes.VOUCHER_PLUS));
            this.scene.pushPhase(new AddEnemyBuffModifierPhase(this.scene));
          }
        }
        this.scene.pushPhase(new NewBattlePhase(this.scene));
      } else {
        this.scene.currentBattle.battleType = BattleType.CLEAR;
        this.scene.score += this.scene.gameMode.getClearScoreBonus();
        this.scene.updateScoreText();
        this.scene.pushPhase(new GameOverPhase(this.scene, true));
      }
    }

    this.end();
  }
}
