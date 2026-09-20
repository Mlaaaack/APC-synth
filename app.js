import { RNBOUIKit } from "./rnbo-ui-kit.js";

// IMPORTANT:
// The APC patch is polyphonic. RNBO creates two kinds of parameter IDs:
//   - top-level IDs such as "freq_lfo", "attack", "filter_freq"
//     which are global/meta parameters controlling all voices.
//   - "poly/..." IDs for individual voice parameters.
//
// The "poly/..." parameters are marked hidden in the export, so they are
// not exposed through device.parametersById in the Web API. The previous
// version therefore found the Drive controls (which are exposed) but not
// most of the APC/Reverb controls.
//
// We deliberately use the top-level IDs below. RNBO then applies these
// values to the polyphonic voices as intended.

const kit = new RNBOUIKit({
  patchUrl: "./patch/APC_export.json",
  mount: document.getElementById("app"),

  sections: [
    {
      id: "apc",
      title: "APC · Oscillateur · Filtre · LFO · Enveloppe",
      accent: "#4fd1c5",
      params: [
        { paramId: "freq_osc_1", label: "Fréquence osc." },
        { paramId: "detune", label: "Detune" },
        { paramId: "Chaos", label: "Chaos" },
        { paramId: "glide", label: "Glide" },
        { paramId: "filter_freq", label: "Filtre — fréquence" },
        { paramId: "filter_Q", label: "Filtre — résonance (Q)" },
        { paramId: "shape_lfo", label: "LFO — forme" },
        { paramId: "freq_lfo", label: "LFO — fréquence" },
        { paramId: "amount_lfo", label: "LFO — intensité" },
        { paramId: "range_lfo", label: "LFO — plage" },
        { paramId: "attack", label: "Enveloppe — attack" },
        { paramId: "decay", label: "Enveloppe — decay" },
        { paramId: "sustain", label: "Enveloppe — sustain" },
        { paramId: "release", label: "Enveloppe — release" },
        { paramId: "volume", label: "Volume" },
      ],
    },

    {
      id: "reverb",
      title: "Reverb",
      accent: "#a78bfa",
      params: [
        { paramId: "reverb_size", label: "Taille" },
        { paramId: "reverb_decay", label: "Decay" },
        { paramId: "reverb_damp", label: "Damping" },
        { paramId: "reverb_diff", label: "Diffusion" },
        { paramId: "reverb_jitter", label: "Jitter" },
        { paramId: "mix", label: "Mix (dry/wet)" },
      ],
    },

    {
      id: "drive",
      title: "Drive",
      accent: "#fb923c",
      params: [
        { paramId: "poly/drive/drive_drive", label: "Drive" },
        { paramId: "poly/drive/drive_lowcut", label: "Low cut" },
        { paramId: "poly/drive/drive_highcut", label: "High cut" },
        { paramId: "poly/drive/drive_bass", label: "Bass" },
        { paramId: "poly/drive/drive_midfreq", label: "Mid — fréquence" },
        { paramId: "poly/drive/drive_mid", label: "Mid" },
        { paramId: "poly/drive/drive_treble", label: "Treble" },
        { paramId: "poly/drive/drive_volume", label: "Volume" },
        { paramId: "poly/drive/drive_mix", label: "Mix (dry/wet)" },
      ],
    },
  ],
});

kit.init();
