import './styles.css';
import { AIRCRAFT, getAircraft } from './data/aircraft';
import { AIRPORTS, getAirport, getRouteDistance } from './data/airports';
import { FlightGame } from './game/FlightGame';
import { HangarScene } from './scene/HangarScene';
import { loadRoute, loadSelectedAircraft, loadSettings, saveRoute, saveSelectedAircraft, saveSettings } from './storage';
import type { AircraftDefinition, RouteSelection, Settings } from './types';

class OpenSkyApp {
  private readonly root: HTMLElement;
  private hangar: HangarScene | null = null;
  private flight: FlightGame | null = null;
  private selectedIndex = 0;
  private settings: Settings = loadSettings();
  private route: RouteSelection = loadRoute();

  constructor(root: HTMLElement) {
    this.root = root;
    const savedAircraft = loadSelectedAircraft();
    this.selectedIndex = Math.max(0, AIRCRAFT.findIndex((aircraft) => aircraft.id === savedAircraft));
    this.renderLoading();
    window.setTimeout(() => this.showMainMenu(), 520);
  }

  private renderLoading(): void {
    this.root.innerHTML = `
      <main class="loading-screen">
        <div class="loading-mark" aria-hidden="true"><span></span><span></span><span></span></div>
        <p class="eyebrow">A lightweight browser flight experience</p>
        <h1>OpenSky <em>Flight</em></h1>
        <div class="loading-track"><span></span></div>
        <p class="loading-note">Preparing the hangar</p>
      </main>
    `;
  }

  private showMainMenu(): void {
    this.destroyScenes();
    const saved = loadSelectedAircraft();
    const activeAircraft = getAircraft(saved);
    const origin = getAirport(this.route.originId);
    const destination = getAirport(this.route.destinationId);
    this.root.innerHTML = `
      <main class="hangar-shell">
        <canvas id="hangar-canvas" class="scene-canvas" aria-hidden="true"></canvas>
        <div class="scene-vignette"></div>
        <header class="topbar">
          <a class="brand" href="#" aria-label="OpenSky Flight home">
            <span class="brand-mark" aria-hidden="true"><i></i><b></b></span>
            <span><strong>OpenSky</strong><small>FLIGHT</small></span>
          </a>
          <div class="topbar-status">
            <span><i class="status-dot"></i> SIM READY</span>
            <span class="hide-small">LOCAL WEATHER · CLEAR</span>
          </div>
        </header>

        <section class="menu-layout" aria-labelledby="menu-title">
          <div class="menu-copy">
            <p class="eyebrow">Your runway is waiting</p>
            <h1 id="menu-title">The horizon<br /><em>belongs to you.</em></h1>
            <p>Take an original low-poly aircraft from the apron to open sky. No downloads, no account—just fly.</p>
          </div>
          <nav class="menu-actions" aria-label="Main menu">
            <button class="menu-button primary" id="continue-button">
              <span class="button-icon">▶</span>
              <span><small>${saved ? 'RETURN TO THE RUNWAY' : 'START YOUR FIRST FLIGHT'}</small>Continue</span>
              <b>→</b>
            </button>
            <button class="menu-button" id="new-flight-button">
              <span class="button-icon">⌖</span>
              <span><small>${origin.code} → ${destination.code}</small>New Flight</span>
              <b>→</b>
            </button>
            <button class="menu-button" id="aircraft-button">
              <span class="button-icon">✈</span>
              <span><small>CURRENT · ${activeAircraft.name.toUpperCase()}</small>Aircraft</span>
              <b>→</b>
            </button>
            <button class="menu-button" id="settings-button">
              <span class="button-icon">⌁</span>
              <span><small>CONTROLS & AUDIO</small>Settings</span>
              <b>→</b>
            </button>
          </nav>
        </section>

        <footer class="menu-footer">
          <span>DESKTOP + TOUCH</span>
          <span class="footer-line"></span>
          <span>ORIGINAL LOW-POLY SIMULATOR</span>
        </footer>
        <div id="modal-layer"></div>
      </main>
    `;
    const canvas = this.requireElement<HTMLCanvasElement>('#hangar-canvas');
    this.hangar = new HangarScene(canvas, activeAircraft);
    this.requireElement('#continue-button').addEventListener('click', () => {
      if (saved) this.startFlight(activeAircraft);
      else this.showRoutePlanner();
    });
    this.requireElement('#new-flight-button').addEventListener('click', () => this.showRoutePlanner());
    this.requireElement('#aircraft-button').addEventListener('click', () => this.showAircraftSelection('menu'));
    this.requireElement('#settings-button').addEventListener('click', () => this.showSettings());
  }

