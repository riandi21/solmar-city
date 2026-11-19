# Solmar City

Solmar City is an original sun-soaked coastal open-world crime game, built
with three.js and plain static files — no network requests, no build step.
Open `game/index.html` in a desktop browser and play.

You are Rico Vega, a driver-for-hire who owes $5,000 to Madame Coral. Steal
cars, outrun the Solmar PD through a five-star wanted system, take on 24
story missions, and settle the score with the Dourado cartel in the
Dourado Revenge arc: tail their courier, raid their warehouse, ambush
their convoy, and storm the Don's penthouse.

## What is in the city

- A 9×9-block coastal city: downtown towers, Old Town and its lighthouse,
  the marina and its yacht, the boardwalk and ferris wheel, the airfield,
  the casino strip — and the new Docks district with its container yard,
  warehouses and gantry cranes.
- Driving with NOS boost and handbrake drifts, plus motorcycles with
  wheelies, a bike shop, and drivable marina boats.
- Traffic that overtakes and yields, pedestrians that flee, police cars
  that flank, roadblocks and spike strips, and a helicopter at four stars.
- Missions, street races (including a race through the Docks container
  rows), taxi jobs, 20 hidden packages, shops, a safehouse, and the
  Casino Heist arc.
- Properties to buy for passive income, and six territories to control
  and defend against rival gangs.
- A full day/night cycle, rain and fog, a WebAudio synth soundtrack with
  four radio stations, and a HUD with a live minimap.

## Run it

Serve the game locally and open it in a desktop browser:

```sh
node serve.ts
# then open http://localhost:8080
```

To hand the entry in, run the entrypoint with an output directory:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Controls

WASD move / drive · Shift sprint / NOS / wheelie · Space jump · E enter
or exit a vehicle · F punch · Click shoot · Right-click sniper zoom ·
1–5 swap weapons · C radio · M mute · B buy a property · P pause.

## Entry

This game was built for the make.fun GTA 6 bounty:
https://make.fun/bounty/gta6-01
