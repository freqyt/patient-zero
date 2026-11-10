"use strict";
// ---------- shared utils & data ----------
const TAU = Math.PI * 2;
const rand = (a,b) => a + Math.random()*(b-a);
const clamp = (v,a,b) => v<a?a:v>b?b:v;
const lerp = (a,b,t) => a + (b-a)*t;
const d2 = (a,b) => { const dx=a.x-b.x, dy=a.y-b.y; return dx*dx+dy*dy; };
const pick = a => a[Math.random()*a.length|0];
const $ = id => document.getElementById(id);

function shadeHex(hex, f){ // f<0 darken, f>0 lighten
  const n = parseInt(hex.slice(1),16);
  let r = n>>16, g = (n>>8)&255, b = n&255;
  if (f < 0){ r*=1+f; g*=1+f; b*=1+f; } else { r+=(255-r)*f; g+=(255-g)*f; b+=(255-b)*f; }
  return '#' + ((1<<24) | (r<<16) | (g<<8) | b).toString(16).slice(1);
}

const GAME_LEN = 600;
const GS = 0.5;          // global movement pace: everything moves at half the original speed
const BODY_LIFE = 3.5;   // seconds a dead body lies before it is gone (fades over the last 1.2s)
const HT = {
  civ:    {hp:14,  sp:72, r:10, xp:1},
  beat:   {hp:22,  sp:84, r:10, xp:2},   // melee baton cop: the common police enemy
  cop:    {hp:28,  sp:82, r:10, xp:2},   // pistol cop: rarer
  riot:   {hp:110, sp:62, r:13, xp:5},
  soldier:{hp:50,  sp:88, r:11, xp:4},
  flamer: {hp:80,  sp:66, r:12, xp:6},
  apc:    {hp:1600,sp:44, r:34, xp:60, boss:true},
  heli:   {hp:3200,sp:0,  r:30, xp:150, boss:true, air:true},   // final boss: the gunship
  dog:      {hp:12,  sp:150, r:7,  xp:2},   // K9 unit: fast melee
  medic:    {hp:26,  sp:80,  r:10, xp:4},   // heals nearby humans
  grenadier:{hp:45,  sp:70,  r:11, xp:5},   // lobs grenades at the horde
  sniper:   {hp:30,  sp:60,  r:10, xp:6},   // laser telegraph, then one heavy shot
  swat:     {hp:1500,sp:70,  r:30, xp:60, boss:true},   // van that deploys squads
  jugg:     {hp:1300,sp:40,  r:22, xp:60, boss:true},   // minigun + charge
  cure:     {hp:1100,sp:60,  r:16, xp:60, boss:true},   // gas that melts the horde
};
const BOSS_NAME = {apc:'ARMORED CARRIER', heli:'GUNSHIP', swat:'SWAT VAN', jugg:'JUGGERNAUT', cure:'THE CURE'};
// evolutions: a max-level mutation plus its partner (any level) unlocks a super form
const EVOS = {
  spit:   {w:'contagion', n:'Plague Geyser', ic:'🌋', d:'+2 globs and pierce; every glob bursts into an acid splash.'},
  spikes: {w:'hide',      n:'Bone Armor',    ic:'🦴', d:'Bone Burst fires twice as often and you take 35% less damage.'},
  screech:{w:'jaws',      n:'Banshee Maw',   ic:'💀', d:'A huge shriek every 3.5s that hits 4x as hard.'},
  aura:   {w:'boom',      n:'Necrotic Nova', ic:'☢️', d:'Rot Cloud 40% wider, 2x damage; its victims burst.'},
  trail:  {w:'legs',      n:'Acid Stampede', ic:'🐾', d:'A wide, double-strength sludge trail and +15% speed.'},
  bloom:  {w:'horde',     n:'Horde King',    ic:'👑', d:'Husks stay as permanent horde, +6 horde size, horde hits 50% harder.'},
  lash:   {w:'leech',     n:'Blood Whip',    ic:'🐙', d:'Lash one more target, 40% harder and faster; every lash heals you.'},
  spores: {w:'hunger',    n:'Fungal Bloom',  ic:'🌱', d:'Drop 3 pods at once with 60% bigger blasts that seed new pods.'},
  wisps:  {w:'curse',     n:'Wailing Ossuary', ic:'⚰️', d:'+2 wisps in a wider orbit, 50% harder, +10% more per curse point.'},
  wave:   {w:'xp',        n:'Mind Flayer',   ic:'🌌', d:'Waves hit twice and stun; brains they pull in give +25% XP.'},
  beam:   {w:'eyes',      n:'Gaze of Ruin',  ic:'🔆', d:'Twin beams fire front and back, twice as long, double damage.'},
};
// minion variants: the dead keep their gear
const VAR = {
  civ:    {hp:34,  sp:1.0, dmg:1.0, r:10},
  beat:   {hp:36,  sp:1.15,dmg:1.1, r:10},
  cop:    {hp:36,  sp:1.25,dmg:1.0, r:10},
  riot:   {hp:110, sp:0.8, dmg:1.6, r:13},
  soldier:{hp:55,  sp:1.05,dmg:1.3, r:11},
  flamer: {hp:45,  sp:1.0, dmg:1.0, r:12, bloat:true},
  dog:      {hp:28,  sp:1.6, dmg:0.8, r:8},
  medic:    {hp:34,  sp:1.0, dmg:1.0, r:10},
  grenadier:{hp:50,  sp:0.95,dmg:1.2, r:11},
  sniper:   {hp:36,  sp:1.0, dmg:1.1, r:10},
};
const MUTS = {
  spit:     {n:'Bile Spit',       ic:'🟢', b:'Hurl acid globs at the nearest humans.',         u:'More globs, more damage, more pierce.'},
  aura:     {n:'Rot Cloud',       ic:'☁️', b:'A cloud of decay eats at nearby humans.',        u:'Bigger cloud, more damage.'},
  spikes:   {n:'Bone Burst',      ic:'🦴', b:'Erupt bone shards in every direction.',          u:'More shards, more damage, more often.'},
  screech:  {n:'Screech',         ic:'📢', b:'A shriek that stuns and hurls humans back.',    u:'Bigger radius, longer stun, more often.'},
  trail:    {n:'Toxic Trail',     ic:'🧪', b:'Leave a streak of corrosive sludge behind you. Chasers who follow you wade through it.', u:'Wider, longer-lasting, nastier sludge.'},
  jaws:     {n:'Unhinged Jaw',    ic:'🦷', b:'+30% bite damage and longer reach.',              u:'+30% bite damage, more reach.'},
  contagion:{n:'Contagion',       ic:'🦠', b:'+10% chance that slain humans rise.',             u:'+10% infection chance.'},
  horde:    {n:'Hive Mind',       ic:'🧠', b:'+3 max horde size.',                              u:'+3 max horde size.'},
  alpha:    {n:'Alpha Pheromone', ic:'👑', b:'Horde hits harder, moves faster, lasts longer.', u:'+20% horde dmg, +8% speed, +15% HP.'},
  boom:     {n:'Volatile Dead',   ic:'💥', b:'Your horde explodes when destroyed.',             u:'Bigger, deadlier explosions.'},
  hide:     {n:'Necrotic Hide',   ic:'🛡️', b:'+25 max HP and slow regeneration.',               u:'+25 max HP, faster regen.'},
  legs:     {n:'Sprinter Legs',   ic:'🦵', b:'+10% movement speed.',                            u:'+10% movement speed.'},
  hunger:   {n:'Ravenous',        ic:'🍖', b:'Heal with every kill.',                           u:'More healing per kill.'},
  lash:     {n:'Lash Tendrils',   ic:'🦑', b:'Whip the nearest humans with tendrils and drag them in.', u:'More tendrils, harder lashes, faster.'},
  spores:   {n:'Spore Pods',      ic:'🍄', b:'Drop spore mines that burst when humans step near.',   u:'Bigger, deadlier blasts, more often.'},
  leech:    {n:'Blood Leech',     ic:'🩸', b:'Heal from the damage your horde deals.',               u:'More healing from your horde.'},
  chitin:   {n:'Chitin Shell',    ic:'🐚', b:'Chance to deflect bullets, and take 4% less damage.', u:'+8% deflect chance, 4% tougher.'},
  bloom:    {n:'Corpse Bloom',    ic:'🪦', b:'Husk zombies claw out of the ground beside your prey.', u:'More husks, more often, lasting longer.'},
  beam:     {n:'Eye Beam',        ic:'🔦', b:'A piercing beam burns through every human in a line.', u:'Longer, stronger beams, more often.'},
  wisps:    {n:'Grave Wisps',     ic:'👻', b:'Ghostly wisps orbit you, burning humans they touch.', u:'More wisps, wider orbit, more damage.'},
  wave:     {n:'Brain Wave',      ic:'🌀', b:'Psychic rings ripple out, hurting humans and pulling in brains.', u:'Wider, stronger, more frequent waves.'},
  curse:    {n:'Cursed Blood',    ic:'😈', b:'+1 curse: humans get tougher, faster and more numerous, but every brain is worth +10% XP.', u:'+1 curse.'},
  xp:       {n:'Neural Bloom',    ic:'💡', b:'+10% XP from brains.', u:'+10% XP.'},
  haste:    {n:'Adrenal Surge',   ic:'⚡', b:'+10% attack speed for every attack and mutation.', u:'+10% attack speed.'},
  luck:     {n:'Lucky Rot',       ic:'🍀', b:'+1 luck: more crits, more level-up choices, more loot.', u:'+1 luck.'},
  might:    {n:'Mutant Might',    ic:'💪', b:'+12% damage from all your attacks.',               u:'+12% damage.'},
  eyes:     {n:'Extra Eyes',      ic:'👁️', b:'+12% attack range, pickup range and +4% crit chance.', u:'+12% range, +4% crit.'},
};
const MAXLV = 8;   // highest level anything can reach (weapons); items stop at 6
const maxLv = k => isWeapon(k) ? 8 : 6;
// WEAPONS are active attacks; everything else is an ITEM (passive). Each weapon evolves with one item.
const WEAPONS = new Set(['spit','spikes','screech','aura','trail','lash','spores','bloom','beam','wisps','wave']);
const isWeapon = k => WEAPONS.has(k);
const BASE_SLOTS = 3;   // weapon slots and item slots each start at 3; DNA Lab raises each up to 6
