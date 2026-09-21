/**
 * rnbo-ui-kit.js
 * -----------------------------------------------------------------------
 * Outil générique et réutilisable pour construire une interface web
 * (sliders / boutons / sélecteurs) à partir d'un patch RNBO exporté
 * (patch.export.json). Pensé pour être copié tel quel d'un projet à
 * l'autre : seul le fichier de config (app.js) change.
 *
 * Comportement : le patch est chargé et l'interface (sliders, sélecteur
 * MIDI, clavier) est construite IMMÉDIATEMENT au chargement de la page,
 * sans geste de l'utilisateur. Seul le son proprement dit reste en
 * pause tant que l'utilisateur n'a pas cliqué sur le bouton ON/OFF —
 * c'est une contrainte des navigateurs (AudioContext ne peut démarrer
 * qu'après un geste utilisateur), pas un choix de design.
 *
 * Pièges connus (déjà rencontrés sur d'autres projets RNBO) :
 * - device.parametersById est une Map, PAS un objet : on doit utiliser
 *   .get(paramId), jamais parametersById[paramId] (undefined silencieux).
 * - Un paramètre qui vit dans un sous-patcher polyphonique a un paramId
 *   du type "poly/xxx". D'après la doc RNBO ("Parameters and Polyphony"),
 *   tant que le sous-patcher n'a pas @exposevoiceparams activé, CE
 *   paramId unique pilote bien TOUTES les voix à la fois — c'est donc
 *   la bonne adresse à utiliser (pas besoin d'un paramId par voix).
 * - Le CDN "cdn.cycling74.com/rnbo/<version>/rnbo.min.js" ne mirror pas
 *   forcément toutes les versions ; le bucket d'origine
 *   "c74-public.nyc3.digitaloceanspaces.com/rnbo/<version>/rnbo.min.js"
 *   (utilisé par le template d'export officiel) est plus fiable pour
 *   charger une version précise — c'est celui qu'on utilise ici.
 * - Le transport RNBO (phasor~/metro @lock 1) ne démarre pas
 *   automatiquement dans le SDK web : on envoie un TransportEvent "run"
 *   explicitement.
 * -----------------------------------------------------------------------
 */

export class RNBOUIKit {
  /**
   * @param {Object} opts
   * @param {string} opts.patchUrl
   * @param {HTMLElement} opts.mount
   * @param {Array} opts.sections
   * @param {string} [opts.rnboVersion]
   * @param {boolean} [opts.startTransport=true]
   * @param {boolean} [opts.keyboard=true]
   * @param {number}  [opts.keyboardLowNote=48]
   * @param {number}  [opts.keyboardOctaves=3]
   * @param {boolean} [opts.midiInput=true]
   */
  constructor(opts) {
    this.patchUrl = opts.patchUrl;
    this.mount = opts.mount;
    this.sections = opts.sections || [];
    this.rnboVersionOverride = opts.rnboVersion || null;
    this.startTransport = opts.startTransport !== false;
    this.keyboard = opts.keyboard !== false;
    this.keyboardLowNote = opts.keyboardLowNote ?? 48; // Do3
    this.keyboardOctaves = opts.keyboardOctaves ?? 3;
    this.midiInputEnabled = opts.midiInput !== false;
    this.context = null;
    this.device = null;
    this._midiAccess = null;
    this._currentMidiInput = null;
    this._activePointerNotes = new Map();
  }

  _loadRNBOScript(version) {
    if (window.RNBO) return Promise.resolve(window.RNBO);
    const urls = [
      `https://c74-public.nyc3.digitaloceanspaces.com/rnbo/${encodeURIComponent(version)}/rnbo.min.js`,
      `https://cdn.cycling74.com/rnbo/${encodeURIComponent(version)}/rnbo.min.js`,
    ];
    const tryLoad = (i) => new Promise((resolve, reject) => {
      if (i >= urls.length) return reject(new Error("Impossible de charger rnbo.min.js (version " + version + ")"));
      const el = document.createElement("script");
      el.src = urls[i];
      el.onload = () => resolve(window.RNBO);
      el.onerror = () => { el.remove(); tryLoad(i + 1).then(resolve, reject); };
      document.head.appendChild(el);
    });
    return tryLoad(0);
  }

  async init() {
    this._renderShell();
    try {
      await this._boot();
    } catch (err) {
      console.error("[rnbo-ui-kit]", err);
      this._setStatus("Erreur : " + err.message, true);
    }
  }

