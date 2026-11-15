// Frostline — weapons: one table, no special cases in the code that
// fires them. Names, prices and numbers are original to this game.
// Damage is per body hit; the head multiplier is applied in combat.js.
export const WEAPONS = {
  pistol: {
    id: 'pistol',
    name: 'P-9 Frostbite',
    kind: 'pistol',
    price: 0,
    damage: 26,
    headMult: 3,
    mag: 12,
    reserveMax: 48,
    fireInterval: 0.16,
    reloadTime: 1.15,
    auto: false,
    spreadBase: 0.006,
    spreadMove: 0.028,
    spreadShot: 0.012,
    spreadMax: 0.07,
    recoil: 0.011,
    range: 70,
    tracer: 0x9fd8ff,
  },
  rifle: {
    id: 'rifle',
    name: 'NK-77 Northstar',
    kind: 'rifle',
    price: 2700,
    damage: 34,
    headMult: 4,
    mag: 30,
    reserveMax: 90,
    fireInterval: 0.11,
    reloadTime: 2.1,
    auto: true,
    spreadBase: 0.004,
    spreadMove: 0.034,
    spreadShot: 0.014,
    spreadMax: 0.09,
    recoil: 0.016,
    range: 90,
    tracer: 0x37e0ff,
  },
  smg: {
    id: 'smg',
    name: 'V-4 Blizzard',
    kind: 'smg',
    price: 1500,
    damage: 22,
    headMult: 3,
    mag: 32,
    reserveMax: 96,
    fireInterval: 0.07,
    reloadTime: 1.6,
    auto: true,
    spreadBase: 0.009,
    spreadMove: 0.03,
    spreadShot: 0.01,
    spreadMax: 0.08,
    recoil: 0.009,
    range: 55,
    tracer: 0x4dffb8,
  },
};

export const GRENADE = {
  id: 'grenade',
  name: 'Snowburst',
  price: 300,
  radius: 6.5,
  maxDamage: 95,
  fuse: 1.6,
};

export const VEST = { id: 'vest', name: 'Thermal Vest', price: 650, armor: 50 };

export const BUY_LIST = [
  { id: 'rifle', label: 'NK-77 Northstar rifle', price: 2700, key: '1' },
  { id: 'smg', label: 'V-4 Blizzard SMG', price: 1500, key: '2' },
  { id: 'grenade', label: 'Snowburst grenade', price: 300, key: '3' },
  { id: 'vest', label: 'Thermal Vest (+50 armor)', price: 650, key: '4' },
];

export function equipWeapon(agent, weaponId) {
  const w = WEAPONS[weaponId];
  agent.weapon = weaponId;
  agent.mag = w.mag;
  agent.reserve = w.reserveMax;
  agent.reloadUntil = 0;
  agent.spread = 0;
}
