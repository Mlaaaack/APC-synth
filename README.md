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

- Le patch se charge et l'interface (sliders, sélecteur MIDI, clavier)
  se construit **immédiatement** à l'ouverture de la page, sans clic
  préalable. Seul le son reste en pause tant qu'on n'a pas cliqué sur le
  bouton **⏻ ON/OFF** en haut à droite — c'est une contrainte des
  navigateurs (impossible de démarrer un AudioContext sans geste
  utilisateur), pas un choix de design. Tourner les potards fonctionne
  même avant d'appuyer sur ON.
- Un vrai clavier de piano (dessiné en SVG, touches blanches/noires,
  cliquable et glissable) envoie des notes MIDI au device — pratique
  pour tester sans contrôleur MIDI branché.
- Un sélecteur "Entrée MIDI" apparaît automatiquement (Web MIDI API) et
  liste les périphériques MIDI connectés ; un bouton **↻** à côté permet
  de réactualiser la liste si tu branches un clavier après avoir ouvert
  la page. Fonctionne sur Chrome/Edge ; pas encore supporté par
  Firefox/Safari, auquel cas seul le clavier à l'écran est disponible.
- Chaque paramètre du patch est lu directement depuis le device RNBO
  (min, max, valeur initiale, unité, liste d'énum) — rien n'est codé en
  dur, donc si tu changes une borne côté Max, l'interface web suit
  automatiquement au prochain export.

## Pièges corrigés (à ne pas réintroduire)

- `device.parametersById` est une **Map**, pas un objet : il faut
  `device.parametersById.get(paramId)`, jamais `parametersById[paramId]`
  (qui renvoie silencieusement `undefined` — sections vides sans erreur).
- Le CDN `cdn.cycling74.com` ne mirror pas forcément toutes les versions
  de `rnbo.min.js`. Le kit essaie d'abord
  `c74-public.nyc3.digitaloceanspaces.com` (utilisé par le template
  d'export officiel de Cycling '74) puis se rabat sur `cdn.cycling74.com`.
- Ce patch (v2) expose tous ses paramètres à plat au niveau du patcher
  principal (`attack`, `drive_mix`, etc., sans préfixe). Une version
  précédente les avait dans un sous-patcher polyphonique nommé "poly"
  (paramId du type `poly/attack`) — si tu reviens à ce genre de
  structure, la doc RNBO confirme que ce paramId unique pilote bien
  toutes les voix à la fois tant que `@exposevoiceparams` n'est pas
  activé sur le sous-patcher.
