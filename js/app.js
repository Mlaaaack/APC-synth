import { RNBOUIKit } from "./rnbo-ui-kit.js";

// -----------------------------------------------------------------------
// Regroupement des paramètres du patch APC_export.json
//
// Le patch a une structure "top-level" + "poly/..." pour chaque paramètre
// (le sous-patcher polyphonique). Ce sont les versions "poly/..." qui
// pilotent réellement le son (cf. piège documenté dans rnbo-ui-kit.js) :
// on adresse donc toujours device.parametersById["poly/xxx"].
// -----------------------------------------------------------------------

const kit = new RNBOUIKit({
  patchUrl: "./patch/APC_export.json",
  mount: document.getElementById("app"),
  sections: [
    {
      id: "apc",
      title: "APC · Oscillateur · Filtre · LFO · Enveloppe",
      accent: "#4fd1c5",
      params: [
        { paramId: "poly/freq_osc_1/value", label: "Fréquence osc." },
        { paramId: "poly/detune", label: "Detune" },
        { paramId: "poly/Chaos", label: "Chaos" },
        { paramId: "poly/glide", label: "Glide" },
        { paramId: "poly/filter_freq/value", label: "Filtre — fréquence" },
        { paramId: "poly/filter_Q/value", label: "Filtre — résonance (Q)" },
        { paramId: "poly/shape_lfo", label: "LFO — forme" },
        { paramId: "poly/freq_lfo", label: "LFO — fréquence" },
        { paramId: "poly/amount_lfo", label: "LFO — intensité" },
        { paramId: "poly/range_lfo", label: "LFO — plage" },
        { paramId: "poly/attack", label: "Enveloppe — attack" },
        { paramId: "poly/decay", label: "Enveloppe — decay" },
        { paramId: "poly/sustain", label: "Enveloppe — sustain" },
        { paramId: "poly/release", label: "Enveloppe — release" },
        { paramId: "poly/volume", label: "Volume" },
      ],
    },
    {
      id: "reverb",
      title: "Reverb",
      accent: "#a78bfa",
      params: [
        { paramId: "poly/reverb_size", label: "Taille" },
        { paramId: "poly/reverb_decay", label: "Decay" },
        { paramId: "poly/reverb_damp", label: "Damping" },
        { paramId: "poly/reverb_diff", label: "Diffusion" },
        { paramId: "poly/reverb_jitter", label: "Jitter" },
        { paramId: "poly/mix", label: "Mix (dry/wet)" },
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
