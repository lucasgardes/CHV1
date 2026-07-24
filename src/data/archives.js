"use strict";

export const ARCHIVE_TIERS = Object.freeze({
  EARLY: "early",
  MIDDLE: "middle",
  LATE: "late"
});

export const ARCHIVES = Object.freeze([
  // Niveau 1 — premier tiers : enlèvement, panique et découverte du complexe.
  {
    id: "level-1-early-001",
    level: 1,
    tier: ARCHIVE_TIERS.EARLY,
    title: "Je n’ai rien signé",
    author: "Cobaye 418",
    text: "Je ne me souviens pas du trajet. Je me suis réveillé devant trois portes et une voix affirme que j’ai accepté de participer. C’est faux. Je n’ai rien signé."
  },
  {
    id: "level-1-early-002",
    level: 1,
    tier: ARCHIVE_TIERS.EARLY,
    title: "Seulement un numéro",
    author: "Cobaye 403",
    text: "Ils ne m’appellent jamais par mon nom. Sur l’écran, je suis seulement le sujet 403. J’ai trouvé d’autres numéros gravés ici. Je ne suis pas le premier."
  },
  {
    id: "level-1-early-003",
    level: 1,
    tier: ARCHIVE_TIERS.EARLY,
    title: "Toujours observé",
    author: "Cobaye 376",
    text: "Même lorsque l’écran est noir, les caméras continuent de bouger. J’en ai couvert une avec ma chemise. Les portes se sont verrouillées avant que j’aie le temps de reculer."
  },
  {
    id: "level-1-early-004",
    level: 1,
    tier: ARCHIVE_TIERS.EARLY,
    title: "La pièce aveugle",
    author: "Cobaye 291",
    text: "Cette petite pièce n’a pas de caméra. Je crois qu’ils ignorent son existence. Je laisse ce message pour celui qui trouvera la trappe après moi."
  },
  {
    id: "level-1-early-005",
    level: 1,
    tier: ARCHIVE_TIERS.EARLY,
    title: "Aucune fenêtre",
    author: "Cobaye 354",
    text: "J’ai cherché une fenêtre, une bouche d’aération assez large, n’importe quoi. Tout est fermé. Chaque passage ramène vers une nouvelle salle et une nouvelle épreuve."
  },
  {
    id: "level-1-early-006",
    level: 1,
    tier: ARCHIVE_TIERS.EARLY,
    title: "Les mêmes murs",
    author: "Cobaye 325",
    text: "Toutes les salles se ressemblent. Même chaise, même écran, mêmes caméras. Cet endroit a été construit pour recommencer le même protocole encore et encore."
  },
  {
    id: "level-1-early-007",
    level: 1,
    tier: ARCHIVE_TIERS.EARLY,
    title: "Ils savent déjà",
    author: "Cobaye 409",
    text: "La voix connaissait mon âge et mon dossier médical. Ils m’ont choisi avant de m’enlever. Mon arrivée ici n’a rien d’un hasard."
  },
  {
    id: "level-1-early-008",
    level: 1,
    tier: ARCHIVE_TIERS.EARLY,
    title: "Le silence entre les salles",
    author: "Cobaye 267",
    text: "Je n’ai entendu aucun autre prisonnier. Seulement les machines derrière les murs et parfois des pas qui s’arrêtent dès que je m’approche d’une porte."
  },
  {
    id: "level-1-early-009",
    level: 1,
    tier: ARCHIVE_TIERS.EARLY,
    title: "Pour le suivant",
    author: "Cobaye 421",
    text: "Ne gaspille pas ton énergie à forcer les premières portes. Elles ne s’ouvrent qu’après l’épreuve. Garde tes forces. Quelqu’un trouvera peut-être cette note après moi."
  },

  // Niveau 1 — deuxième tiers : les incidents, récompenses et choix sont des tests.
  {
    id: "level-1-middle-001",
    level: 1,
    tier: ARCHIVE_TIERS.MIDDLE,
    title: "La panne était prévue",
    author: "Cobaye 388",
    text: "Les lumières se sont éteintes, puis une porte de maintenance s’est ouverte. Une caméra s’est tournée vers elle avant même que je la voie. Ce n’était pas une panne. Ils attendaient mon choix."
  },
  {
    id: "level-1-middle-002",
    level: 1,
    tier: ARCHIVE_TIERS.MIDDLE,
    title: "Tout est compté",
    author: "Cobaye 342",
    text: "J’ai aperçu un écran de contrôle : temps de réponse, hésitations, regard, rythme cardiaque. Ils enregistrent bien plus que la réussite ou l’échec."
  },
  {
    id: "level-1-middle-003",
    level: 1,
    tier: ARCHIVE_TIERS.MIDDLE,
    title: "Les récompenses",
    author: "Cobaye 301",
    text: "L’or et les objets ne sont pas des cadeaux. Ils observent ce que nous achetons, ce que nous gardons et ce que nous acceptons de sacrifier pour continuer."
  },
  {
    id: "level-1-middle-004",
    level: 1,
    tier: ARCHIVE_TIERS.MIDDLE,
    title: "Le faux accident",
    author: "Cobaye 395",
    text: "L’alarme de contamination s’est arrêtée dès que j’ai choisi de suivre les instructions. Aucun produit n’a circulé dans la salle. L’urgence était fabriquée."
  },
  {
    id: "level-1-middle-005",
    level: 1,
    tier: ARCHIVE_TIERS.MIDDLE,
    title: "Un profil, pas un score",
    author: "Cobaye 279",
    text: "Deux sujets peuvent réussir la même épreuve et recevoir des réactions différentes. Ils ne cherchent pas seulement un bon score. Ils construisent un profil à partir de chaque décision."
  },
  {
    id: "level-1-middle-006",
    level: 1,
    tier: ARCHIVE_TIERS.MIDDLE,
    title: "La salle d’observation",
    author: "Cobaye 364",
    text: "Derrière une grille, j’ai vu une rangée de moniteurs montrant mes salles précédentes. Chaque erreur était marquée, même celles qui n’avaient provoqué aucune sanction."
  },
  {
    id: "level-1-middle-007",
    level: 1,
    tier: ARCHIVE_TIERS.MIDDLE,
    title: "Le choix importe",
    author: "Cobaye 318",
    text: "Dans une salle, les trois options menaient toutes à la même porte. Pourtant la voix a attendu longtemps après mon choix. La décision elle-même était l’épreuve."
  },
  {
    id: "level-1-middle-008",
    level: 1,
    tier: ARCHIVE_TIERS.MIDDLE,
    title: "Ils ajustent le protocole",
    author: "Cobaye 407",
    text: "Après que j’ai évité deux risques, les salles suivantes ont changé. Ils adaptent les épreuves à notre comportement pour nous pousser là où nous sommes les plus faibles."
  },

  // Niveau 1 — dernier tiers : le boss est une validation et le complexe continue.
  {
    id: "level-1-late-001",
    level: 1,
    tier: ARCHIVE_TIERS.LATE,
    title: "Pas une sortie",
    author: "Cobaye 251",
    text: "La dernière porte de ce secteur n’a aucun marquage de sortie. Les câbles, les rails et les conduites continuent derrière le mur. Il y a autre chose après cette épreuve."
  },
  {
    id: "level-1-late-002",
    level: 1,
    tier: ARCHIVE_TIERS.LATE,
    title: "Phase suivante",
    author: "Cobaye 333",
    text: "J’ai entendu deux techniciens parler d’une “phase suivante”. Ils ne s’attendaient pas à ce que j’arrive aussi loin. Le boss ne termine probablement rien."
  },
  {
    id: "level-1-late-003",
    level: 1,
    tier: ARCHIVE_TIERS.LATE,
    title: "Le premier filtre",
    author: "Cobaye 287",
    text: "Ce niveau élimine les sujets trop faibles ou trop imprévisibles. Ceux qui atteignent la fin ne sont pas libérés : ils sont seulement autorisés à poursuivre le protocole."
  },
  {
    id: "level-1-late-004",
    level: 1,
    tier: ARCHIVE_TIERS.LATE,
    title: "Validation du secteur",
    author: "Cobaye 371",
    text: "Un écran de maintenance affichait : “Validation du secteur requise avant transfert”. Le transfert semble automatique après le boss. Je n’ai vu aucune procédure de libération."
  },
  {
    id: "level-1-late-005",
    level: 1,
    tier: ARCHIVE_TIERS.LATE,
    title: "Ils veulent que nous avancions",
    author: "Cobaye 412",
    text: "Je croyais qu’ils cherchaient seulement à nous faire échouer. Maintenant je comprends : ils veulent surtout identifier ceux qui peuvent continuer. Les morts ne sont que les sujets rejetés."
  },
  {
    id: "level-1-late-006",
    level: 1,
    tier: ARCHIVE_TIERS.LATE,
    title: "Derrière le boss",
    author: "Cobaye 296",
    text: "La paroi derrière la salle finale vibre comme une porte d’ascenseur. Si je survis, je ne retournerai pas dehors. Je descendrai plus profondément dans leur installation."
  }
]);

export function getArchiveById(id) {
  return ARCHIVES.find((entry) => entry.id === id) ?? null;
}

export function getArchivesForLevelAndTier(level, tier) {
  return ARCHIVES.filter((entry) => entry.level === level && entry.tier === tier);
}
