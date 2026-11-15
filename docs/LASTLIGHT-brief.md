> **Archived working notes (14–15 Nov), superseded.** They describe drafts and the first prototype and may contradict the final submission. The final submission, with its current results, validation and limits, is [`lastlight-final/`](../lastlight-final/README.md) (start with its README).

# LASTLIGHT — brief projet (NASA Space Apps 2026, Casablanca)

> Ce fichier est la source de vérité du projet. Chaque session Claude Code (la mienne, celle de mon pote, cloud ou local) le lit avant de toucher au code. Si une décision change, on met à jour CE fichier dans la même PR.

Équipe : « Casablanca, We Have A Solution » (3 personnes)
Challenge : **Lunar Landing Site Navigator**
Deadline : dimanche 15 novembre 2026, 23:59 heure de Casablanca (à confirmer avec le Local Lead ; la soumission est définitive)
Langue du produit (UI, vidéo, page projet) : **anglais**. Langue de travail de l'équipe : français.

---

## 1. Ce qu'on construit (à relire avant chaque tâche)

**LASTLIGHT — "Choose where and when your lander survives the lunar south pole."**

Le challenge demande un outil intuitif pour comparer des sites et des dates d'atterrissage au pôle Sud, en visualisant le Soleil et la Terre par rapport à l'horizon, afin d'évaluer l'énergie solaire et les fenêtres de communication directe avec la Terre. Public : planificateurs de mission, enseignants, grand public.

On y répond, puis on va plus loin avec une question que personne d'autre ne posera :
**« Si je vise ce point à cette date, quelle est la probabilité que mon atterrisseur survive ? »**

Contexte réel qui ancre le projet (ne pas inventer d'autres chiffres) :
- Athena (Intuitive Machines IM-2) s'est posé à Mons Mouton (une des 9 régions candidates d'Artemis III) le 6 mars 2025, sur le côté, dans un cratère, à 250 m (selon IM) / plus de 400 m (selon la NASA) de sa cible. Mission prévue ~10 jours, terminée en moins de 13 heures : les panneaux ne pouvaient pas se recharger (direction du Soleil, orientation des panneaux, froid).
- Odysseus (IM-1, 2024) : posé incliné, panneaux pas orientables vers le Soleil, 6 jours d'opérations.
- Sur 4 missions CLPS tentées (à mars 2025) : 1 posé droit, 2 sur le côté, 1 n'a pas atteint la Lune.

**Résultat titre à produire** : « The 10 safest landing windows at the lunar south pole, 2027–2030 » — fenêtres où un atterrisseur générique survit 14 jours avec ≥ 95 % de probabilité (paramètres exacts à figer dans `pipeline/config.py`), malgré l'erreur d'atterrissage et les retards de lancement.

### Les 9 régions candidates Artemis III
Peak near Cabeus B, Haworth, Malapert Massif, Mons Mouton Plateau, Mons Mouton, Nobile Rim 1, Nobile Rim 2, de Gerlache Rim 2, Slater Plain.
→ Trouver une source officielle des positions (NASA / LEAG / NTRS). Si aucune donnée numérique n'existe, numériser depuis la carte NASA officielle et **documenter que c'est une approximation** dans `docs/assumptions.md`.

---

## 2. Comment on gagne (lecture du barème)

5 critères à poids égal : **Influence, Creativity, Validity, Relevance, Presentation**.
Deux jurys : (1) juges locaux à Casablanca, non spécialistes, 3 minutes, qui comparent avec des projets agriculture/eau ; (2) experts NASA qui lisent la page projet. Il faut convaincre les deux.