  private showRoutePlanner(): void {
    const activeAircraft = AIRCRAFT[this.selectedIndex];
    const airportOptions = (selectedId: string): string =>
      AIRPORTS.map(
        (airport) =>
          `<option value="${airport.id}" ${airport.id === selectedId ? 'selected' : ''}>${airport.code} · ${airport.name}</option>`,
      ).join('');
    const origin = getAirport(this.route.originId);
    const destination = getAirport(this.route.destinationId);
    this.root.innerHTML = `
      <main class="hangar-shell route-shell">
        <canvas id="hangar-canvas" class="scene-canvas" aria-hidden="true"></canvas>
        <div class="scene-vignette"></div>
        <header class="topbar">
          <button class="round-button" id="route-back-button" aria-label="Back to main menu">←</button>
          <a class="brand" href="#" aria-label="OpenSky Flight">
            <span class="brand-mark" aria-hidden="true"><i></i><b></b></span>
            <span><strong>OpenSky</strong><small>FLIGHT</small></span>
          </a>
          <div class="fleet-count">FLIGHT <span>PLANNER</span></div>
        </header>
        <section class="route-layout" aria-labelledby="route-title">
          <div class="route-heading">
            <p class="eyebrow">Plan your journey</p>
            <h1 id="route-title">Choose your <em>route.</em></h1>
            <p>Depart from one regional airport and navigate to another. The destination beacon and HUD will guide you.</p>
          </div>
          <div class="route-map" aria-hidden="true">
            <div class="map-grid"></div>
            <span class="map-node origin-node"><i></i><b id="map-origin-code">${origin.code}</b></span>
            <span class="map-route-line"><i>✈</i></span>
            <span class="map-node destination-node"><i></i><b id="map-destination-code">${destination.code}</b></span>
          </div>
          <aside class="route-panel">
            <div class="route-select-card">
              <span class="route-index">01</span>
              <label for="origin-airport">ORIGIN</label>
              <select id="origin-airport">${airportOptions(origin.id)}</select>
              <small id="origin-region">${origin.region}</small>
            </div>
            <button class="swap-route" id="swap-route" aria-label="Swap origin and destination">⇄</button>
            <div class="route-select-card">
              <span class="route-index">02</span>
              <label for="destination-airport">DESTINATION</label>
              <select id="destination-airport">${airportOptions(destination.id)}</select>
              <small id="destination-region">${destination.region}</small>
            </div>
            <div class="route-summary">
              <div><small>DISTANCE</small><strong id="route-distance">${(getRouteDistance(this.route) / 1000).toFixed(1)} KM</strong></div>
              <div><small>EST. FLIGHT</small><strong id="route-duration">${Math.max(3, Math.round(getRouteDistance(this.route) / 1150))} MIN</strong></div>
            </div>
            <button class="select-button" id="confirm-route"><span>CONFIRM ROUTE</span><b>CHOOSE AIRCRAFT →</b></button>
          </aside>
        </section>
      </main>
    `;
    this.hangar?.destroy();
    this.hangar = new HangarScene(this.requireElement<HTMLCanvasElement>('#hangar-canvas'), activeAircraft);
    const originSelect = this.requireElement<HTMLSelectElement>('#origin-airport');
    const destinationSelect = this.requireElement<HTMLSelectElement>('#destination-airport');
    const refreshRoute = (changed: 'origin' | 'destination'): void => {
      if (originSelect.value === destinationSelect.value) {
        const currentIndex = AIRPORTS.findIndex((airport) => airport.id === originSelect.value);
        if (changed === 'origin') destinationSelect.value = AIRPORTS[(currentIndex + 1) % AIRPORTS.length].id;
        else originSelect.value = AIRPORTS[(currentIndex + AIRPORTS.length - 1) % AIRPORTS.length].id;
      }
      this.route = {
        originId: originSelect.value as RouteSelection['originId'],
        destinationId: destinationSelect.value as RouteSelection['destinationId'],
      };
      const nextOrigin = getAirport(this.route.originId);
      const nextDestination = getAirport(this.route.destinationId);
      const distance = getRouteDistance(this.route);
      this.setText('#map-origin-code', nextOrigin.code);
      this.setText('#map-destination-code', nextDestination.code);
      this.setText('#origin-region', nextOrigin.region);
      this.setText('#destination-region', nextDestination.region);
      this.setText('#route-distance', `${(distance / 1000).toFixed(1)} KM`);
      this.setText('#route-duration', `${Math.max(3, Math.round(distance / 1150))} MIN`);
    };
    originSelect.addEventListener('change', () => refreshRoute('origin'));
    destinationSelect.addEventListener('change', () => refreshRoute('destination'));
    this.requireElement('#swap-route').addEventListener('click', () => {
      const originValue = originSelect.value;
      originSelect.value = destinationSelect.value;
      destinationSelect.value = originValue;
      refreshRoute('origin');
    });
    this.requireElement('#route-back-button').addEventListener('click', () => this.showMainMenu());
    this.requireElement('#confirm-route').addEventListener('click', () => {
      saveRoute(this.route);
      this.showAircraftSelection('route');
    });
  }

