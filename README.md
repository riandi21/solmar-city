# Solmar City

An original sun-soaked coastal open-world crime game, built for the make.fun GTA 6 bounty. You are Rico Vega, a driver-for-hire who owes $5,000 to Madame Coral. Steal cars, run her jobs across a 9×9-block seaside city, outrun the Solmar PD as your wanted level climbs, and buy your way out of the debt — on foot or behind the wheel, with traffic, pedestrians, police chases and a police helicopter at 4 stars, 12 story missions, fists / pistol / SMG / shotgun / rifle combat, NOS boost, a 4-station car radio, shops and a safehouse, a HUD with a minimap, and saves.

**v3 — what's new:** a full day/night cycle (the sun moves, street lamps and headlights come on after dark, press N to skip time); the Old Town quarter with a cathedral, cobbled plaza and fountain, plus a working lighthouse with a rotating beam on the south-west beach; the Harbor War arc (missions 9–12, $20,000 — escort a truck, run a midnight delivery, ram Dourado cars off the pier road, take the lighthouse); smarter police (flanking cars, spike strips at 3+ stars, a helicopter that leads its target); side activities (4 street races with checkpoint rings and cash prizes, 20 hidden packages worth $50 each, taxi fares); a rifle (key 5, long-range); new shop stock (NOS refill $80, armour vest $250); and a HUD with a clock, a mission tracker, an activity tracker, and district labels on the minimap.

[![GTA 6 bounty](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/riandi21/solmar-city/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/riandi21/solmar-city/reward.svg)](https://make.fun/bounty/gta6-01)

## Controls

- **W A S D / arrow keys** — drive or walk (camera-relative on foot)
- **Shift** — sprint on foot (stamina) · **Shift in a car** — NOS boost
- **Space** — jump
- **E** — enter / exit car
- **F** — punch · **Click** — shoot
- **1 / 2 / 3 / 4 / 5** — fists / pistol / SMG / shotgun / rifle
- **C** — change radio station (Solmar FM · Coral Nights · Portside · Neon Nights)
- **Q / R** — on foot near a shop: buy health ($150) / ammo ($100, rifle $150); **B** — NOS refill ($80); **V** — armour vest ($250); near the safehouse: Q saves, heals and clears your wanted level ($300, 60 s cooldown)
- **T** — start a street race at a start gantry · **N** — skip to dawn / dusk
- **Drag mouse** — orbit the chase camera
- **P / Esc** — pause · **M** — mute sound · **Enter** — confirm / restart

## How to play locally

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. No build step, no network requests — the game is plain static files under `game/`, with three.js vendored at `game/vendor/three.module.min.js`. Progress saves automatically to your browser (mission complete and every 30 seconds); **Continue** on the start screen picks it back up.

## The story

Twelve jobs stand between Rico and freedom: steal wheels for the Coral Club, run three packages across town against the clock, survive a three-star wanted level for a full minute, pull the Marina Job with a crew — then defend Coral's turf from the Dourado, and end the Harbor War at the lighthouse. Each job pays; the debt is $5,000, and the Harbor War arc alone pays $20,000. The city — downtown towers, quiet residential streets, the Old Town quarter, a beach and boardwalk on the south edge and a marina on the east — is yours to cross however you like, day or night. Just mind the blue lights — and the helicopter once you hit four stars.

## Side activities

- **Street races** — four courses (Boardwalk Sprint $300, Old Town Loop $600, Lighthouse Dash $900, Harbor Grand Prix $1,200). Stand on a checkered start gantry and press **T**; beat your best time.
- **Hidden packages** — 20 gold parcels stashed around the city, $50 each. The HUD counts them.
- **Taxi jobs** — pull up in a car when a fare waves you down, drive them to the gold marker, get paid by the distance.

## Systems (for contributors)

Every system is one ES module under `game/src/` with a single factory that
takes the scene and the shared `world` object; `main.js` loads each one
guarded, so a missing module is skipped instead of killing the boot.

| System | File | Owns |
|---|---|---|
| City | `city.js` | Roads, buildings, beach, marina, districts |
| Old Town | `oldtown.js` | Cathedral, plaza, townhouses, lighthouse |
| Day/night | `daynight.js` | Clock, sun/moon, lamps, headlights |
| Renderer | `render.js` | WebGL renderer, sky, fog, moon + stars |
| Player | `player.js` | On-foot movement, stamina, entering cars |
| Vehicles | `vehicles.js` | Arcade driving, NOS, collisions |
| Traffic | `traffic.js` | Traffic cars, pedestrians, race slowdown |
| Police | `police.js` | Wanted level, pursuit, roadblocks, busted |
| Police AI | `policeai.js` | Flanking, spike strips, heli lead |
| Helicopter | `heli.js` | 4-star police helicopter + spotlight |
| Missions | `missions.js` | Story flow, stages, markers, rewards |
| Harbor War | `missions3.js` | Escort, delivery, takedown mechanics |
| Combat | `combat.js` | Fists, pistol, SMG, shotgun, rifle, rivals |
| Shops | `shops.js` | Shop + safehouse, NOS, armour vest |
| Activities | `activities.js` | Races, packages, taxi jobs |
| Audio | `audio.js` | WebAudio synth: engine, siren, 4 radio stations |
| HUD | `hud.js` | Cash, health, stars, minimap, trackers |
| Save | `save.js` | localStorage save (v3 fields) |
| Shots | `shots.js` | The four staged screenshot scenes |

Shared helpers live in `world.js` (angles, distances, clocks) and tuning
in `config.js`. The fixed simulation step is 1/60 s; systems run in the
order listed in `main.js` (`stepOrder`), and `shots.js` stages scenes in
that same order so screenshots play identically to live play.
