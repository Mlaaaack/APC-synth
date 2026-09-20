/**
 * rnbo-ui-kit.js
 * -----------------------------------------------------------------------
 * Outil générique et réutilisable pour construire une interface web
 * (sliders / boutons / sélecteurs) à partir d'un patch RNBO exporté
 * (patch.export.json). Pensé pour être copié tel quel d'un projet à
 * l'autre : seul le fichier de config (app.js) change.
 *
 * Utilisation typique (voir app.js) :
 *
 *   const kit = new RNBOUIKit({
 *     patchUrl: "./patch/APC_export.json",
 *     mount: document.getElementById("app"),
 *     sections: [ ... ],
 *   });
 *   await kit.init();
 *
 * Pièges connus (déjà rencontrés sur d'autres projets RNBO) :
 * - Un paramètre qui vit dans un sous-patcher a un paramId complet
 *   (ex: "poly/attack") différent de son nom court ("attack"). Il faut
 *   TOUJOURS adresser device.parametersById avec le paramId complet,
 *   jamais avec le nom court, sinon le contrôle tourne dans l'UI sans
 *   effet sur le son.
 * - Le transport RNBO (phasor~/metro @lock 1) ne démarre pas
 *   automatiquement dans le SDK web contrairement à l'éditeur Max :
 *   on envoie un TransportEvent "run" explicitement au démarrage.
 * -----------------------------------------------------------------------
 */

export class RNBOUIKit {
  /**
   * @param {Object} opts
   * @param {string} opts.patchUrl - chemin vers le patch.export.json
   * @param {HTMLElement} opts.mount - conteneur où injecter l'interface
   * @param {Array} opts.sections - description des sections/paramètres, ex:
   *   [{ id: "apc", title: "APC", accent: "#4fd1c5", params: [
   *        { paramId: "freq_osc_1/value", label: "Fréquence" },
   *        { paramId: "shape_lfo", label: "Forme LFO" }, // enum -> select auto
   *      ]}]
   * @param {string} [opts.rnboVersion] - version RNBO (déduite du patch si absent)
   * @param {boolean} [opts.startTransport=true] - envoie un TransportEvent "run" au démarrage
   * @param {boolean} [opts.keyboard=true] - affiche un petit clavier pour déclencher des notes MIDI
   */
  constructor(opts) {
    this.patchUrl = opts.patchUrl;
    this.mount = opts.mount;
    this.sections = opts.sections || [];
    this.rnboVersionOverride = opts.rnboVersion || null;
    this.startTransport = opts.startTransport !== false;
    this.keyboard = opts.keyboard !== false;
    this.context = null;
    this.device = null;
    this.activeNotes = new Set();
  }

  async _loadRNBOScript(version) {
    if (window.RNBO) return window.RNBO;
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = `https://cdn.cycling74.com/rnbo/${version}/rnbo.min.js`;
      s.onload = resolve;
      s.onerror = () => reject(new Error("Impossible de charger rnbo.min.js (" + version + ")"));
      document.head.appendChild(s);
    });
    return window.RNBO;
  }

  async init() {
    this._renderShell();
    const startBtn = this.mount.querySelector("[data-rnbo-start]");
    startBtn.addEventListener("click", () => this._start(), { once: true });
  }

  async _start() {
    const statusEl = this.mount.querySelector("[data-rnbo-status]");
    statusEl.textContent = "Chargement du patch…";

    const res = await fetch(this.patchUrl);
    const patcher = await res.json();
    const version = this.rnboVersionOverride || patcher?.desc?.meta?.rnboversion || "latest";

    const RNBO = await this._loadRNBOScript(version);

    const WAContext = window.AudioContext || window.webkitAudioContext;
    this.context = new WAContext();

    this.device = await RNBO.createDevice({ context: this.context, patcher });
    this.device.node.connect(this.context.destination);

    if (this.context.state !== "running") {
      await this.context.resume();
    }

    if (this.startTransport && RNBO.TransportEvent) {
      this.device.scheduleEvent(new RNBO.TransportEvent(RNBO.TimeNow, "run"));
    }

    this._RNBO = RNBO;
    statusEl.textContent = "Prêt";
    this.mount.querySelector("[data-rnbo-start-wrap]").remove();
    this._renderControls();
    if (this.keyboard) this._renderKeyboard();
  }

  _renderShell() {
    this.mount.innerHTML = `
      <div class="rnbo-start-wrap" data-rnbo-start-wrap>
        <button class="rnbo-start-btn" data-rnbo-start type="button">▶ Démarrer l'audio</button>
        <p class="rnbo-status" data-rnbo-status>En attente…</p>
      </div>
      <div class="rnbo-sections" data-rnbo-sections></div>
      <div class="rnbo-keyboard" data-rnbo-keyboard></div>
    `;
  }

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
        const param = this.device.parametersById[p.paramId];
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

  _renderKeyboard() {
    const el = this.mount.querySelector("[data-rnbo-keyboard]");
    const notes = [60, 62, 64, 65, 67, 69, 71, 72]; // do4 -> do5
    const names = ["Do", "Ré", "Mi", "Fa", "Sol", "La", "Si", "Do"];

    el.innerHTML = `<h2>Clavier de test</h2><div class="rnbo-keys"></div>`;
    const keysWrap = el.querySelector(".rnbo-keys");

    notes.forEach((pitch, i) => {
      const key = document.createElement("button");
      key.type = "button";
      key.className = "rnbo-key";
      key.textContent = names[i];
      const press = () => this._noteOn(pitch);
      const release = () => this._noteOff(pitch);
      key.addEventListener("mousedown", press);
      key.addEventListener("touchstart", (e) => { e.preventDefault(); press(); });
      key.addEventListener("mouseup", release);
      key.addEventListener("mouseleave", release);
      key.addEventListener("touchend", (e) => { e.preventDefault(); release(); });
      keysWrap.appendChild(key);
    });
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
