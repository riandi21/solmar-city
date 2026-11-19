# Solmar City

[![Solmar City on make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Solmar City rank on make.fun](https://make.fun/badge/gta6-01/riandi21/solmar-city/rank.svg)](https://make.fun/bounty/gta6-01)
[![Solmar City reward on make.fun](https://make.fun/badge/gta6-01/riandi21/solmar-city/reward.svg)](https://make.fun/bounty/gta6-01)


A neon open-world crime game that runs offline in a desktop browser.
Three.js, no build step, no network requests — just open `game/index.html`.

## The story

Rico Vega came back to Solmar City with nothing but a busted sedan and a
debt: **$5,000 owed to Madame Coral**, and she does not wait. Run her
sixteen jobs — chases, heists, races, the harbor war — earn the cash, and
buy your way out before the city eats you.

## The city

- A 522×522 m grid city: downtown towers, the Casino Strip, the marina and
  its yacht, the Old Town and lighthouse, the boardwalk pier, and the
  airfield in the north-east.
- Day/night cycle, weather, traffic, pedestrians, police who chase, and a
  police helicopter that joins the hunt when the heat rises.
- Boats in the marina basin, a plane job at the airfield, slots at the
  casino, taxi fares, street races, and hidden packages to collect.

## Systems

- **16 missions** — a full story arc from Rico's first errand for Madame
  Coral to the Harbor War finale.
- **Driving & NOS** — traffic cars, handbrake turns, NOS boost, police
  pursuits with wanted stars.
- **Combat** — five weapons (pistol, SMG, shotgun, rifle, sniper) with
  ammo, armor, and health.
- **Economy** — cash from jobs, fares, races and slots; spend it at the
  street shop (health, ammo, rifle ammo, NOS, armor) or rest at the
  safehouse ($300: save, heal, clear your wanted level).
- **Audio** — fully synthesized WebAudio: engine hum that follows your
  speed, two-tone police sirens, gunshots, and four radio stations
  (C to change, M to mute).
- **HUD & minimap** — cash, health/armor bars, wanted stars, objective,
  speed, clock, district name, mission tracker, and a live minimap.
- **Saves** — progress persists in localStorage (`solmar-city-v4`).

## Controls

| Keys | Action |
| --- | --- |
| WASD / Arrows | Move / drive |
| Shift | Sprint on foot / NOS boost while driving |
| Space | Jump on foot / handbrake while driving |
| E | Enter / exit car or boat |
| F | Punch |
| 1–5 | Weapons |
| C | Radio station |
| M | Mute |
| P / Esc | Pause (saves) |
| N | Skip to night |
| R | Race |
| Y | Taxi |
| Q | Slots |
| H / J / K / L / U | Shop buys (near the shop): health $150, ammo $100, rifle ammo $150, NOS $80, armor $250 |
| T | Safehouse $300 (near the safehouse) |

## Screenshots

The dossier shots are scripted scenarios, reproducible with
`?shot=chase`, `?shot=drive`, `?shot=foot` or `?shot=mission` — each runs
240 fixed simulation steps and signals readiness with
`window.__shotReady` and the page title `SHOT READY`. The four shots map
to `shots.json` in order: 1-chase, 2-drive, 3-foot, 4-mission.

## Hand-in

`node main.ts` copies `game/` and `screenshots/` to the output directory
(`MAKEFUN_OUTPUT_DIR`, else `/output`) and writes `dossier.json` with the
kit's `buildDossier`.
