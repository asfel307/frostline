// Frostline — palette: one night-arctic look for the whole game.
// Every colour the game uses lives here, so the map, the HUD and the
// effects all agree. Deep blue night, cold snow, one cyan aurora accent
// and one warm window-light accent. Nothing here is shared with the
// desert map of the sibling entry.
export const PALETTE = {
  sky: 0x050914,
  fog: 0x0a1328,
  snow: 0xdfe9f5,
  snowDim: 0x9fb4cc,
  ice: 0x7fb3d9,
  iceDeep: 0x2e5f7a,
  steel: 0x4a5a6e,
  steelDark: 0x2c3747,
  steelLight: 0x6b7f96,
  rock: 0x3a4552,
  aurora: 0x37e0ff,
  auroraGreen: 0x4dffb8,
  windowWarm: 0xffb347,
  teamNorth: 0x35c4ff,
  teamIce: 0xff6b57,
  hazard: 0xffc233,
  panel: '#0b1526',
  panelEdge: '#22344f',
  ink: '#e8f1fb',
  muted: '#8fa5bf',
};

export const TEAM = {
  north: { name: 'Northwind', color: PALETTE.teamNorth, css: '#35c4ff' },
  ice: { name: 'Icefall', color: PALETTE.teamIce, css: '#ff6b57' },
};
