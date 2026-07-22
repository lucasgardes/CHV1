# Checklist de validation manuelle

## Préparation

- Lancer `npm test`.
- Lancer `npm start`.
- Ouvrir les outils de développement et vérifier l’absence d’erreur rouge.
- Connecter Intiface Central et l’appareil lorsque le test matériel est nécessaire.

## Parcours principal

1. Démarrer sur la carte.
2. Entrer dans une rencontre normale et vérifier le chargement automatique de la vidéo et du funscript.
3. Utiliser Temps mort et vérifier une seule pause, un seul compteur et une seule reprise.
4. Terminer la rencontre et vérifier l’or ainsi que la progression des recharges.
5. Entrer dans une boutique.
6. Vérifier que le stock ne contient aucun objet déjà possédé et aucun doublon.
7. Tester un achat avec assez d’or puis un achat sans assez d’or.
8. Renouveler le stock et vérifier le coût croissant.
9. Quitter la boutique et vérifier le retour à la carte.
10. Entrer dans un feu de camp.
11. Tester le repos et vérifier la recharge immédiate de tous les rechargeables.
12. Lors d’un autre feu de camp, améliorer un objet et vérifier qu’il ne peut pas être amélioré deux fois.
13. Tester Temps mort +, Écran de fumée, Silencieux et Chronomètre fissuré.
14. Terminer un élite, choisir une récompense et vérifier le retour à la carte.
15. Atteindre le boss et vérifier l’état de victoire.

## Effets temporaires

- Écran de fumée restaure exactement l’opacité précédente.
- Silencieux restaure exactement l’état sonore précédent.
- Une pause ne reprend jamais une ancienne rencontre.
- Finir une vidéo pendant un effet annule proprement l’effet.
- Changer d’écran pendant un effet ne relance pas la vidéo.
- Deux objets actifs ne peuvent pas être lancés simultanément.
- Un objet non implémenté est visible mais désactivé.

## Recharge

- Temps mort : une rencontre réussie.
- Écran de fumée : une rencontre réussie.
- Silencieux : une rencontre réussie.
- Chronomètre fissuré : deux rencontres, puis une après amélioration.
- Une boutique, un événement ou un feu de camp ne réduit pas un compteur.
- Le simple chargement d’une rencontre ne réduit pas un compteur.
- Un objet acheté ou reçu est disponible immédiatement.
- Une nouvelle partie remet les états d’exécution à zéro.

## Carte et salles

- Les boutiques et feux de camp restent ouverts après le clic.
- Une salle ne peut être validée qu’une fois.
- Le retour à la carte actualise les cases accessibles.
- Chaque route commence par un Warm-up, contient au moins un élite et finit au boss.
- Aucun chemin ne contient de séquence interdite.