  async _boot() {
    this._setStatus("Chargement du patch…");

    const res = await fetch(this.patchUrl);
    if (!res.ok) throw new Error(`fetch ${this.patchUrl} → ${res.status}`);
    const patcher = await res.json();
    const version = this.rnboVersionOverride || patcher?.desc?.meta?.rnboversion || "latest";

    const RNBO = await this._loadRNBOScript(version);
    this._RNBO = RNBO;

    const WAContext = window.AudioContext || window.webkitAudioContext;
    // Le contexte démarre "suspended" par défaut dans la plupart des
    // navigateurs tant qu'aucun geste utilisateur n'a eu lieu — c'est
    // volontaire, ça n'empêche pas de construire le device et l'UI.
    this.context = new WAContext();

    this.device = await RNBO.createDevice({ context: this.context, patcher });
    this.device.node.connect(this.context.destination);

    if (this.startTransport && RNBO.TransportEvent) {
      this.device.scheduleEvent(new RNBO.TransportEvent(RNBO.TimeNow, "run"));
    }

    this._setStatus("");
    this._renderPowerButton();
    this._renderControls();
    if (this.midiInputEnabled) await this._renderMidiInputSelector();
    if (this.keyboard) this._renderKeyboard();
  }

  _renderShell() {
    this.mount.innerHTML = `
      <div class="rnbo-topbar">
        <p class="rnbo-status" data-rnbo-status></p>
        <div data-rnbo-power></div>
      </div>
      <div class="rnbo-sections" data-rnbo-sections></div>
      <div class="rnbo-midi-select" data-rnbo-midi-select></div>
      <div class="rnbo-keyboard" data-rnbo-keyboard></div>
    `;
  }

  _setStatus(text, isError) {
    const el = this.mount.querySelector("[data-rnbo-status]");
    el.textContent = text;
    el.classList.toggle("rnbo-status-error", !!isError);
  }

  // -----------------------------------------------------------------
  // Bouton ON/OFF (seul geste utilisateur requis, pour l'AudioContext)
  // -----------------------------------------------------------------

  _renderPowerButton() {
    const wrap = this.mount.querySelector("[data-rnbo-power]");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "rnbo-power-btn";
    const setLabel = () => {
      const on = this.context.state === "running";
      btn.textContent = on ? "⏻ ON" : "⏻ OFF";
      btn.classList.toggle("is-on", on);
    };
    setLabel();
    btn.addEventListener("click", async () => {
      if (this.context.state === "running") {
        await this.context.suspend();
      } else {
        await this.context.resume();
      }
      setLabel();
    });
    wrap.appendChild(btn);
  }

  // -----------------------------------------------------------------
  // Paramètres
  // -----------------------------------------------------------------

  _renderControls() {
    const container = this.mount.querySelector("[data-rnbo-sections]");
    container.innerHTML = "";

    for (const section of this.sections) {
      const panel = document.createElement("section");
      panel.className = "rnbo-panel";
      if (section.accent) panel.style.setProperty("--accent", section.accent);

      const h2 = document.createElement("h2");
      h2.textContent = section.title;
      panel.appendChild(h2);

      const grid = document.createElement("div");
      grid.className = "rnbo-grid";

      for (const p of section.params) {
        // IMPORTANT : parametersById est une Map -> .get(), jamais [ ]
        const param = this.device.parametersById.get(p.paramId);
        if (!param) {
          console.warn("[rnbo-ui-kit] paramId introuvable :", p.paramId);
          continue;
        }
        grid.appendChild(this._buildControl(param, p));
      }

      panel.appendChild(grid);
      container.appendChild(panel);
    }
  }

  _buildControl(param, opts) {
    const wrap = document.createElement("div");
    wrap.className = "rnbo-control";

    const label = document.createElement("label");
    label.textContent = opts.label || param.name;
    wrap.appendChild(label);

    const isEnum = Array.isArray(param.enumValues) && param.enumValues.length > 0;

    if (isEnum) {
      const select = document.createElement("select");
      param.enumValues.forEach((val, i) => {
        const o = document.createElement("option");
        o.value = i;
        o.textContent = val;
        select.appendChild(o);
      });
      select.value = param.value;
      select.addEventListener("input", () => {
        param.value = Number(select.value);
      });
      wrap.appendChild(select);
    } else {
      const row = document.createElement("div");
      row.className = "rnbo-slider-row";

      const slider = document.createElement("input");
      slider.type = "range";
      slider.min = param.min;
      slider.max = param.max;
      slider.step = (param.max - param.min) / 1000;
      slider.value = param.value;

      const readout = document.createElement("span");
      readout.className = "rnbo-readout";
      const unit = opts.unit !== undefined ? opts.unit : (param.unit || "");
      const fmt = (v) => `${Number(v).toFixed(unit === "%" || unit === "" ? 2 : 1)}${unit ? " " + unit : ""}`;
      readout.textContent = fmt(param.value);

      slider.addEventListener("input", () => {
        param.value = Number(slider.value);
        readout.textContent = fmt(slider.value);
      });

      row.appendChild(slider);
      row.appendChild(readout);
      wrap.appendChild(row);
    }

    return wrap;
  }

