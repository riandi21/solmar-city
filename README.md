# Solmar City

An original sun-soaked coastal open-world crime game, built for the make.fun GTA 6 bounty. You are Rico Vega, a driver-for-hire who owes $5,000 to Madame Coral. Steal cars, run her jobs across a 9×9-block seaside city, outrun the Solmar PD as your wanted level climbs, and buy your way out of the debt — on foot or behind the wheel, with traffic, pedestrians, police chases, missions, combat, a HUD with a minimap, and saves.

[![GTA 6 bounty](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/riandi21/solmar-city/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/riandi21/solmar-city/reward.svg)](https://make.fun/bounty/gta6-01)

## Controls

- **W A S D / arrow keys** — drive or walk (camera-relative on foot)
- **Shift** — sprint · **Space** — jump
- **E** — enter / exit car
- **F** — punch · **Click** — shoot the pistol
- **1 / 2** — fists / pistol
- **Drag mouse** — orbit the chase camera
- **P / Esc** — pause · **M** — mute sound · **Enter** — confirm / restart

## How to play locally

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. No build step, no network requests — the game is plain static files under `game/`, with three.js vendored at `game/vendor/three.module.min.js`. Progress saves automatically to your browser (mission complete and every 30 seconds); **Continue** on the start screen picks it back up.

## The story

Four jobs stand between Rico and freedom: steal wheels for the Coral Club, run three packages across town against the clock, survive a three-star wanted level for a full minute, and pull the Marina Job with a crew. Each job pays; the debt is $5,000. The city — downtown towers, quiet residential streets, a beach on the south edge and a marina on the east — is yours to cross however you like. Just mind the blue lights.
