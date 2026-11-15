[![make.fun · threejs-fps-02](https://make.fun/badge/threejs-fps-02.svg)](https://make.fun/bounty/threejs-fps-02?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)
[![rank](https://make.fun/badge/threejs-fps-02/asfel307/frostline/rank.svg)](https://make.fun/bounty/threejs-fps-02/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)
[![reward](https://make.fun/badge/threejs-fps-02/asfel307/frostline/reward.svg)](https://make.fun/bounty/threejs-fps-02?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)

# Frostline

A tactical first-person shooter in three.js — a Counter-Strike-style round-based game
with an original map, art, sounds and names. Built for make.fun's threejs-fps-02 bounty.

## The game

**Station Aurora** — an arctic research station at night, under an aurora sky.
Two bomb sites: the **Comms Array** (A, north-west) and the **Reactor Hall** (B, north-east),
joined by three lanes: Hab Row west, the Frozen Plaza centre, Storage Yard east.

- **Two teams, 5v5:** you are Northwind's fifth (attackers). Four bot teammates fight
  beside you; five Icefall bots defend.
- **Rounds:** first to 5 wins (9 rounds max). A round is won by eliminating the other
  team, by detonating the planted charge, or — for the defenders — by defusing it or
  running the clock out.
- **Economy + buy menu:** kills pay $300, round wins $3,250. Between rounds, press **B**
  to buy the NK-77 Northstar rifle ($2,700), the V-4 Blizzard SMG ($1,500), Snowburst
  grenades ($300) and a Thermal Vest ($650).
- **Gunplay:** hitscan weapons with headshot multipliers, recoil and spread that punish
  firing on the move, crouching, jumping, and collision with the map.
- **Bots:** they follow waypoint routes to their objectives, hold positions, react to
  what they see and hear, fire in bursts with a reaction time, plant the charge and
  defuse it.
- **Sounds:** all synthesized with WebAudio — no audio files.

## Controls

| Key | Action |
| --- | --- |
| W A S D | Move |
| Mouse | Look (click to lock) |
| Click | Fire |
| R | Reload |
| G | Throw grenade |
| E | Plant / defuse the charge (hold, inside a site) |
| B | Buy menu (buy phase) |
| 1 / 2 / 3 | Switch weapon |
| Ctrl | Crouch |
| Space | Jump |

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

## Hand it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```
