# Paysage concurrentiel et positionnement (recherche du 14/11, 10:45)

Projets publics trouvés sur GitHub pour le même challenge (README lus, pas le code). À relire avant de décider quoi couper.

| Projet | Ce qu'ils ont | Ce qu'ils n'ont pas |
|---|---|---|
| **LunaNav** (ziyadell, afuq.website) — le plus solide | 3 vues : Orbit (Lune 3D LROC + LOLA), Surface (vue à 2 m, ombres, skyline), Analysis (2 scénarios, 7–365 j, gaps, CSV). Horizon LOLA **80 m/px**, 720 az, 150 km. Horizons JPL 2026–2028. Guide narré ElevenLabs. URL partageable, tests, limites écrites. | Aucune validation vs LROC/PGDA. Aucun modèle d'énergie, de survie, d'incertitude. « no suitability score ». |
| **MoonSet** (RicardoArg23) | Horizon 360°, mode Explorateur/Planificateur, « et si la mission est retardée ? ». LOLA 5 m, Skyfield DE421. FastAPI + React. | Pas de validation, pas de survie. |
| MoonSight (dagimfkadie) | Streamlit, cartes de pente/incertitude LOLA 5 m, Horizons. | Pas d'horizon relief (plan géométrique). |
| M9nx | Prototype statique, valeurs synthétiques. | Calculs non activés. |
| Angel-A-V | Maquette physique (lampe + mur d'horizon), en cours. | Pas d'app. |

**Constat : aucun des 6 ne fait (a) de validation contre les vraies images LROC, (b) de probabilité de survie / Monte Carlo / retard de lancement, (c) de reconstitution Athena.** C'est exactement notre avance. Ne pas la diluer.

## Ce qui menace notre avance
- LunaNav a déjà une vue surface + une 3D + un guide narré. Notre Lander View ne sera pas « nouvelle » : elle doit être *correcte* (éclairage issu de nos horizons) et servir l'histoire Athena, pas être la vedette.
- Ils sont à 80 m/px. Nous visons **20 m/px** (LDEM_80S_20MPP_ADJ) + 5 m autour des cibles → à afficher comme avantage chiffré sur la page Methods (si on y arrive).

## Munition officielle NASA (à citer, c'est notre thèse mot pour mot)
George et al., *Artemis III Site Selection Update*, LPSC 2026 (NTRS 20250011660) :
- « individual regions typically provide limited viable opportunities when all constraints are simultaneously satisfied » ;
- plus d'une région doit être maintenue « to support acceptable annual mission availability and increase flexibility in launch timing » ;
- séjour en surface Artemis III ≈ **5,75 à 6,25 jours** ; préférence pour la visibilité Terre si communication DTE ; éclairage requis pendant tout le séjour.

→ Conséquences produit :
1. Durée **6 jours (crewed stay)** proposée à côté de 14 jours (robotic lander) dans le Window Finder.
2. Rangée « **regions viable that day** » au-dessus du calendrier : combien de régions offrent Soleil + Terre ce jour-là. C'est la question NASA « disponibilité annuelle grâce à plusieurs régions ».
3. Phrase de pitch : « NASA says no single region is enough. LASTLIGHT shows which ones back each other up, and how much launch slip each window can take. »

## Points ouverts
- **Coordonnées des 9 régions** : aucune table numérique officielle trouvée (SVS 5013 = ancienne liste de 13 sans KML ; atlas LPI inaccessible ; doc LPSC 2026 sans chiffres). LunaNav les a numérisées depuis la carte NASA (~0,5 km). On fait pareil nous-mêmes et on l'écrit dans `assumptions.md`. Ne pas copier leurs valeurs.
- Athena : 84,7906°S 29,1957°E, 17:28:50 UTC (source secondaire) → confirmer via la page LROC du site d'atterrissage.
