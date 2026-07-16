/* PlotMaps interactive globe engine.
   Vendored from Greg's design handoff (globe-engine.js), converted from a
   window-global IIFE to an ES module. D3 (d3-geo) + topojson-client are now
   npm imports. GlobeApp(canvas, opts) — opts.palette, opts.onLevelChange,
   opts.onEnterArea, opts.onHover. The 2D canvas polygon globe: every country/
   state is a real clickable shape (colors fully ours to control).
   eslint-disable — vendored engine, kept close to source. */
/* eslint-disable */
import { geoCentroid, geoContains, geoDistance, geoGraticule, geoOrthographic, geoPath } from 'd3-geo';
import * as topojson from 'topojson-client';

// shim so the vendored body's `d3.geoX(...)` calls resolve to the imports
const d3 = { geoCentroid, geoContains, geoDistance, geoGraticule, geoOrthographic, geoPath };

const GlobeApp = (function () {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const easeCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const shortestDelta = (from, to) => { let d = (to - from) % 360; if (d > 180) d -= 360; if (d < -180) d += 360; return d; };

  // Curated markets that fly into the island hero. state = US sub-region for the states level.
  const MARKETS = [
    { id: 'newyork',  name: 'New York',  sub: 'Manhattan, NY',   lon: -74.0, lat: 40.71, country: 'United States of America', state: 'New York' },
    { id: 'vegas',    name: 'Las Vegas', sub: 'Nevada, USA',     lon: -115.14, lat: 36.17, country: 'United States of America', state: 'Nevada' },
    { id: 'paris',    name: 'Paris',     sub: 'Île-de-France',   lon: 2.35,  lat: 48.86, country: 'France' },
    { id: 'acapulco', name: 'Acapulco',  sub: 'Guerrero, MX',    lon: -99.82, lat: 16.86, country: 'Mexico' },
    { id: 'sydney',   name: 'Sydney',    sub: 'New South Wales', lon: 151.21, lat: -33.87, country: 'Australia' },
  ];

  function guessTargetLonLat() {
    let tz = '';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
    const m = MARKETS.find(k => tz.includes(k.name.replace(' ', '_')) || tz.endsWith('/' + k.name.replace(' ', '_')));
    if (m) return m;
    if (/Australia/i.test(tz)) return MARKETS.find(k => k.id === 'sydney');
    if (/Europe|Paris|Berlin|Madrid|Rome|London/i.test(tz)) return MARKETS.find(k => k.id === 'paris');
    if (/Mexico/i.test(tz)) return MARKETS.find(k => k.id === 'acapulco');
    return MARKETS.find(k => k.id === 'newyork'); // default USA
  }

  class GlobeApp {
    constructor(canvas, opts) {
      this.c = canvas;
      this.ctx = canvas.getContext('2d');
      this.opts = opts || {};
      this.pal = opts.palette;
      this.level = 0;              // 0 world, 1 country/states
      this.rotate = [-20, -15, 0];
      this.baseScaleFactor = 0.42; // of min(w,h)/2 ... set in resize
      this.scaleFactor = this.baseScaleFactor;
      this.dragging = false;
      this.moved = 0;
      this.autoIdleUntil = 0;
      this.anim = null;
      this.hover = null;
      this.currentCountry = null;
      this.stateFeatures = null;
      this.enteredArea = null;
      this._bind();
    }

    setData({ countries, land, states }) {
      this.countries = countries;   // GeoJSON FeatureCollection
      this.land = land;             // merged land (Feature)
      this.states = states;         // US states FeatureCollection
      this.ready = true;
      // fly to the guessed home market on first load
      const g = guessTargetLonLat();
      this.homeMarket = g;
      this.rotate = [-g.lon * 0.6, -10, 0];
      this.animateTo({ rotate: [-g.lon, -g.lat * 0.55, 0], scale: this.baseScaleFactor, dur: 2600, ease: easeCubic }, () => {
        this.highlightCountryByName(g.country);
      });
    }

    highlightCountryByName(name) {
      if (!this.countries) return;
      this.hover = this.countries.features.find(f => (f.properties && f.properties.name) === name) || null;
      this._emitHover();
    }

    _bind() {
      const c = this.c;
      c.style.touchAction = 'none';
      c.style.cursor = 'grab';
      this._pointers = new Map();
      this._pinchDist = 0;
      this.minScaleFactor = this.baseScaleFactor * 0.85;
      this.maxScaleFactor = this.baseScaleFactor * 8;
      this._down = (e) => {
        this._pointers.set(e.pointerId, this._pt(e));
        c.setPointerCapture && c.setPointerCapture(e.pointerId);
        this.anim = null;
        if (this._pointers.size === 2) {   // begin pinch
          this.dragging = false;
          this._pinchDist = this._twoDist();
          this._pinchScale0 = this.scaleFactor;
        } else {
          this.dragging = true; this.moved = 0;
          this._last = this._pt(e);
          c.style.cursor = 'grabbing';
        }
      };
      this._move = (e) => {
        const p = this._pt(e);
        if (this._pointers.has(e.pointerId)) this._pointers.set(e.pointerId, p);
        if (this._pointers.size >= 2) {     // pinch zoom
          const d = this._twoDist();
          if (this._pinchDist > 0) this._setZoom(this._pinchScale0 * (d / this._pinchDist));
          this.autoIdleUntil = performance.now() + 999999;
          return;
        }
        if (this.dragging) {
          const k = 0.32 * (this.baseScaleFactor / this.scaleFactor);
          const dx = p.x - this._last.x, dy = p.y - this._last.y;
          this.moved += Math.abs(dx) + Math.abs(dy);
          this.rotate[0] += dx * k;
          this.rotate[1] = clamp(this.rotate[1] - dy * k, -85, 85);
          this._last = p;
          this.autoIdleUntil = performance.now() + 3500;
        } else {
          this._hoverTest(p.x, p.y);
        }
      };
      this._up = (e) => {
        this._pointers.delete(e.pointerId);
        if (this._pointers.size < 2) this._pinchDist = 0;
        if (!this.dragging) return;
        this.dragging = false; c.style.cursor = 'grab';
        if (this.moved < 6) this._click(this._pt(e));
        this.autoIdleUntil = performance.now() + 3500;
      };
      this._wheel = (e) => {
        e.preventDefault();
        this.anim = null;
        const factor = Math.exp(-e.deltaY * 0.0016);
        this._setZoom(this.scaleFactor * factor);
        this.autoIdleUntil = performance.now() + (this.scaleFactor > this.baseScaleFactor * 1.05 ? 999999 : 3500);
      };
      this._leave = () => { if (this.hover && !this.hoverLocked) { this.hover = null; this._emitHover(); } };
      c.addEventListener('pointerdown', this._down);
      c.addEventListener('pointermove', this._move);
      window.addEventListener('pointerup', this._up);
      c.addEventListener('pointercancel', this._up);
      c.addEventListener('wheel', this._wheel, { passive: false });
      c.addEventListener('pointerleave', this._leave);
    }

    _pt(e) {
      const r = this.c.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }

    _twoDist() {
      const pts = [...this._pointers.values()];
      return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    }

    _setZoom(sf) {
      this.scaleFactor = clamp(sf, this.minScaleFactor, this.maxScaleFactor);
    }

    zoomBy(mult) {
      this.anim = null;
      this._setZoom(this.scaleFactor * mult);
      this.autoIdleUntil = performance.now() + (this.scaleFactor > this.baseScaleFactor * 1.05 ? 999999 : 3500);
    }

    resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = this.c.clientWidth, h = this.c.clientHeight;
      this.c.width = w * dpr; this.c.height = h * dpr;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.w = w; this.h = h;
      this.cx = w / 2; this.cy = h / 2;
      this.R = Math.min(w, h) / 2 - 6;
      this._buildProjection();
    }

    _buildProjection() {
      if (!this.R) return;
      this.projection = d3.geoOrthographic()
        .translate([this.cx, this.cy])
        .scale(this.R * (this.scaleFactor / this.baseScaleFactor))
        .rotate(this.rotate)
        .clipAngle(90);
      this.path = d3.geoPath(this.projection, this.ctx);
    }

    start() { this._running = true; this._loop(); }
    stop() { this._running = false; if (this._raf) cancelAnimationFrame(this._raf); }

    _loop() {
      if (!this._running) return;
      const now = performance.now();
      // animation
      if (this.anim) {
        const a = this.anim;
        const t = clamp((now - a.t0) / a.dur, 0, 1);
        const e = (a.ease || easeCubic)(t);
        this.rotate = [a.r0[0] + a.dr[0] * e, a.r0[1] + a.dr[1] * e, 0];
        this.scaleFactor = a.s0 + (a.s1 - a.s0) * e;
        if (t >= 1) { const cb = a.then; this.anim = null; cb && cb(); }
      } else if (this.level === 0 && !this.dragging && !this.enteredArea && now > this.autoIdleUntil) {
        this.rotate[0] += 0.12; // slow auto-spin
      }
      this._buildProjection();
      this._draw();
      this._raf = requestAnimationFrame(() => this._loop());
    }

    animateTo({ rotate, scale, dur, ease }, then) {
      const r0 = this.rotate.slice();
      this.anim = {
        t0: performance.now(), dur: dur || 900, ease,
        r0, dr: [shortestDelta(r0[0], rotate[0]), rotate[1] - r0[1]],
        s0: this.scaleFactor, s1: scale != null ? scale : this.scaleFactor,
        then,
      };
    }

    _visible(lon, lat) {
      const r = this.projection.rotate();
      const center = [-r[0], -r[1]];
      return d3.geoDistance(center, [lon, lat]) < Math.PI / 2 - 0.02;
    }

    _hoverTest(x, y) {
      if (!this.ready || this.anim) return;
      const ll = this.projection.invert && this.projection.invert([x, y]);
      let f = null;
      const set = this.level === 1 && this.states && this.currentCountry && this.currentCountry.properties.name === 'United States of America' ? this.states.features : this.countries.features;
      if (ll && isFinite(ll[0])) {
        for (const feat of set) { if (d3.geoContains(feat, ll)) { f = feat; break; } }
      }
      if (f !== this.hover) { this.hover = f; this._emitHover(); this.c.style.cursor = f ? 'pointer' : 'grab'; }
    }

    _emitHover() {
      const n = this.hover && this.hover.properties ? (this.hover.properties.name) : null;
      this.opts.onHover && this.opts.onHover(n);
    }

    _click(p) {
      if (!this.ready) return;
      // pin hit-test first
      const pins = this.level === 0 ? MARKETS : MARKETS.filter(m => this.currentCountry && m.country === this.currentCountry.properties.name);
      for (const m of pins) {
        if (!this._visible(m.lon, m.lat)) continue;
        const xy = this.projection([m.lon, m.lat]);
        if (xy && Math.hypot(xy[0] - p.x, xy[1] - p.y) < 16) { this._selectMarket(m); return; }
      }
      const ll = this.projection.invert([p.x, p.y]);
      if (!ll || !isFinite(ll[0])) return;
      if (this.level === 0) {
        const country = this.countries.features.find(f => d3.geoContains(f, ll));
        if (country) this._enterCountry(country);
      } else if (this.level === 1) {
        if (this.currentCountry && this.currentCountry.properties.name === 'United States of America' && this.states) {
          const st = this.states.features.find(f => d3.geoContains(f, ll));
          if (st) this._enterArea(st.properties.name, st);
        }
      }
    }

    _selectMarket(m) {
      if (m.country === 'United States of America' && this.states) {
        // enter country then area (state) with the market label
        const country = this.countries.features.find(f => f.properties.name === m.country);
        this.currentCountry = country; this.level = 1; this.opts.onLevelChange && this.opts.onLevelChange(1, country.properties.name);
        this._flyTo(country, () => this._enterArea(m.name, null, m));
      } else {
        const country = this.countries.features.find(f => f.properties.name === m.country);
        if (country) { this.currentCountry = country; }
        this._enterArea(m.name, null, m);
      }
    }

    _flyTo(feature, then) {
      const c = d3.geoCentroid(feature);
      // fit scale to feature bounds
      const tmp = d3.geoOrthographic().translate([this.cx, this.cy]).rotate([-c[0], -c[1], 0]).clipAngle(90);
      const pathTmp = d3.geoPath(tmp);
      tmp.scale(this.R);
      const b = pathTmp.bounds(feature);
      const spanX = (b[1][0] - b[0][0]) || 1, spanY = (b[1][1] - b[0][1]) || 1;
      const fit = 0.55 * Math.min(this.w / spanX, this.h / spanY);
      const targetScaleFactor = clamp(this.baseScaleFactor * fit, this.baseScaleFactor, this.baseScaleFactor * 4.5);
      this.autoIdleUntil = performance.now() + 999999;
      this.animateTo({ rotate: [-c[0], -c[1], 0], scale: targetScaleFactor, dur: 1100, ease: easeCubic }, then);
    }

    _enterCountry(country) {
      this.currentCountry = country;
      this.level = 1;
      this.hover = null; this._emitHover();
      this.opts.onLevelChange && this.opts.onLevelChange(1, country.properties.name);
      this._flyTo(country);
    }

    _enterArea(name, feature, market) {
      this.enteredArea = { name, market: market || MARKETS.find(m => m.name === name) || null };
      if (feature) this._flyTo(feature);
      this.opts.onEnterArea && this.opts.onEnterArea(name, this.enteredArea.market);
    }

    back() {
      if (this.enteredArea) {
        this.enteredArea = null;
        this.opts.onEnterArea && this.opts.onEnterArea(null, null);
        if (this.level === 1) { this.autoIdleUntil = performance.now() + 4000; return; }
      }
      if (this.level === 1) {
        this.level = 0; this.currentCountry = null; this.hover = null; this._emitHover();
        this.opts.onLevelChange && this.opts.onLevelChange(0, null);
        this.autoIdleUntil = performance.now() + 4000;
        this.animateTo({ rotate: [this.rotate[0], -12, 0], scale: this.baseScaleFactor, dur: 1000, ease: easeCubic });
      }
    }

    markets() { return MARKETS; }

    _draw() {
      const ctx = this.ctx, pal = this.pal, path = this.path;
      ctx.clearRect(0, 0, this.w, this.h);
      if (!this.ready) return;
      const cx = this.cx, cy = this.cy, R = this.projection.scale();

      // ocean sphere
      if (pal.oceanStops) {
        const g = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.35, R * 0.1, cx, cy, R);
        pal.oceanStops.forEach(s => g.addColorStop(s[0], s[1]));
        ctx.fillStyle = g;
      } else ctx.fillStyle = pal.ocean;
      ctx.beginPath(); path({ type: 'Sphere' }); ctx.fill();

      // graticule
      if (pal.graticule) {
        ctx.beginPath(); path(d3.geoGraticule10());
        ctx.strokeStyle = pal.graticule; ctx.lineWidth = 0.6; ctx.stroke();
      }

      const isUS = this.level === 1 && this.currentCountry && this.currentCountry.properties.name === 'United States of America' && this.states;

      // land
      ctx.beginPath(); path(this.land);
      ctx.fillStyle = pal.land; ctx.fill();
      if (pal.landStroke) { ctx.lineWidth = 0.5; ctx.strokeStyle = pal.landStroke; ctx.stroke(); }

      // country / state outlines
      const set = isUS ? this.states.features : this.countries.features;
      if (pal.borders) {
        ctx.beginPath();
        for (const f of set) path(f);
        ctx.strokeStyle = pal.borders; ctx.lineWidth = 0.5; ctx.stroke();
      }

      // current country emphasis at level 1
      if (this.level === 1 && this.currentCountry && !isUS) {
        ctx.beginPath(); path(this.currentCountry);
        ctx.fillStyle = pal.countryFill; ctx.fill();
        ctx.lineWidth = 1; ctx.strokeStyle = pal.selEdge; ctx.stroke();
      }

      // hover highlight
      if (this.hover) {
        ctx.beginPath(); path(this.hover);
        ctx.fillStyle = pal.hoverFill; ctx.fill();
        ctx.lineWidth = 1.4; ctx.strokeStyle = pal.selEdge; ctx.stroke();
      }

      // sphere edge / atmosphere
      ctx.beginPath(); path({ type: 'Sphere' });
      ctx.lineWidth = pal.edgeWidth || 1.4; ctx.strokeStyle = pal.edge; ctx.stroke();
      if (pal.glow) {
        ctx.save();
        ctx.beginPath(); ctx.arc(cx, cy, R, 0, 2 * Math.PI);
        ctx.shadowColor = pal.glow; ctx.shadowBlur = 26; ctx.lineWidth = 1; ctx.strokeStyle = pal.glow; ctx.stroke();
        ctx.restore();
      }

      // pins
      const pins = this.level === 0 ? MARKETS : MARKETS.filter(m => this.currentCountry && m.country === this.currentCountry.properties.name);
      for (const m of pins) {
        if (!this._visible(m.lon, m.lat)) continue;
        const xy = this.projection([m.lon, m.lat]); if (!xy) continue;
        const active = this.enteredArea && this.enteredArea.name === m.name;
        this._drawPin(ctx, xy[0], xy[1], pal, active);
      }
    }

    _drawPin(ctx, x, y, pal, active) {
      const r = active ? 6 : 4.5;
      // pulse ring
      const t = (performance.now() % 1600) / 1600;
      ctx.save();
      ctx.beginPath(); ctx.arc(x, y, r + 3 + t * 10, 0, 2 * Math.PI);
      ctx.strokeStyle = pal.pinRing; ctx.globalAlpha = (1 - t) * 0.6; ctx.lineWidth = 2; ctx.stroke();
      ctx.restore();
      ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI);
      ctx.fillStyle = pal.pin; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = '#ffffff'; ctx.stroke();
    }

    destroy() {
      this.stop();
      const c = this.c;
      c.removeEventListener('pointerdown', this._down);
      c.removeEventListener('pointermove', this._move);
      window.removeEventListener('pointerup', this._up);
      c.removeEventListener('pointercancel', this._up);
      c.removeEventListener('wheel', this._wheel);
      c.removeEventListener('pointerleave', this._leave);
    }
  }

  GlobeApp.MARKETS = MARKETS;
  return GlobeApp;
})();

export default GlobeApp;
export { GlobeApp };
