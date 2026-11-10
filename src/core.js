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
const HT = {
  civ:    {hp:14,  sp:72, r:10, xp:1},
  cop:    {hp:28,  sp:82, r:10, xp:2},
  riot:   {hp:110, sp:62, r:13, xp:5},
  soldier:{hp:50,  sp:88, r:11, xp:4},
  flamer: {hp:80,  sp:66, r:12, xp:6},
  apc:    {hp:1600,sp:44, r:34, xp:60, boss:true},
};
// minion variants: the dead keep their gear
const VAR = {
  civ:    {hp:34,  sp:1.0, dmg:1.0, r:10},
  cop:    {hp:36,  sp:1.25,dmg:1.0, r:10},
  riot:   {hp:110, sp:0.8, dmg:1.6, r:13},
  soldier:{hp:55,  sp:1.05,dmg:1.3, r:11},
  flamer: {hp:45,  sp:1.0, dmg:1.0, r:12, bloat:true},
};
const MUTS = {
  spit:     {n:'Bile Spit',       ic:'🟢', b:'Hurl acid globs at the nearest humans.',         u:'More globs, more damage, more pierce.'},
  aura:     {n:'Rot Cloud',       ic:'☁️', b:'A cloud of decay eats at nearby humans.',        u:'Bigger cloud, more damage.'},
  spikes:   {n:'Bone Burst',      ic:'🦴', b:'Erupt bone shards in every direction.',          u:'More shards, more damage, more often.'},
  screech:  {n:'Screech',         ic:'📢', b:'A shriek that stuns and hurls humans back.',    u:'Bigger radius, longer stun, more often.'},
  trail:    {n:'Toxic Trail',     ic:'🧪', b:'Leave a streak of corrosive sludge behind you. Chasers who follow you wade through it.', u:'Wider, longer-lasting, nastier sludge.'},
  jaws:     {n:'Unhinged Jaw',    ic:'🦷', b:'+30% bite damage and longer reach.',              u:'+30% bite damage, more reach.'},
  contagion:{n:'Contagion',       ic:'🦠', b:'+10% chance that slain humans rise.',             u:'+10% infection chance.'},
  horde:    {n:'Hive Mind',       ic:'🧠', b:'+5 max horde size.',                              u:'+5 max horde size.'},
  alpha:    {n:'Alpha Pheromone', ic:'👑', b:'Horde hits harder, moves faster, lasts longer.', u:'+20% horde dmg, +8% speed, +15% HP.'},
  boom:     {n:'Volatile Dead',   ic:'💥', b:'Your horde explodes when destroyed.',             u:'Bigger, deadlier explosions.'},
  hide:     {n:'Necrotic Hide',   ic:'🛡️', b:'+25 max HP and slow regeneration.',               u:'+25 max HP, faster regen.'},
  legs:     {n:'Sprinter Legs',   ic:'🦵', b:'+10% movement speed.',                            u:'+10% movement speed.'},
  hunger:   {n:'Ravenous',        ic:'🍖', b:'Heal with every kill.',                           u:'More healing per kill.'},
};
const MAXLV = 5;
const MAX_SLOTS = 6;   // distinct mutations you can carry; once full, level-ups only upgrade owned ones