  private showAircraftSelection(backTarget: 'menu' | 'route' = 'menu'): void {
    const aircraft = AIRCRAFT[this.selectedIndex];
    this.root.innerHTML = `
      <main class="hangar-shell selection-shell">
        <canvas id="hangar-canvas" class="scene-canvas" aria-hidden="true"></canvas>
        <div class="scene-vignette"></div>
        <header class="topbar">
          <button class="round-button" id="back-button" aria-label="Back to main menu">←</button>
          <a class="brand" href="#" aria-label="OpenSky Flight">
            <span class="brand-mark" aria-hidden="true"><i></i><b></b></span>
            <span><strong>OpenSky</strong><small>FLIGHT</small></span>
          </a>
          <div class="fleet-count"><span id="aircraft-number">${this.selectedIndex + 1}</span> / ${AIRCRAFT.length}</div>
        </header>

        <section class="selection-layout" aria-live="polite">
          <button class="aircraft-arrow previous" id="previous-aircraft" aria-label="Previous aircraft">←</button>
          <button class="aircraft-arrow next" id="next-aircraft" aria-label="Next aircraft">→</button>
          <div class="selection-title">
            <p class="eyebrow" id="aircraft-type">${aircraft.type}</p>
            <h1 id="aircraft-name">${aircraft.name}</h1>
            <p id="aircraft-tagline">${aircraft.tagline}</p>
            <div class="selection-route-chip">${getAirport(this.route.originId).code} <b>→</b> ${getAirport(this.route.destinationId).code}</div>
          </div>
          <aside class="aircraft-card">
            <div class="card-kicker">AIRCRAFT PROFILE</div>
            <div class="aircraft-stat-grid">
              <div><small>TOP SPEED</small><strong id="stat-speed">${aircraft.topSpeed}</strong><span>KM/H</span></div>
              <div><small>RANGE</small><strong id="stat-range">${aircraft.range}</strong><span>KM</span></div>
              <div><small>STALL SPEED</small><strong id="stat-stall">${Math.round(aircraft.stallSpeed * 3.6)}</strong><span>KM/H</span></div>
              <div><small>SEATS</small><strong id="stat-seats">${aircraft.seats}</strong><span>PEOPLE</span></div>
            </div>
            <div class="handling-row">
              <span>HANDLING</span>
              <div class="handling-bars"><i></i><i></i><i></i><i></i><i></i></div>
            </div>
            <button class="select-button" id="select-aircraft">
              <span>SELECT AIRCRAFT</span><b>START FLIGHT →</b>
            </button>
          </aside>
          <div class="swipe-hint">← &nbsp; BROWSE FLEET &nbsp; →</div>
        </section>
      </main>
    `;
    this.hangar?.destroy();
    this.hangar = new HangarScene(this.requireElement<HTMLCanvasElement>('#hangar-canvas'), aircraft);
    this.hangar.setMode('selection');
    this.requireElement('#back-button').addEventListener('click', () =>
      backTarget === 'route' ? this.showRoutePlanner() : this.showMainMenu(),
    );
    this.requireElement('#previous-aircraft').addEventListener('click', () => this.stepAircraft(-1));
    this.requireElement('#next-aircraft').addEventListener('click', () => this.stepAircraft(1));
    this.requireElement('#select-aircraft').addEventListener('click', () => {
      const selected = AIRCRAFT[this.selectedIndex];
      saveSelectedAircraft(selected.id);
      saveRoute(this.route);
      this.startFlight(selected);
    });
    this.bindSelectionSwipe();
  }

