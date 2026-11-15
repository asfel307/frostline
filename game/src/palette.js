// Frostline — palette: one night-arctic look for the whole game.
// Every colour the game uses lives here, so the map, the HUD and the
// effects all agree. Deep blue night, cold snow, one cyan aurora accent
// and one warm window-light accent. Nothing here is shared with the
// desert map of the sibling entry.
export const PALETTE = {
  sky: 0x050914,
  fog: 0x0a1328,
  snow: 0xb9c9dd,
  snowDim: 0x8ba0b8,
  ice: 0x6fa0c2,
  iceDeep: 0x2e5f7a,
  steel: 0x4a5a6e,
  steelDark: 0x2c3747,
  steelLight: 0x6b7f96,
  rock: 0x3a4552,
  aurora: 0x2fa8c4,
  auroraGreen: 0x3aa88a,
  windowWarm: 0xe8a54d,
  teamNorth: 0x2fa8d8,
  teamIce: 0xe06a5c,
  hazard: 0xe8b23a,
  panel: '#0b1526',
  panelEdge: '#22344f',
  ink: '#c7d6e8',
  muted: '#8fa5bf',
};

export const TEAM = {
  north: { name: 'Northwind', color: PALETTE.teamNorth, css: '#2fa8d8' },
  ice: { name: 'Icefall', color: PALETTE.teamIce, css: '#e06a5c' },
};