  // -----------------------------------------------------------------
  // Entrée MIDI (Web MIDI API)
  // -----------------------------------------------------------------

  async _renderMidiInputSelector() {
    const el = this.mount.querySelector("[data-rnbo-midi-select]");

    if (!navigator.requestMIDIAccess) {
      el.innerHTML = `<p class="rnbo-midi-unsupported">Web MIDI non supporté par ce navigateur (utilise Chrome/Edge, ou le clavier ci-dessous).</p>`;
      return;
    }

    try {
      this._midiAccess = await navigator.requestMIDIAccess({ sysex: false });
    } catch (err) {
      el.innerHTML = `<p class="rnbo-midi-unsupported">Accès MIDI refusé.</p>`;
      return;
    }

    el.innerHTML = `
      <label for="rnbo-midi-device">Entrée MIDI</label>
      <select id="rnbo-midi-device"></select>
      <button type="button" class="rnbo-midi-refresh" title="Actualiser la liste (si tu viens de brancher un clavier)">↻</button>
    `;
    const select = el.querySelector("select");
    const refreshBtn = el.querySelector(".rnbo-midi-refresh");

    const populate = () => {
      const current = select.value;
      select.innerHTML = `<option value="">— Aucune (clavier à l'écran seulement) —</option>`;
      for (const input of this._midiAccess.inputs.values()) {
        const o = document.createElement("option");
        o.value = input.id;
        o.textContent = input.name || input.id;
        select.appendChild(o);
      }
      if ([...select.options].some((o) => o.value === current)) {
        select.value = current;
      }
    };

    populate();
    this._midiAccess.onstatechange = populate;

    refreshBtn.addEventListener("click", async () => {
      // Re-demande l'accès MIDI : sur certains navigateurs/OS, un
      // périphérique branché après coup n'apparaît pas tant qu'on n'a
      // pas rafraîchi l'accès, malgré onstatechange.
      try {
        this._midiAccess = await navigator.requestMIDIAccess({ sysex: false });
        this._midiAccess.onstatechange = populate;
      } catch (e) { /* garde l'accès précédent si ça échoue */ }
      populate();
    });

    select.addEventListener("change", () => {
      if (this._currentMidiInput) {
        this._currentMidiInput.onmidimessage = null;
      }
      const chosen = this._midiAccess.inputs.get(select.value);
      this._currentMidiInput = chosen || null;
      if (chosen) {
        chosen.onmidimessage = (ev) => this._forwardMidiMessage(ev.data);
      }
    });
  }

  _forwardMidiMessage(data) {
    const { MIDIEvent } = this._RNBO;
    const bytes = Array.from(data);
    const evt = new MIDIEvent(this.context.currentTime * 1000, 0, bytes);
    this.device.scheduleEvent(evt);
  }

  // -----------------------------------------------------------------
  // Clavier de piano (SVG) pour tester sans contrôleur MIDI
  // -----------------------------------------------------------------

  _renderKeyboard() {
    const el = this.mount.querySelector("[data-rnbo-keyboard]");
    el.innerHTML = `<h2>Clavier de test</h2><div class="rnbo-piano-wrap"></div>`;
    const wrap = el.querySelector(".rnbo-piano-wrap");
    wrap.appendChild(this._buildPianoSVG(this.keyboardLowNote, this.keyboardOctaves));
  }