  private stepAircraft(direction: number): void {
    this.selectedIndex = (this.selectedIndex + direction + AIRCRAFT.length) % AIRCRAFT.length;
    const aircraft = AIRCRAFT[this.selectedIndex];
    this.hangar?.setAircraft(aircraft);
    this.setText('#aircraft-number', String(this.selectedIndex + 1));
    this.setText('#aircraft-type', aircraft.type);
    this.setText('#aircraft-name', aircraft.name);
    this.setText('#aircraft-tagline', aircraft.tagline);
    this.setText('#stat-speed', String(aircraft.topSpeed));
    this.setText('#stat-range', String(aircraft.range));
    this.setText('#stat-stall', String(Math.round(aircraft.stallSpeed * 3.6)));
    this.setText('#stat-seats', String(aircraft.seats));
    document.documentElement.style.setProperty('--aircraft-accent', aircraft.accentCss);
  }

  private bindSelectionSwipe(): void {
    let startX = 0;
    const shell = this.requireElement('.selection-layout');
    shell.addEventListener('pointerdown', (event) => {
      startX = event.clientX;
    });
    shell.addEventListener('pointerup', (event) => {
      const distance = event.clientX - startX;
      if (Math.abs(distance) > 65) this.stepAircraft(distance > 0 ? -1 : 1);
    });
  }

  private showSettings(): void {
    const layer = this.requireElement('#modal-layer');
    layer.innerHTML = `
      <div class="modal-backdrop" role="presentation">
        <section class="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
          <div class="modal-heading">
            <div><p class="eyebrow">Flight setup</p><h2 id="settings-title">Settings</h2></div>
            <button class="round-button" id="close-settings" aria-label="Close settings">×</button>
          </div>
          <label class="setting-row">
            <span><strong>Control sensitivity</strong><small>Adjust pitch, roll, and rudder response</small></span>
            <output id="sensitivity-value">${this.settings.sensitivity.toFixed(2)}×</output>
            <input id="sensitivity-input" type="range" min="0.55" max="1.6" step="0.05" value="${this.settings.sensitivity}" />
          </label>
          <label class="setting-row">
            <span><strong>Engine volume</strong><small>Procedurally generated engine audio</small></span>
            <output id="volume-value">${Math.round(this.settings.volume * 100)}%</output>
            <input id="volume-input" type="range" min="0" max="1" step="0.05" value="${this.settings.volume}" />
          </label>
          <div class="control-reference">
            <p>DESKTOP QUICK REFERENCE</p>
            <div><kbd>W</kbd><kbd>S</kbd><span>Throttle</span></div>
            <div><kbd>↑</kbd><kbd>↓</kbd><span>Pitch</span></div>
            <div><kbd>←</kbd><kbd>→</kbd><span>Roll</span></div>
            <div><kbd>A</kbd><kbd>D</kbd><span>Rudder</span></div>
          </div>
          <button class="select-button" id="save-settings"><span>SAVE SETTINGS</span><b>DONE →</b></button>
        </section>
      </div>
    `;
    const sensitivity = this.requireElement<HTMLInputElement>('#sensitivity-input');
    const volume = this.requireElement<HTMLInputElement>('#volume-input');
    sensitivity.addEventListener('input', () => this.setText('#sensitivity-value', `${Number(sensitivity.value).toFixed(2)}×`));
    volume.addEventListener('input', () => this.setText('#volume-value', `${Math.round(Number(volume.value) * 100)}%`));
    const close = (): void => {
      layer.innerHTML = '';
    };
    this.requireElement('#close-settings').addEventListener('click', close);
    this.requireElement('.modal-backdrop').addEventListener('click', (event) => {
      if (event.target === event.currentTarget) close();
    });
    this.requireElement('#save-settings').addEventListener('click', () => {
      this.settings = { sensitivity: Number(sensitivity.value), volume: Number(volume.value) };
      saveSettings(this.settings);
      close();
    });
  }

