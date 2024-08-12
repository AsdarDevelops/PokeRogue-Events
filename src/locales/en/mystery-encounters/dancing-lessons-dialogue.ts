export const dancingLessonsDialogue = {
  intro: "An Oricorio dances sadly alone, without a partner.",
  title: "Dancing Lessons",
  description: "The Oricorio doesn't seem aggressive, if anything it seems sad.\n\nMaybe it just wants someone to dance with...",
  query: "What will you do?",
  option: {
    1: {
      label: "Battle It",
      tooltip: "(-) Tough Battle\n(+) Gain a Baton",
      selected: "The Oricorio is distraught and moves to defend itself!",
      boss_enraged: "The Oricorio's fear boosted its stats!"
    },
    2: {
      label: "Learn Its Dance",
      tooltip: "(+) Teach a Pokémon Revelation Dance",
      selected: `You watch the Oricorio closely as it performs its dance...
        $@s{level_up_fanfare}Your {{selectedPokemon}} wants to learn Revelation Dance!`,
    },
    3: {
      label: "Show It a Dance",
      tooltip: "(-) Teach the Oricorio a Dance Move\n(+) The Oricorio Will Like You",
      disabled_tooltip: "Your Pokémon need to know a Dance move for this.",
      select_prompt: "Select a Dance type move to use.",
      selected: `The Oricorio watches in fascination as\n{{selectedPokemon}} shows off {{selectedMove}}!
        $It loves the display!
        $@s{level_up_fanfare}The Oricorio wants to join your party!`,
    },
  },
  invalid_selection: "This Pokémon doesn't know a Dance move"
};