  _buildPianoSVG(lowNote, octaves) {
    const whiteKeyW = 40, whiteKeyH = 160, blackKeyW = 24, blackKeyH = 100;
    const whiteOffsetsInOctave = [0, 2, 4, 5, 7, 9, 11];
    const blackOffsetsInOctave = [1, 3, null, 6, 8, 10, null];

    const totalWhiteKeys = octaves * 7 + 1;
    const svgW = totalWhiteKeys * whiteKeyW;

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", `0 0 ${svgW} ${whiteKeyH}`);
    svg.setAttribute("class", "rnbo-piano");
    svg.style.width = "100%";
    svg.style.maxWidth = `${svgW}px`;
    svg.style.touchAction = "none";

    const whiteKeys = [];
    const blackKeys = [];

    for (let oct = 0; oct <= octaves; oct++) {
      whiteOffsetsInOctave.forEach((semitone, i) => {
        const whiteIndex = oct * 7 + i;
        if (whiteIndex >= totalWhiteKeys) return;
        const pitch = lowNote + oct * 12 + semitone;
        const x = whiteIndex * whiteKeyW;

        const rect = document.createElementNS(svg.namespaceURI, "rect");
        rect.setAttribute("x", x);
        rect.setAttribute("y", 0);
        rect.setAttribute("width", whiteKeyW - 1);
        rect.setAttribute("height", whiteKeyH);
        rect.setAttribute("rx", 4);
        rect.setAttribute("class", "rnbo-key-white");
        rect.dataset.pitch = pitch;
        svg.appendChild(rect);
        whiteKeys.push(rect);

        const blackSemitone = blackOffsetsInOctave[i];
        if (blackSemitone !== null) {
          const blackPitch = lowNote + oct * 12 + blackSemitone;
          const bx = x + whiteKeyW - blackKeyW / 2;
          const brect = document.createElementNS(svg.namespaceURI, "rect");
          brect.setAttribute("x", bx);
          brect.setAttribute("y", 0);
          brect.setAttribute("width", blackKeyW);
          brect.setAttribute("height", blackKeyH);
          brect.setAttribute("rx", 3);
          brect.setAttribute("class", "rnbo-key-black");
          brect.dataset.pitch = blackPitch;
          blackKeys.push(brect);
        }
      });
    }
    blackKeys.forEach((k) => svg.appendChild(k));

    const allKeys = [...whiteKeys, ...blackKeys];

    const pitchAtPoint = (clientX, clientY) => {
      const el = document.elementFromPoint(clientX, clientY);
      if (el && el.dataset && el.dataset.pitch) return Number(el.dataset.pitch);
      return null;
    };

    const onDown = (pointerId, pitch) => {
      this._activePointerNotes.set(pointerId, pitch);
      this._noteOn(pitch);
      this._markKeyActive(svg, pitch, true);
    };
    const onMove = (pointerId, clientX, clientY) => {
      if (!this._activePointerNotes.has(pointerId)) return;
      const prev = this._activePointerNotes.get(pointerId);
      const next = pitchAtPoint(clientX, clientY);
      if (next !== null && next !== prev) {
        this._noteOff(prev);
        this._markKeyActive(svg, prev, false);
        this._noteOn(next);
        this._markKeyActive(svg, next, true);
        this._activePointerNotes.set(pointerId, next);
      }
    };
    const onUp = (pointerId) => {
      const pitch = this._activePointerNotes.get(pointerId);
      if (pitch !== undefined) {
        this._noteOff(pitch);
        this._markKeyActive(svg, pitch, false);
      }
      this._activePointerNotes.delete(pointerId);
    };

    allKeys.forEach((key) => {
      key.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        onDown(e.pointerId, Number(key.dataset.pitch));
      });
    });
    svg.addEventListener("pointermove", (e) => onMove(e.pointerId, e.clientX, e.clientY));
    svg.addEventListener("pointerup", (e) => onUp(e.pointerId));
    svg.addEventListener("pointercancel", (e) => onUp(e.pointerId));
    svg.addEventListener("pointerleave", (e) => onUp(e.pointerId));

    return svg;
  }

  _markKeyActive(svg, pitch, active) {
    const el = svg.querySelector(`[data-pitch="${pitch}"]`);
    if (el) el.classList.toggle("is-active", active);
  }

  _noteOn(pitch) {
    const { MIDIEvent } = this._RNBO;
    const msg = [144, pitch, 100];
    this.device.scheduleEvent(new MIDIEvent(this.context.currentTime * 1000, 0, msg));
  }

  _noteOff(pitch) {
    const { MIDIEvent } = this._RNBO;
    const msg = [128, pitch, 0];
    this.device.scheduleEvent(new MIDIEvent(this.context.currentTime * 1000, 0, msg));
  }
}