  private startFlight(aircraft: AircraftDefinition): void {
    saveRoute(this.route);
    this.hangar?.destroy();
    this.hangar = null;
    this.root.innerHTML = this.flightMarkup(aircraft);
    const container = this.requireElement<HTMLElement>('.flight-shell');
    this.flight = new FlightGame({
      container,
      canvas: this.requireElement<HTMLCanvasElement>('#flight-canvas'),
      aircraft,
      route: this.route,
      settings: this.settings,
      onPause: () => this.togglePause(true),
    });
    this.requireElement('#pause-button').addEventListener('click', () => this.togglePause(true));
    this.requireElement('#camera-button').addEventListener('click', () => this.flight?.changeCamera());
    this.requireElement('#reset-button').addEventListener('click', () => this.flight?.reset());
    this.requireElement('#mobile-camera').addEventListener('click', () => this.flight?.changeCamera());
    this.requireElement('#mobile-reset').addEventListener('click', () => this.flight?.reset());
    this.requireElement('#complete-restart').addEventListener('click', () => {
      this.flight?.reset();
      this.flight?.setPaused(false);
    });
    this.requireElement('#complete-main-menu').addEventListener('click', () => this.showMainMenu());
    this.flight.setPaused(false);
    window.setTimeout(() => this.root.querySelector('.flight-loading')?.classList.add('is-hidden'), 650);
  }

  private togglePause(paused: boolean): void {
    const menu = this.root.querySelector<HTMLElement>('#pause-menu');
    if (!menu) return;
    menu.classList.toggle('is-visible', paused);
    this.flight?.setPaused(paused);
    if (!paused) return;
    const resume = this.requireElement('#resume-button');
    const restart = this.requireElement('#restart-button');
    const mainMenu = this.requireElement('#main-menu-button');
    resume.onclick = () => this.togglePause(false);
    restart.onclick = () => {
      this.flight?.reset();
      this.togglePause(false);
    };
    mainMenu.onclick = () => this.showMainMenu();
  }

