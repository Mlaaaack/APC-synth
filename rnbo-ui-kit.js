/**
 * RNBO UI kit — APC fixed version
 *
 * The important change is that controls are resolved from device.parameters
 * (the official RNBO Device API) and then cross-checked with
 * parametersById. This avoids silently losing controls when a particular
 * RNBO export/runtime exposes the parameter collection differently.
 *
 * RNBO documentation:
 * device.parameters -> Array<Parameter>
 * device.parametersById -> Map<string, Parameter>
 */

export class RNBOUIKit {
  constructor(opts) {
    this.patchUrl = opts.patchUrl;
    this.mount = opts.mount;
    this.sections = opts.sections || [];
    this.rnboVersionOverride = opts.rnboVersion || null;
    this.startTransport = opts.startTransport !== false;
    this.keyboard = opts.keyboard !== false;
    this.keyboardLowNote = opts.keyboardLowNote ?? 48;
    this.keyboardOctaves = opts.keyboardOctaves ?? 3;
    this.midiInputEnabled = opts.midiInput !== false;

    this.context = null;
    this.device = null;
    this._RNBO = null;
    this._midiAccess = null;
    this._currentMidiInput = null;
    this._activePointerNotes = new Map();
  }

  async _loadRNBOScript(version) {
    if (window.RNBO) return window.RNBO;

    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `https://cdn.cycling74.com/rnbo/${version}/rnbo.min.js`;
      script.onload = resolve;
      script.onerror = () => reject(
        new Error("Impossible de charger rnbo.min.js (" + version + ")")
      );
      document.head.appendChild(script);
    });

    return window.RNBO;
  }

  async init() {
    this._renderShell();

    const startButton = this.mount.querySelector("[data-rnbo-start]");
    startButton.addEventListener("click", () => this._start(), { once: true });
  }

  async _start() {
    const status = this.mount.querySelector("[data-rnbo-status]");
    status.textContent = "Chargement du patch…";

    try {
      const response = await fetch(this.patchUrl, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`fetch ${this.patchUrl} → ${response.status}`);
      }

      const patcher = await response.json();

      const version =
        this.rnboVersionOverride ||
        (patcher.desc &&
         patcher.desc.meta &&
         patcher.desc.meta.rnboversion) ||
        "1.2.6";

      const RNBO = await this._loadRNBOScript(version);
      this._RNBO = RNBO;

      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;

      this.context = new AudioContextClass();

      this.device = await RNBO.createDevice({
        context: this.context,
        patcher
      });

      this.device.node.connect(this.context.destination);

      if (this.context.state !== "running") {
        await this.context.resume();
      }

      /*
       * Print the actual runtime parameter list. This is useful if the
       * RNBO CDN/runtime changes its parameter exposure.
       */
      console.group("[APC] RNBO parameters");
      this.device.parameters.forEach((p) => {
        console.log(
          p.id,
          "| name:", p.name,
          "| min:", p.min,
          "| max:", p.max,
          "| value:", p.value
        );
      });
      console.groupEnd();

      if (this.startTransport && RNBO.TransportEvent) {
        this.device.scheduleEvent(
          new RNBO.TransportEvent(RNBO.TimeNow, "run")
        );
      }

      status.textContent =
        `Prêt — ${this.device.parameters.length} paramètres RNBO détectés`;

      const startWrap = this.mount.querySelector("[data-rnbo-start-wrap]");
      if (startWrap) startWrap.remove();

      this._renderControls();

      if (this.midiInputEnabled) {
        await this._renderMidiInputSelector();
      }

      if (this.keyboard) {
        this._renderKeyboard();
      }

    } catch (error) {
      console.error("[rnbo-ui-kit]", error);
      status.textContent = "Erreur : " + error.message;
    }
  }

  _renderShell() {
    this.mount.innerHTML = `
      <div class="rnbo-start-wrap" data-rnbo-start-wrap>
        <button class="rnbo-start-btn" data-rnbo-start type="button">
          ▶ Démarrer l'audio
        </button>
        <p class="rnbo-status" data-rnbo-status>En attente…</p>
      </div>

      <div class="rnbo-sections" data-rnbo-sections></div>
      <div class="rnbo-midi-select" data-rnbo-midi-select></div>
      <div class="rnbo-keyboard" data-rnbo-keyboard></div>
    `;
  }

  /*
   * Resolve a parameter robustly.
   *
   * We first search the actual Device.parameters array, because that is the
   * canonical public API documented by RNBO.
   *
   * Then we use parametersById as a fallback.
   */
  _getParameter(id) {
    if (!this.device) return null;

    const parameters = Array.isArray(this.device.parameters)
      ? this.device.parameters
      : [];

    for (const parameter of parameters) {
      if (parameter.id === id) return parameter;
    }

    if (this.device.parametersById &&
        typeof this.device.parametersById.get === "function") {
      return this.device.parametersById.get(id) || null;
    }

    return null;
  }

  _renderControls() {
    const container = this.mount.querySelector("[data-rnbo-sections]");
    container.innerHTML = "";

    let foundCount = 0;
    let missingCount = 0;

    for (const section of this.sections) {
      const panel = document.createElement("section");
      panel.className = "rnbo-panel";

      if (section.accent) {
        panel.style.setProperty("--accent", section.accent);
      }

      const heading = document.createElement("h2");
      heading.textContent = section.title;
      panel.appendChild(heading);

      const grid = document.createElement("div");
      grid.className = "rnbo-grid";

      for (const config of section.params) {
        const parameter = this._getParameter(config.paramId);

        if (!parameter) {
          missingCount++;
          console.warn(
            "[rnbo-ui-kit] Paramètre RNBO introuvable :",
            config.paramId
          );
          continue;
        }

        foundCount++;
        grid.appendChild(this._buildControl(parameter, config));
      }

      /*
       * Always append the panel, even if a parameter is missing.
       * This makes runtime problems visible instead of creating a blank UI.
       */
      panel.appendChild(grid);
      container.appendChild(panel);
    }

    console.log(
      `[APC] Contrôles affichés : ${foundCount} | introuvables : ${missingCount}`
    );
  }

  _buildControl(parameter, opts) {
    const wrap = document.createElement("div");
    wrap.className = "rnbo-control";

    const label = document.createElement("label");
    label.textContent = opts.label || parameter.name || parameter.id;
    wrap.appendChild(label);

    const isEnum =
      Array.isArray(parameter.enumValues) &&
      parameter.enumValues.length > 0;

    if (isEnum) {
      const select = document.createElement("select");

      parameter.enumValues.forEach((value, index) => {
        const option = document.createElement("option");
        option.value = index;
        option.textContent = value;
        select.appendChild(option);
      });

      select.value = parameter.value;

      select.addEventListener("input", () => {
        parameter.value = Number(select.value);
      });

      wrap.appendChild(select);
      return wrap;
    }

    const row = document.createElement("div");
    row.className = "rnbo-slider-row";

    const slider = document.createElement("input");
    slider.type = "range";

    const min = Number(parameter.min);
    const max = Number(parameter.max);

    slider.min = Number.isFinite(min) ? min : 0;
    slider.max = Number.isFinite(max) ? max : 1;

    /*
     * Use the parameter's actual range. 1000 divisions gives a useful
     * resolution while remaining compatible with all NumberParameters.
     */
    const range = slider.max - slider.min;
    slider.step = range > 0 ? range / 1000 : 1;
    slider.value = parameter.value;

    const readout = document.createElement("span");
    readout.className = "rnbo-readout";

    const unit =
      opts.unit !== undefined
        ? opts.unit
        : (parameter.unit || "");

    const format = (value) => {
      const n = Number(value);

      if (!Number.isFinite(n)) return String(value);

      if (unit === "%") {
        return `${n.toFixed(1)} %`;
      }

      if (unit !== "") {
        return `${n.toFixed(1)} ${unit}`;
      }

      /*
       * Frequencies and long time ranges are easier to read without
       * displaying 10 unnecessary decimal places.
       */
      if (Math.abs(n) >= 100) return n.toFixed(0);
      if (Math.abs(n) >= 10) return n.toFixed(1);
      return n.toFixed(2);
    };

    readout.textContent = format(parameter.value);

    slider.addEventListener("input", () => {
      const value = Number(slider.value);

      try {
        parameter.value = value;
        readout.textContent = format(parameter.value);
      } catch (error) {
        console.error(
          "[rnbo-ui-kit] Erreur lors de l'écriture du paramètre",
          parameter.id,
          error
        );
      }
    });

    row.appendChild(slider);
    row.appendChild(readout);
    wrap.appendChild(row);

    return wrap;
  }

  async _renderMidiInputSelector() {
    const element =
      this.mount.querySelector("[data-rnbo-midi-select]");

    if (!navigator.requestMIDIAccess) {
      element.innerHTML =
        `<p class="rnbo-midi-unsupported">
          Web MIDI non supporté par ce navigateur.
          Utilise Chrome/Edge ou le clavier ci-dessous.
        </p>`;
      return;
    }

    try {
      this._midiAccess =
        await navigator.requestMIDIAccess({ sysex: false });
    } catch (error) {
      element.innerHTML =
        `<p class="rnbo-midi-unsupported">Accès MIDI refusé.</p>`;
      return;
    }

    element.innerHTML = `
      <label for="rnbo-midi-device">Entrée MIDI</label>
      <select id="rnbo-midi-device"></select>
    `;

    const select = element.querySelector("select");

    const populate = () => {
      const current = select.value;

      select.innerHTML =
        `<option value="">— Aucune —</option>`;

      for (const input of this._midiAccess.inputs.values()) {
        const option = document.createElement("option");
        option.value = input.id;
        option.textContent = input.name || input.id;
        select.appendChild(option);
      }

      for (const option of select.options) {
        if (option.value === current) {
          select.value = current;
          break;
        }
      }
    };

    populate();

    this._midiAccess.onstatechange = populate;

    select.addEventListener("change", () => {
      if (this._currentMidiInput) {
        this._currentMidiInput.onmidimessage = null;
      }

      const chosen =
        this._midiAccess.inputs.get(select.value);

      this._currentMidiInput = chosen || null;

      if (chosen) {
        chosen.onmidimessage =
          (event) => this._forwardMidiMessage(event.data);
      }
    });
  }

  _forwardMidiMessage(data) {
    if (!this.device || !this.context || !this._RNBO) return;

    const MIDIEvent = this._RNBO.MIDIEvent;
    const bytes = Array.from(data);

    /*
     * RNBO MIDIEvent times are milliseconds.
     */
    const event = new MIDIEvent(
      this.context.currentTime * 1000,
      0,
      bytes
    );

    this.device.scheduleEvent(event);
  }

  _renderKeyboard() {
    const element =
      this.mount.querySelector("[data-rnbo-keyboard]");

    element.innerHTML =
      `<h2>Clavier de test</h2>
       <div class="rnbo-piano-wrap"></div>`;

    const wrap =
      element.querySelector(".rnbo-piano-wrap");

    wrap.appendChild(
      this._buildPianoSVG(
        this.keyboardLowNote,
        this.keyboardOctaves
      )
    );
  }

  _buildPianoSVG(lowNote, octaves) {
    const whiteKeyW = 40;
    const whiteKeyH = 160;
    const blackKeyW = 24;
    const blackKeyH = 100;

    const whiteOffsets = [0, 2, 4, 5, 7, 9, 11];
    const blackOffsets = [1, 3, null, 6, 8, 10, null];

    const totalWhiteKeys = octaves * 7 + 1;
    const svgW = totalWhiteKeys * whiteKeyW;

    const svg =
      document.createElementNS(
        "http://www.w3.org/2000/svg",
        "svg"
      );

    svg.setAttribute(
      "viewBox",
      `0 0 ${svgW} ${whiteKeyH}`
    );

    svg.setAttribute("class", "rnbo-piano");
    svg.style.width = "100%";
    svg.style.maxWidth = `${svgW}px`;
    svg.style.touchAction = "none";

    const whiteKeys = [];
    const blackKeys = [];

    for (let octave = 0; octave <= octaves; octave++) {
      whiteOffsets.forEach((semitone, i) => {
        const whiteIndex = octave * 7 + i;

        if (whiteIndex >= totalWhiteKeys) return;

        const pitch =
          lowNote + octave * 12 + semitone;

        const rect =
          document.createElementNS(
            svg.namespaceURI,
            "rect"
          );

        rect.setAttribute(
          "x",
          whiteIndex * whiteKeyW
        );
        rect.setAttribute("y", 0);
        rect.setAttribute(
          "width",
          whiteKeyW - 1
        );
        rect.setAttribute(
          "height",
          whiteKeyH
        );
        rect.setAttribute("rx", 4);
        rect.setAttribute(
          "class",
          "rnbo-key-white"
        );
        rect.dataset.pitch = pitch;

        svg.appendChild(rect);
        whiteKeys.push(rect);
      });
    }

    for (let octave = 0; octave < octaves; octave++) {
      blackOffsets.forEach((semitone, i) => {
        if (semitone === null) return;

        const pitch =
          lowNote + octave * 12 + semitone;

        const x =
          (octave * 7 + i + 1) * whiteKeyW -
          blackKeyW / 2;

        const rect =
          document.createElementNS(
            svg.namespaceURI,
            "rect"
          );

        rect.setAttribute("x", x);
        rect.setAttribute("y", 0);
        rect.setAttribute(
          "width",
          blackKeyW
        );
        rect.setAttribute(
          "height",
          blackKeyH
        );
        rect.setAttribute("rx", 3);
        rect.setAttribute(
          "class",
          "rnbo-key-black"
        );
        rect.dataset.pitch = pitch;

        svg.appendChild(rect);
        blackKeys.push(rect);
      });
    }

    const noteOn = (pitch, velocity, element) => {
      if (!this.device || !this.context) return;

      const MIDIEvent = this._RNBO.MIDIEvent;

      const event = new MIDIEvent(
        this.context.currentTime * 1000,
        0,
        [144, pitch, velocity]
      );

      this.device.scheduleEvent(event);

      if (element) {
        element.classList.add("is-active");
      }
    };

    const noteOff = (pitch, element) => {
      if (!this.device || !this.context) return;

      const MIDIEvent = this._RNBO.MIDIEvent;

      const event = new MIDIEvent(
        this.context.currentTime * 1000,
        0,
        [128, pitch, 0]
      );

      this.device.scheduleEvent(event);

      if (element) {
        element.classList.remove("is-active");
      }
    };

    const bindKey = (element) => {
      const pitch = Number(element.dataset.pitch);

      element.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        element.setPointerCapture(event.pointerId);

        this._activePointerNotes.set(
          event.pointerId,
          { pitch, element }
        );

        noteOn(pitch, 100, element);
      });

      element.addEventListener("pointerup", (event) => {
        event.preventDefault();

        const active =
          this._activePointerNotes.get(
            event.pointerId
          );

        if (active) {
          noteOff(active.pitch, active.element);
        }

        this._activePointerNotes.delete(
          event.pointerId
        );
      });

      element.addEventListener("pointercancel", (event) => {
        const active =
          this._activePointerNotes.get(
            event.pointerId
          );

        if (active) {
          noteOff(active.pitch, active.element);
        }

        this._activePointerNotes.delete(
          event.pointerId
        );
      });
    };

    whiteKeys.forEach(bindKey);
    blackKeys.forEach(bindKey);

    return svg;
  }
}
