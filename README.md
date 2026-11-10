# Patient Zero

A 16-bit style zombie survivors game: you are the outbreak. Every human you kill may rise and join your horde, keeping their gear.

- Desktop: WASD/arrows to move, E/Shift devours a minion, P/Esc pauses.
- Mobile: drag anywhere to move, tap EAT to devour a minion.

Loot crates spawn on screen; smash them (your attacks and horde target them) for a random pickup: Fresh Heart (heal), Magnet (pulls every brain on the map), Chainsaw (8s of brutal melee), Biohazard (wipes every human on screen, drops no new brains).

No build step: plain HTML + JS in `src/`. Serve the folder with any static server (`python -m http.server`).
