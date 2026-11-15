# Direction visuelle de l'appli film (`web/`), v2, 14/11

Périmètre : l'appli 3D dans `web/` uniquement. L'appli racine garde le design system du `CLAUDE.md` du repo. La structure en pages ci-dessous est remplacée par `single-film-design.md` (un seul film 3D) ; palette, polices, règles de texte et de mouvement restent valables pour `web/`.

Remplace la v1 « rapport imprimé » (rejetée : illisible pour un non-spécialiste).

## Le principe
Un juge non spécialiste comprend chaque page en 5 secondes, sans lire. **Le visuel d'abord, les chiffres ensuite, le texte en dernier.**
- Plusieurs pages, chacune répond à UNE question.
- Chaque page s'ouvre sur une grande image vivante (3D, horizon animé, carte), pas sur un tableau.
- Couleurs, mouvements, illustrations : oui. Mais chaque élément montre une vraie donnée (ou du mock signalé).

## Pages
| Route | Question | Visuel principal |
|---|---|---|
| `/` | « C'est quoi le problème ? » | Scène 3D : sol lunaire, Soleil rasant qui tourne autour de l'horizon, ombres longues, petit atterrisseur. Histoire d'Athena. |
| `/sites` | « Où peut-on se poser ? » | Carte du pôle Sud (vue du dessus), 9 régions cliquables. |
| `/sites/:id` | « Ici, est-ce que je vois le Soleil et la Terre ? » | Anneau d'horizon 360° animé, Soleil et Terre qui bougent, curseur de temps + bouton Play. |
| `/plan` | « Quand partir ? » | Date + durée → classement des sites en cartes avec jauges. |
| `/crash-test` | « Mon atterrisseur survit-il ? » | 3D : des centaines d'atterrisseurs fantômes, ceux qui meurent passent au rouge. |
| `/method` | « Pourquoi vous croire ? » | Comparaison avec les vraies images LRO. |

## Couleurs
| Rôle | Valeur |
|---|---|
| Ciel / fond | `#0B1020` (bleu nuit, pas noir pur) |
| Surface (panneaux) | `#141A2E` |
| Régolithe (texte doux, relief) | `#C9C4BA` |
| Texte | `#F4F1EA` |
| Soleil | `#FFB547` |
| Terre | `#4DA3FF` |
| Les deux / bon | `#5BD69A` |
| Danger / mort | `#FF5A4E` |

## Typo
Titres : Bricolage Grotesque. Texte : Atkinson Hyperlegible (très lisible, pensée pour l'accessibilité). Chiffres en `tabular-nums`.

## Texte
- Court. Phrases de moins de 15 mots. Une idée par phrase. Parler comme à un ami curieux.
- Pas de jargon sans image à côté. Pas de « seamless, unlock, insights, journey, powerful ».
- Pas de paragraphes d'intro. Un titre qui pose la question, une phrase, le visuel.

## Mouvement
- Animations au service de la compréhension : le Soleil qui tourne, l'ombre qui avance, les fantômes qui tombent.
- Respecter `prefers-reduced-motion`.

## Règles qui ne bougent pas
- Aucun chiffre inventé. Mock = bandeau visible.
- Aucun logo ni insigne NASA.
- Le Soleil au pôle reste à ±1,5° de l'horizon : un Soleil haut dans le ciel est un bug.
- Pas d'étoiles visibles quand le sol est éclairé (réalisme photo).
