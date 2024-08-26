export const bugTypeSuperfanDialogue = {
  intro: "An unusual trainer with all kinds of Bug paraphernalia blocks your way!",
  // First line is a play on words
  intro_dialogue: `Hey, trainer! Mind if I bug you for a bit? 
    $I'm on a mission to seek out and catch the rarest Bug Pokémon in existence!
    $You must love Bug Pokémon too, right?\nEveryone loves Bug Pokémon!`,
  title: "The Bug-Type Superfan",
  speaker: "Bug-Type Superfan",
  description: "The trainer prattles, not even waiting for a response...\n\nIt seems the only way to get out of this situation is by catching the trainer's attention!",
  query: "What will you do?",
  option: {
    1: {
      label: "Offer to Battle",
      tooltip: "(-) Challenging Battle\n(+) Teach a Pokémon a Bug Type Move",
      selected: "A challenge, eh?\nMy bugs are more than ready for you!",
    },
    2: {
      label: "Show Your Bug Types",
      tooltip: "(+) Receive a Gift Item",
      disabled_tooltip: "You need at least 1 Bug Type Pokémon on your team to select this.",
      selected: "You show the trainer all your Bug Type Pokémon...",
      selected_0_to_1: `Huh? You only have {{numBugTypes}}...
        $Guess I'm wasting my breath on someone like you, huh...`,
      selected_2_3: `Hey, you've got {{numBugTypes}} Bug Types!\nNot bad.
        $Here, this might help you on your journey to catch more!`,
      selected_4_to_5: `What? You have {{numBugTypes}} Bug Types?\nNice!
        $You're not quite at my level, but I can see shades of myself in you!
        $Take this, my young apprentice!`,
      selected_6: `Whoa! {{numBugTypes}} Bug Types!
        $You must love Bug Types almost as much as I do!
        $Here, take this as a token of our camaraderie!`,
    },
    3: {
      label: "Gift a Bug Item",
      tooltip: "(-) Give the trainer a Quick Claw, Grip Claw, or Silver Powder\n(+) Receive a Gift Item",
      disabled_tooltip: "You need to have a Quick Claw, Grip Claw, or Silver Powder to select this.",
      select_prompt: "Select a move to teach.",
      invalid_selection: "Pokémon doesn't have that kind of item.",
      selected: "You hand the trainer a {{selectedItem}}.",
      selected_dialogue: `Whoa! A {{selectedItem}}, for me?\nYou're not so bad, kid!
        $As a token of my appreciation,\nI want you to have this special gift!
        $It's been passed all through my family, and now I want you to have it!`
    },
  },
  battle_won: `Your knowledge and skill were perfect at exploiting our weaknesses!
    $In exchange for the valuable lesson,\nallow me to teach one of your Pokémon a Bug Type Move!`,
  confirm_no_teach: "You sure you don't want to learn one of these great moves?",
  outro: `I see great Bug Pokémon in your future!\nMay our paths cross again!
    $Bug out!` // This is a play on words
};
