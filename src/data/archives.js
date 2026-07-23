"use strict";

export const ARCHIVES = Object.freeze([
  { id:"archive-001", title:"Note froissée", text:"Quelqu’un a compté les portes avant nous. Il affirme que les salles changent, mais jamais autant que nos souvenirs." },
  { id:"archive-002", title:"Liste de numéros", text:"Plus de quatre cents identifiants apparaissent sur la feuille. Le dernier numéro lisible est 425." },
  { id:"archive-003", title:"Journal de maintenance", text:"Les caméras des pièces techniques ne sont pas reliées au réseau principal. Les anciens cobayes les utilisaient pour laisser des avertissements." },
  { id:"archive-004", title:"Rapport d’enlèvement", text:"Les participants n’ont jamais signé. Ils ont été sélectionnés, transportés et enregistrés comme matériel expérimental." },
  { id:"archive-005", title:"Message interrompu", text:"Le superviseur masqué travaille pour une entreprise connue du public. Le complexe n’est qu’un de ses laboratoires." },
  { id:"archive-006", title:"Dossier 426", text:"Le sujet 426 présente une capacité d’adaptation anormale. Le rapport recommande une surveillance renforcée s’il anticipe le protocole." },
  { id:"archive-007", title:"Procédure terminale", text:"Vaincre l’épreuve finale ne libère pas le sujet. Cela valide seulement son transfert vers le programme principal." },
  { id:"archive-008", title:"Dernier témoignage", text:"Une silhouette blanche apparaît dans plusieurs récits de mort imminente. Personne ne sait si elle protège les cobayes ou les ramène volontairement." }
]);

export function getArchiveById(id) { return ARCHIVES.find((entry) => entry.id === id) ?? null; }
