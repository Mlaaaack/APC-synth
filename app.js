import { RNBOUIKit } from "./rnbo-ui-kit.js";

/*
 * IMPORTANT
 * ----------
 * APC_export.json contains BOTH:
 *   - top-level parameters, e.g. "attack", "filter_freq", "freq_lfo"
 *   - hidden per-voice parameters, e.g. "poly/attack"
 *
 * The Web API exposes the top-level parameters as the public controls.
 * The poly/... entries are internal voice parameters and have
 * "visible": false in the export.
 *
 * Do NOT replace these IDs with the poly/... IDs.
 */

const sections = [
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
      { paramId: "volume", label: "Volume" }
    ]
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
      { paramId: "mix", label: "Mix (dry/wet)" }
    ]
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
      { paramId: "poly/drive/drive_mix", label: "Mix (dry/wet)" }
    ]
  }
];

const kit = new RNBOUIKit({
  patchUrl: "./patch/APC_export.json",
  mount: document.getElementById("app"),
  sections,
  keyboard: true,
  midiInput: true,
  startTransport: true
});

kit.init();
