import { RNBOUIKit } from "./rnbo-ui-kit.js";

// -----------------------------------------------------------------------
// Regroupement des paramètres du patch APC_export.json (v2 : tous les
// paramètres sont désormais exposés à plat au niveau du patcher
// principal — plus de préfixe "poly/" ni de sous-patcher à traverser).
// -----------------------------------------------------------------------

const kit = new RNBOUIKit({
  patchUrl: "./patch/APC_export.json",
  mount: document.getElementById("app"),
  keyboardLowNote: 48,
  keyboardOctaves: 3,
  sections: [
    {
      id: "apc",
      title: "APC · Oscillateur · Filtre · LFO · Enveloppe",
      accent: "#4fd1c5",
      params: [
        { paramId: "freq_osc_1", label: "Fréquence osc." },
        { paramId: "detune", label: "Detune" },
        { paramId: "key_follow", label: "Key follow" },
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
        { paramId: "drive_drive", label: "Drive" },
        { paramId: "drive_lowcut", label: "Low cut" },
        { paramId: "drive_highcut", label: "High cut" },
        { paramId: "drive_bass", label: "Bass" },
        { paramId: "drive_midfreq", label: "Mid — fréquence" },
        { paramId: "drive_mid", label: "Mid" },
        { paramId: "drive_treble", label: "Treble" },
        { paramId: "drive_volume", label: "Volume" },
        { paramId: "drive_mix", label: "Mix (dry/wet)" },
      ],
    },
  ],
});

kit.init();
