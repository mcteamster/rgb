# On the Spectrum
A multiplayer color guessing party game! https://rgb.mcteamster.com

How well can you convey the "vibe" of a color in 50 characters or less? 

Can your friends guess where you are *On the Spectrum*?

[![rgb](./docs/img/rgb.jpeg)](https://rgb.mcteamster.com)

## Game Overview
On the Spectrum is inspired by the board game [Hues and Cues](https://boardgamegeek.com/boardgame/302520/hues-and-cues) by Scott Brady, taken to the next level with the full range of visible colors and a high-fidelity scoring mechanism.

- **Players**: 2-10 players per game
- **Objective**: Score points by accurately guessing colors from text descriptions
- **Core Mechanic**: One player describes a randomly generated color, others guess using an HSL color picker (time limits optional)
- **Scoring**: Based on color accuracy using distance in HSL space, highest score wins!

There are no restrictions on the kinds of clues you can give. You could:
- Describe something that looks like the color
- Write the color name verbatim... but does everyone have the same concept of "red" "green" or "blue"
- Use 🌈 EMOJIS ONLY 🩷❤️🧡💛💚🩵💙💜🖤🩶🤍🤎
- Try and write the RGB Hex Code?
- Tell everybody how the color makes you *FEEL*

## Technology
On the Spectrum was built in a week using [`kiro-cli`](https://kiro.dev/cli/) with 1000 bonus credits courtesy of Amazon re:Invent 2025.

- `.kiro/` - Steering and Specs for Amazon Kiro (CLI)
- `client/` - Frontend web application
- `service/` - Backend CDK infrastructure and Lambda functions

### Dependencies
This project uses various open source packages. See package.json files for complete dependency lists. Major dependencies include:

- React (MIT License)
- Discord Embedded App SDK (MIT License) 
- TypeScript (Apache License 2.0)
- AWS CDK (Apache License 2.0)
- QRCode (MIT License)

All dependencies retain their original licenses and copyright notices.
