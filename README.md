# OpenSky Flight

OpenSky Flight is a small, original 3D flight simulator that runs entirely in a desktop or mobile web browser. It uses procedural low-poly aircraft and scenery to deliver a lightweight third-person flying experience with no downloads, account, backend, or paid API.

The project was visually inspired by the broad menu, hangar, and flight-view structure of mobile flight simulators, but contains no copied game logos, models, textures, sounds, or proprietary content.

## Features

- Cinematic 3D hangar main menu
- Three original aircraft:
  - Skylark S2 light propeller aircraft
  - Horizon T8 twin-engine commuter aircraft
  - Swift J4 light business jet
- Refined low-poly aircraft with tapered wings, faceted fuselages, layered liveries, detailed cockpits, animated three-blade propellers, engine nacelles, navigation lights, and model-specific landing gear
- Four selectable regional airports with persistent origin and destination planning
- In-flight destination bearing, distance, direction pointer, approach state, and arrival detection
- Persistent route, aircraft selection, and settings using `localStorage`
- Two fully modeled airports per flight with runway lights, signs, taxiways, hangars, terminals, towers, and destination beacon
- Enhanced procedural scenery with a gradient sky, sun, clouds, terrain variation, coastlines, mountains, city buildings, trees, and aircraft navigation lights
- Simplified force-based flight model with gravity, thrust, lift, drag, stalls, ground steering, braking, takeoff, and landing
- Chase, cockpit-style, and side cameras
- Live speed, altitude, throttle, heading, vertical speed, and load-factor instruments
- Responsive touch controls for phones and tablets
- Procedural Web Audio engine tone with adjustable volume
- Pause, restart, reset, and main-menu flow

## Controls

### Desktop

| Control | Action |
| --- | --- |
| `W` / `S` | Increase / decrease throttle |
| `Arrow Up` / `Arrow Down` | Pitch up / down |
| `Arrow Left` / `Arrow Right` | Roll left / right |
| `A` / `D` | Rudder in flight or steering on the ground |
| `Space` | Wheel brakes |
| `C` | Change camera |
| `R` | Reset aircraft on the runway |
| `Esc` or `P` | Pause |

For takeoff, smoothly advance the throttle, keep the aircraft centered with `A` / `D`, then pitch up as the aircraft reaches rotation speed.

### Mobile

- Vertical throttle slider on the left
- Direction pad for pitch and roll
- `L` / `R` rudder buttons
- Brake, camera, and reset buttons

The flight screen disables page scrolling and browser touch gestures so the controls stay responsive.

## Local installation

Requirements:

- Node.js 22 or newer
- npm

```bash
git clone https://github.com/omidrahimirad/opensky-flight-simulator.git
cd opensky-flight-simulator
npm install
npm run dev
```

Open the local URL printed by Vite.

## Production build

```bash
npm run build
```

The static production site is created in `dist/`. Preview it locally with:

```bash
npm run preview
```

## GitHub Pages deployment

The repository includes [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml). Every push to `main`:

1. installs the locked npm dependencies,
2. creates the Vite production build,
3. uploads the static site, and
4. deploys it to GitHub Pages.

The Vite base path is automatically set to `/opensky-flight-simulator/` inside GitHub Actions. In the repository settings, Pages should use **GitHub Actions** as its source. The deployment URL is:

`https://omidrahimirad.github.io/opensky-flight-simulator/`

## Project structure

```text
src/
  data/       Aircraft, airport, route, and flight characteristics
  game/       Airport, audio, input, physics, and flight runtime
  scene/      Procedural aircraft and hangar rendering
  main.ts     Screen flow and interface wiring
  storage.ts  Local preferences
  styles.css  Responsive visual system and HUD
```

## Performance and compatibility

OpenSky Flight limits pixel density on mobile devices, uses low-poly geometry, restricts shadow resolution, avoids texture downloads, and updates the HUD at a lower frequency than the 3D render loop. A modern browser with WebGL and ES2020 support is required.

## License

Released under the MIT License. All simulator geometry, interface design, and procedural audio in this repository are original to OpenSky Flight.