  private flightMarkup(aircraft: AircraftDefinition): string {
    const origin = getAirport(this.route.originId);
    const destination = getAirport(this.route.destinationId);
    return `
      <main class="flight-shell">
        <canvas id="flight-canvas" class="scene-canvas" aria-label="3D flight simulator"></canvas>
        <div class="flight-shade"></div>
        <header class="flight-topbar">
          <button class="glass-button pause-button" id="pause-button" aria-label="Pause flight">Ⅱ</button>
          <div class="flight-identity"><span>${aircraft.name}</span><small id="flight-phase">READY</small></div>
          <div class="route-guidance">
            <div class="route-codes"><span>${origin.code}</span><i>→</i><strong id="destination-code">${destination.code}</strong></div>
            <div class="route-nav"><b id="destination-pointer">↑</b><span id="destination-distance">${(getRouteDistance(this.route) / 1000).toFixed(1)} KM</span><small id="destination-bearing">000°</small></div>
          </div>
          <div class="top-controls">
            <button class="glass-button wide" id="camera-button"><span>CAMERA</span><b id="camera-label">CHASE</b></button>
            <button class="glass-button wide" id="reset-button"><span>RESET</span><b>R</b></button>
          </div>
        </header>

        <section class="hud" aria-label="Flight instruments">
          <div class="hud-left">
            <div class="instrument vertical-instrument">
              <small>THROTTLE</small>
              <div class="throttle-gauge"><i id="throttle-fill"></i><b></b></div>
              <strong id="hud-throttle">0%</strong>
            </div>
          </div>
          <div class="heading-tape">
            <div id="compass-tape">W · · · 270 · · · N · · · 000 · · · E · · · 090 · · · S · · · 180 · · · W</div>
            <span></span>
          </div>
          <div class="hud-bottom">
            <div class="instrument-panel">
              <div class="readout speed-readout"><small>SPEED</small><strong id="hud-speed">0</strong><span>KM/H</span></div>
              <div class="readout altitude-readout"><small>ALTITUDE</small><strong id="hud-altitude">0</strong><span>METERS</span></div>
              <div class="navigation-display">
                <canvas id="nav-radar" width="220" height="220" role="img" aria-label="Live route navigation radar"></canvas>
                <div class="nav-display-top"><span>NAV</span><b><small>HDG</small><strong id="hud-heading">000</strong>°</b></div>
                <div class="nav-display-bottom"><span id="radar-range">RNG 10 KM</span><b id="radar-dme">DME 0.0</b><em id="radar-eta">ETA --</em></div>
              </div>
              <div class="readout secondary"><small>VERTICAL</small><strong id="hud-vspeed">+0.0</strong><span>M/S</span></div>
              <div class="readout secondary"><small>LOAD</small><strong id="hud-gforce">1.0 G</strong><span>FORCE</span></div>
            </div>
            <div class="desktop-control-hint"><kbd>W/S</kbd> THROTTLE <kbd>ARROWS</kbd> PITCH + ROLL <kbd>A/D</kbd> RUDDER <kbd>SPACE</kbd> BRAKE</div>
          </div>
          <div class="stall-warning" id="stall-warning">STALL · LOWER NOSE</div>
          <div class="flight-toast" id="flight-toast"></div>
        </section>

        <section class="mobile-controls" aria-label="Touch flight controls">
          <div class="mobile-throttle">
            <label for="mobile-throttle">THR</label>
            <input id="mobile-throttle" type="range" min="0" max="1" step="0.01" value="0" orient="vertical" />
          </div>
          <div class="touch-yoke">
            <button data-control="pitch-up" aria-label="Pitch up">↑</button>
            <button data-control="roll-left" aria-label="Roll left">←</button>
            <span>✦</span>
            <button data-control="roll-right" aria-label="Roll right">→</button>
            <button data-control="pitch-down" aria-label="Pitch down">↓</button>
          </div>
          <div class="rudder-controls">
            <button data-control="yaw-left" aria-label="Rudder left">L</button>
            <button data-control="yaw-right" aria-label="Rudder right">R</button>
          </div>
          <button class="mobile-brake" data-control="brake">BRAKE</button>
          <div class="mobile-actions">
            <button id="mobile-camera">CAM</button>
            <button id="mobile-reset">RESET</button>
          </div>
        </section>

        <div class="pause-menu" id="pause-menu">
          <section class="pause-card">
            <p class="eyebrow">Flight paused</p>
            <h2>Take a breath.</h2>
            <p>Your aircraft is holding position.</p>
            <div class="pause-route"><span>${origin.code}</span><i>→</i><strong>${destination.code}</strong><small>${origin.name} to ${destination.name}</small></div>
            <button class="select-button" id="resume-button"><span>RESUME</span><b>CONTINUE →</b></button>
            <button class="pause-option" id="restart-button">Restart flight <b>↻</b></button>
            <button class="pause-option" id="main-menu-button">Main menu <b>⌂</b></button>
          </section>
        </div>
        <div class="flight-complete" id="flight-complete" role="dialog" aria-modal="true" aria-labelledby="complete-title">
          <section class="complete-card">
            <div class="complete-badge" aria-hidden="true">✓</div>
            <p class="eyebrow">Mission successful</p>
            <h2 id="complete-title">Flight complete.</h2>
            <p>You landed safely at <strong>${destination.name}</strong>.</p>
            <div class="complete-route"><span>${origin.code}</span><i>→</i><strong>${destination.code}</strong></div>
            <div class="complete-stats">
              <div><small>FLIGHT TIME</small><strong id="complete-time">00:00</strong></div>
              <div><small>TOUCHDOWN</small><strong id="complete-landing-speed">-- KM/H</strong></div>
              <div><small>FINAL HDG</small><strong id="complete-heading">000°</strong></div>
            </div>
            <button class="select-button" id="complete-restart"><span>FLY AGAIN</span><b>RESTART →</b></button>
            <button class="pause-option" id="complete-main-menu">Main menu <b>⌂</b></button>
          </section>
        </div>
        <div class="flight-loading">
          <div class="loading-mark"><span></span><span></span><span></span></div>
          <strong>Rolling out ${aircraft.name}</strong>
          <small>${origin.code} → ${destination.code} · CLEAR FOR DEPARTURE</small>
        </div>
      </main>
    `;
  }

  private setText(selector: string, text: string): void {
    const element = this.root.querySelector<HTMLElement>(selector);
    if (element) element.textContent = text;
  }

  private requireElement<T extends Element = HTMLElement>(selector: string): T {
    const element = this.root.querySelector<T>(selector);
    if (!element) throw new Error(`Missing required element: ${selector}`);
    return element;
  }

  private destroyScenes(): void {
    this.hangar?.destroy();
    this.flight?.destroy();
    this.hangar = null;
    this.flight = null;
  }
}

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('OpenSky Flight could not find the app container.');
new OpenSkyApp(root);
