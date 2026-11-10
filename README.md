# Patient Zero

A 16-bit style zombie survivors game: you are the outbreak. Every human you kill may rise and join your horde, keeping their gear.

- Desktop: WASD/arrows to move, E/Shift devours a minion, P/Esc pauses.
- Mobile: drag anywhere to move, tap EAT to devour a minion.

Loot crates spawn on screen; smash them (your attacks and horde target them) for a random pickup: Fresh Heart (heal), Magnet (pulls every brain on the map), Bone Gatling (8s of rapid piercing bone fire), Biohazard (wipes every human on screen, drops no new brains).

After picking a character, choose a map: **Downtown** (the original city), **Pine Hollow** (pine woods and summer camps, lit only by campfires at night), **The Docks** (container yards, warehouses and fuel depots packed with explosive drums, under floodlights) or **Dead End** (a desert highway with junkyards and outposts, lit by burning barrels). Every map is endless and procedurally generated.

Each map has its own enemies, elites and bosses:
- **Downtown**: police and military, the SWAT Van, Armored Carrier, Juggernaut, The Cure and the Gunship.
- **Pine Hollow**: lumberjacks, hound packs, shotgun hunters, beekeepers (stinging swarms), poachers, trappers who lay bear traps, smokejumpers and deer hunters. Elites can be Camouflaged, Bramble-Skinned or Pack Leaders. Bosses: the Timber Harvester (saw head, felled trees, rolling logs), The Head Ranger (hound packs, trap rings, aimed volleys), The Moonshiner (flaming jugs, shotgun blasts; hit him while he drinks to heal); finale: the Fire Bomber, which lays walls of fire on low passes.
- **The Docks**: hook-wielding stevedores, guard dogs, port security, decon techs, welders, harbor marines, harpooners who reel you in, torch cutters and crane lookouts. Elites can be Heavy-Set, Live Wire or Fuel-Soaked. Bosses: The Stacker (drops shipping containers on you, some full of dockers), The Foreman (throws fuel drums, ground slam), The Smuggler (knife fans, vanishes in smoke, leaves decoys); finale: the Harbor Blimp, whose searchlight calls in a barrage if you stay in it.
- **Dead End**: machete raiders, coyote packs, revolver deputies, water bearers, scrap knights, bandits, molotov throwers, dirt bikers who run down your horde and ridge shooters. Elites can be Scorched or Mirage. Bosses: The Behemoth (monster truck that leaps onto you and spins out spraying gravel), The Warlord (molotov fans, war cry summons his gang), The Sheriff (telegraphed quickdraws, a lasso that drags you in, calls a posse); finale: the Dust Devil, a gyrocopter with homing rockets that brings a sandstorm and spins off dust devils.

Max a mutation while owning its partner to EVOLVE it. Earn DNA each run and spend it in the DNA Lab on permanent upgrades. Survive to 9:00, then destroy the Gunship to take the city. Gas pumps and fuel barrels explode on humans. 3 rerolls per run (more from dice pickups and the DNA Lab).

No build step: plain HTML + JS in `src/`. Serve the folder with any static server (`python -m http.server`).

## Deploying

Run `node tools/bump-version.js` before committing a deploy. It stamps the script URLs in `index.html` with a fresh `?v=` so browsers never mix cached old scripts with new ones (GitHub Pages caches files for 10 minutes).