| Critère | Ce qu'on prouve | Où |
|---|---|---|
| Influence | Le vrai problème qui a tué 2 missions ; utile à toute mission vers le pôle ; open source | Vidéo + page |
| Creativity | Probabilité de survie sous incertitude (erreur d'atterrissage, inclinaison, retard de lancement) | Écran Crash Test |
| Validity | Validation vs 3 807 vraies images LRO + modèle NASA, barres d'erreur, limites assumées | Page projet (images) |
| Relevance | Chaque phrase du challenge ↔ une fonction (tableau dans la page) | Page + UI |
| Presentation | Histoire d'Athena + vue première personne | Vidéo 30 s |

Prix visé en priorité : **Best Use of Science**. Ensuite Best Use of Data, Best Mission Concept.

### Ce que la majorité des équipes va faire (et qu'on ne fait PAS)
- Globe 3D avec marqueurs + panneau de graphiques, souvent sans relief dans le calcul.
- « Landing Score 87/100 » = somme pondérée arbitraire.
- Chatbot / « AI-powered ».
- Look IA par défaut : dégradés violets, glassmorphism, Inter partout, emojis, 12 widgets.
- Des chiffres jamais vérifiés.

### Règles non négociables
1. **Aucun chiffre inventé.** Tout chiffre affiché (UI, vidéo, page) vient d'un fichier produit par `pipeline/`. Les données de test sont marquées `"mock": true` et l'UI affiche un bandeau « MOCK DATA » tant qu'elles sont utilisées.
2. **Pas de ML** dans le produit. Le calcul est géométrique et exact.
3. **Pas de chatbot.**
4. Toute hypothèse de modèle est écrite dans `docs/assumptions.md` (valeur, justification, source).
5. Chaque limite connue est écrite dans `docs/limitations.md`.

---

## 3. Architecture du repo

```
/pipeline   Python 3.11 — calcul scientifique, Modal          (owner : pote "science")
/web        Vite + React + TypeScript, three.js (react-three-fiber), D3   (owner : Redouane)
/video      Remotion — vidéo de 30 s en motion design          (owner : Redouane + Claude)
/contracts  schéma JSON partagé + données mock                 (modif = PR revue par les deux)
/docs       textes de soumission, hypothèses, limites, script vidéo
/assets     audio (voix ElevenLabs, musique, SFX) — fichiers légers seulement
```

- Ne **jamais** committer le relief brut (plusieurs Go). Stockage sur un Modal Volume. Seuls les JSON compressés pour le web sont commités (`web/public/data/`, budget < 50 Mo au total).
- Un fichier JSON par site et par année, chargé à la demande.

---

## 4. Le contrat de données (`contracts/schema.json`) — à écrire EN PREMIER

Le front développe sur `contracts/mock/` pendant que le pipeline tourne. Toute modification du schéma = mise à jour du schéma + du mock + des deux côtés dans la même PR.

```jsonc
// web/public/data/sites.json
{ "generated_at": "ISO8601", "mock": false,
  "sites": [{
    "id": "mons-mouton", "name": "Mons Mouton", "lat": -84.3, "lon": 31.2,   // valeurs d'exemple, pas réelles
    "elevation_m": 0,
    "horizon": { "az_step_deg": 0.5, "mast_2m": [/*720 élévations en degrés*/], "mast_10m": [/*720*/] },
    "validation": { "lroc_illum_pct": null, "model_illum_pct": null }
  }]
}

// web/public/data/series/{site_id}_{year}.json
{ "site_id": "...", "t0": "2027-01-01T00:00:00Z", "step_h": 1,
  "sun_el": [], "sun_az": [], "earth_el": [], "earth_az": [],   // degrés, repère topocentrique local
  "sun_frac": [], "earth_frac": [],                               // fraction visible du disque, 0..1
  "irradiance_wm2": [] }                                          // pour un panneau vertical idéalement orienté

// web/public/data/survival/{site_id}.json
{ "site_id": "...", "params_ref": "config hash",
  "windows": [{ "landing_utc": "...", "p_survive_14d": 0.0, "p_comm_ok": 0.0,
                "median_days_alive": 0.0, "slip_tolerance_days": 0 }],
  "ghost_landers_sample": [{ "dx_m": 0, "dy_m": 0, "tilt_deg": 0, "died_at_h": null }] }  // ≤ 2000 pour la 3D

// web/public/data/top10.json   — le résultat titre
```

Tous les temps en **UTC**. Azimut : 0° = nord local, sens horaire, documenté dans le schéma.

---

## 5. La science (`/pipeline`)

### 5.1 Données (vérifier chaque URL et le format avant de télécharger)
- **Relief** : DEM polaire LOLA du pôle Sud (PDS Geosciences Node, gridded data « polar », et/ou NASA PGDA). Il faut couvrir **depuis ~80°S** : des montagnes à plus de 100 km bloquent un Soleil à 1,5°. Résolution 20–80 m/px pour l'horizon lointain ; un DEM local plus fin (5–10 m) autour des cibles si disponible.
- **Éphémérides** : noyaux SPICE NAIF via Skyfield : `de421.bsp` (ou de440s), `moon_080317.tf`, `moon_pa_de421_1900-2050.bpc`.
- **Validation 1 (vraies photos)** : LROC « WAC Time-Weighted South Pole Illumination Map » (88–90°S, 100 m/px, 3 807 images WAC du 15/02/2010 au 05/02/2011).
- **Validation 2 (modèle)** : cartes d'éclairage moyen PGDA (Mazarico et al. 2011), produit « Lunar Polar Illumination ».
- **Athena** : coordonnées publiées du point d'arrivée (LROC a photographié le site) + date/heure d'atterrissage publiques. Ne rien deviner : si introuvable, le dire.
- Lister CHAQUE donnée et source dans `docs/data-sources.md` (obligatoire pour la soumission).

### 5.2 Horizon
- Pour chaque point : 720 azimuts (0,5°), marche de rayon jusqu'à ~150 km, avec des pas qui grandissent avec la distance.
- `el = atan((h − h0 − d²/(2R)) / d)`, R = 1737,4 km, h0 = altitude du sol + hauteur du mât (2 m et 10 m). On garde le maximum.
- Interpolation bilinéaire dans le DEM. numba obligatoire. Grilles massives sur Modal (`modal.Function.map`).
- Grilles fines autour des cibles : un point tous les ~20 m dans un rayon de 1 km (pour le crash-test).

### 5.3 Soleil et Terre
```python
from skyfield.api import load, PlanetaryConstants
ts = load.timescale(); eph = load('de421.bsp')
pc = PlanetaryConstants()
pc.read_text(load('moon_080317.tf')); pc.read_text(load('pck00008.tpc'))
pc.read_binary(load('moon_pa_de421_1900-2050.bpc'))
frame = pc.build_frame_named('MOON_ME_DE421')
site = eph['moon'] + pc.build_latlon_degrees(frame, lat, lon)
alt, az, dist = site.at(t).observe(eph['sun']).apparent().altaz()
```
- **Astuce de perf** : calculer la direction du Soleil et de la Terre dans le repère MOON_ME **une fois par pas de temps**, puis passer en topocentrique local par rotation pour chaque point. La parallaxe entre points de la grille est négligeable pour le Soleil comme pour la Terre (vérifier numériquement sur 2 points et écrire l'écart dans `docs/assumptions.md`).
- Vérifier une valeur avec un calcul indépendant (Skyfield direct sur 1 site) → test unitaire.

### 5.4 Fraction visible du disque
- Soleil : rayon angulaire ≈ 0,267°. Terre : ≈ 0,95° (calculer avec la distance réelle).
- Fraction = aire du disque au-dessus de la ligne d'horizon locale (approx : l'horizon est localement plat sur la largeur du disque), interpolé à l'azimut du centre.

### 5.5 Énergie et survie (crash-test)
Atterrisseur générique (tous les paramètres dans `config.py` + `docs/assumptions.md`) :
- Panneaux = liste de normales dans le repère de l'atterrisseur (défaut : panneaux verticaux sur plusieurs faces, à documenter).
- Puissance = Σ surface × rendement × 1361 W/m² × max(0, ŝ·n̂) × sun_frac.
- Batterie : capacité, état initial, consommation constante. Mort = batterie à 0. Pas de modèle thermique (→ limitations).
- Communication OK si earth_frac > seuil.
- Monte Carlo par (site, date d'atterrissage) : position d'arrivée = gaussienne 2D autour de la cible (σ documenté, motivé par les écarts réels d'Athena), inclinaison et lacet aléatoires, petite probabilité de basculement. Retard de lancement : décaler la date de 0 à 30 jours → `slip_tolerance_days`.
- Sorties : `p_survive_14d`, `p_comm_ok`, `median_days_alive`, échantillon d'atterrisseurs fantômes pour la 3D, et `top10.json`.

### 5.6 Validation (livrable obligatoire, figures dans `docs/figures/`)
1. Sur 88–90°S à 100 m/px, sur la même période que LROC (15/02/2010 → 05/02/2011) : % du temps éclairé, comparé pixel à pixel à la carte LROC → nuage de points, biais, RMSE, carte des écarts.
2. Même chose vs PGDA.
3. Reconstitution Athena : Soleil et Terre vus depuis le point d'arrivée au moment de l'atterrissage + énergie avec l'orientation « sur le côté ». Formulation : « the conditions Athena faced », jamais « we would have predicted ».
4. Barres d'erreur : relancer avec du bruit sur le relief (amplitude documentée) → dispersion de l'éclairage.
Si un résultat ne colle pas, on l'écrit et on explique pourquoi. Pas de maquillage.

---

## 6. Le front (`/web`)

Écrans (dans cet ordre de priorité) :
1. **Window Finder** (écran d'accueil) : calendrier sites × jours (ambre = Soleil, bleu = Terre, vert = les deux, noir = nuit), sélecteur de date et durée, verdict en une phrase simple par site.
2. **Horizon Ring** : panorama 360° de la silhouette du relief + trajectoires du Soleil et de la Terre, curseur de temps.
3. **Crash Test** : relief 3D de la zone cible, atterrisseurs fantômes en instancing (couleur = jour de mort), curseur de temps, courbe de survie.
4. **Lander View** : vue première personne rendue en raymarching sur la heightmap (shader), Soleil et Terre aux bonnes positions, l'éclairage vient de NOS données d'horizon (pas d'une lumière arbitraire).
5. **Athena Replay** : page récit.
6. **Methods** : validation, hypothèses, limites, sources.

Trois usages du même outil : mission planner (chiffres, export CSV des fenêtres), educator/public (Lander View + textes simples). URL partageable (site, date, durée dans la query string).

### Design system
- Fond noir mat `#0B0B0C`, texte `#E8E6E1`, gris `#6B6B6B`.
- Soleil `#F2A93B` (ambre), Terre `#4C8DF6` (bleu), les deux `#3FB68B`, mort/alerte `#E5484D` (uniquement pour ça).
- Police : une sans-serif sobre pour le texte (ex. IBM Plex Sans) + monospace pour toutes les valeurs (IBM Plex Mono).
- Interdits : dégradés violets, glassmorphism, ombres portées lourdes, emojis, icônes décoratives, plus de 2 animations simultanées.
- Esthétique : console d'opérations de mission. Dense mais lisible. Chaque élément affiche une donnée réelle.
- Le Soleil au pôle rase l'horizon (≤ ~1,5°) : toute vue 3D qui montre un Soleil haut est un bug.

Déploiement : Vercel connecté au repo, dossier racine `web`. Chaque push sur une branche = URL de preview.

---

## 7. La vidéo (`/video`, Remotion)

Contraintes officielles : **30 s maximum**, sous-titres anglais incrustés, hébergée publiquement (YouTube non répertorié ou Drive). Aucun visage ni voix reconnaissable de personne de moins de 18 ans → voix off ElevenLabs. Mentionner l'usage d'IA (voix) dans la description de la page et les métadonnées, et ajouter à l'écran une petite mention « AI-generated voice ». Musique et SFX : uniquement des fichiers dont on a la licence, listés dans `docs/data-sources.md`.

**Étape 1 — script (à livrer AVANT de monter quoi que ce soit)** : écrire `docs/video-script.md` :
- Voix off en anglais, **60 mots maximum** (≈ 26 s de voix à un débit calme), découpée par plans avec le timecode.
- Pour chaque plan : texte de la voix, texte à l'écran, visuel, SFX suggéré.
- Un bloc « ElevenLabs » : texte prêt à coller, sans annotations, + direction de voix (ton calme, grave, documentaire, rythme posé, pauses marquées par des sauts de ligne).
- Les chiffres issus du pipeline sont en placeholders `{{TOP10_P_SURVIVE}}` tant qu'ils ne sont pas calculés.

Structure (suit le minutage conseillé par Space Apps) :
| Temps | Plan |
|---|---|
| 0–5 s | Noir. « March 2025. Athena lands at the lunar south pole. 13 hours later, it's dead. » |
| 5–10 s | Lander View : Soleil rasant, l'ombre avale le terrain. Titre LASTLIGHT + équipe + challenge (texte uniquement). |
| 10–20 s | Atterrisseurs fantômes sur le relief 3D, calendrier qui s'allume. « Built on NASA LOLA data. Validated against 3,807 LRO images. » |
| 20–30 s | Résultat titre + « Open-source, for every mission heading to the pole. » |

**Étape 2** : Redouane génère le MP3 sur ElevenLabs et le dépose dans `assets/audio/voice.mp3`, avec la musique et les SFX choisis dans `assets/audio/music/` et `assets/audio/sfx/`.
**Étape 3** : monter en Remotion (1920×1080, 30 fps), caler les plans sur la voix, utiliser des captures réelles de l'app (pas de visuels inventés), exporter en MP4.

---

## 8. Textes de soumission (`/docs/submission.md`, en anglais)

Champs à remplir : Project Name, High-Level Summary, Link to Demo, Link to Final Project (public, sans login), Detailed Description (ce que ça fait, comment, bénéfices, outils), NASA Data (lesquelles et comment), Other Data, **Use of AI** (honnête : code co-écrit avec Claude Code, voix ElevenLabs ; aucune donnée scientifique générée par IA), References. Plus les images de validation à téléverser sur la page.

Ajouter un tableau « Challenge requirement → LASTLIGHT feature ».

---

## 9. Planning et points de contrôle

| Heure | Jalon |
|---|---|
| Sam 11:00 | Repo, CLAUDE.md, schéma + mock commités. Téléchargements DEM et SPICE lancés |
| Sam 18:00 | **GO/NO-GO** : horizon d'au moins 1 site calculé + 1ʳᵉ comparaison LROC. Sinon : on coupe le crash-test et la Lander View |
| Sam 23:00 | Séries réelles des 9 sites dans le web, Window Finder + Horizon Ring branchés |
| Dim 04:00–09:00 | Dormir |
| Dim 12:00 | Script vidéo final avec vrais chiffres → MP3 → montage |
| Dim 18:00 | Page projet complète, Vercel en prod, vidéo en ligne. **Soumettre** |
| Dim → 23:59 | Uniquement des corrections. Rien de nouveau |

---

## 10. Collaboration entre sessions

- Une branche par chantier : `science/*`, `web/*`, `video/*`, `docs/*`. Personne ne modifie le dossier de l'autre sans le prévenir.
- PR courtes, mergées dans `main` toutes les 2–3 h. `main` doit toujours se déployer.
- Le pipeline écrit ses sorties dans `web/public/data/` via une PR dédiée « data: … » qui indique la version de `config.py`.
- Avant de commencer une tâche : `git pull`, relire ce fichier.
- Fin de session : résumer en 3 lignes dans `docs/log.md` (fait / en cours / bloqué).

## 11. Définition de « fini »
- Ça marche sur l'URL Vercel, sur un ordi portable et un téléphone, sans erreur dans la console.
- Aucun « MOCK DATA » visible.
- Chaque chiffre de la vidéo et de la page est traçable jusqu'à un fichier du pipeline.
- `docs/limitations.md`, `docs/assumptions.md`, `docs/data-sources.md` à jour.
