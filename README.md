# APC — Interface web RNBO

Interface web pour le patch RNBO de l'Atari Punk Console, générée avec
`rnbo-ui-kit.js` (outil maison réutilisable pour tous tes futurs projets RNBO).

## Structure

```
apc-webui/
├── index.html          page principale
├── css/style.css        thème (modifiable sans toucher au JS)
├── js/
│   ├── rnbo-ui-kit.js    outil générique — à réutiliser tel quel sur d'autres projets
│   └── app.js            config spécifique à ce patch (sections + paramètres)
└── patch/
    └── APC_export.json   export RNBO (garder ce nom, ne pas le renommer)
```

Les paramètres sont regroupés en 3 sections logiques :
- **APC** (oscillateur, filtre, LFO, enveloppe ADSR)
- **Reverb**
- **Drive**

## Pour ajouter/retirer un contrôle

Tout se passe dans `js/app.js` : chaque entrée de `params` prend un
`paramId` (l'identifiant complet du paramètre RNBO, avec son chemin de
sous-patcher, ex. `poly/attack`) et un `label` (le texte affiché). Les
sliders et leurs bornes (min/max/valeur initiale) sont lus automatiquement
depuis le patch — rien à recopier à la main. Les paramètres de type "enum"
(comme `shape_lfo`) deviennent automatiquement un menu déroulant.

## Réutiliser le kit sur un autre projet

Copie `js/rnbo-ui-kit.js` tel quel dans le nouveau projet, remplace le
patch dans `patch/`, et réécris uniquement `js/app.js` avec les sections
propres à ce nouveau patch.

## Mettre en ligne avec GitHub Pages

```bash
cd apc-webui
git init
git add .
git commit -m "Interface web APC (RNBO)"
git branch -M main
git remote add origin <URL_DE_TON_DEPOT_GITHUB>
git push -u origin main
```

Puis, sur GitHub :
1. Va dans **Settings > Pages** du dépôt.
2. Dans **Build and deployment**, choisis la branche `main` et le dossier `/ (root)`.
3. Sauvegarde — GitHub te donne l'URL de la page (généralement en 1-2 minutes) :
   `https://<ton-user>.github.io/<nom-du-repo>/`

Aucune étape de build n'est nécessaire (pas de bundler, pas de `npm install`) :
tout est en HTML/CSS/JS natif, avec RNBO chargé depuis le CDN officiel de
Cycling '74 (`cdn.cycling74.com`), à la version détectée automatiquement
dans le patch (`APC_export.json`).

## Notes techniques

- Le bouton "Démarrer l'audio" est nécessaire : les navigateurs interdisent
  de lancer du son sans geste explicite de l'utilisateur.
- Un petit clavier de test envoie des notes MIDI (do4–do5) au device pour
  déclencher l'enveloppe ADSR — pratique pour tester les réglages sans
  contrôleur MIDI branché.
- Si tu ajoutes un contrôleur MIDI externe, tu peux router `navigator.requestMIDIAccess()`
  vers `device.scheduleEvent(new MIDIEvent(...))` dans `rnbo-ui-kit.js`.
