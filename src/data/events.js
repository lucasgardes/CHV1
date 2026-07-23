"use strict";

export const EVENTS = Object.freeze([
  {
    id:"event-001", category:"positive", title:"Bourse abandonnée",
    description:"Une petite bourse est posée au milieu du chemin. Elle semble étrangement facile à récupérer.",
    choices:[
      { id:"take-gold", label:"Prendre la bourse", effect:{ type:"gain-gold", amount:30 } },
      { id:"leave", label:"Ne pas y toucher", effect:{ type:"none" } }
    ]
  },
  {
    id:"event-002", category:"negative", title:"Portique de saisie",
    description:"Un portique exige un paiement immédiat. Les caméras suivent chacun de tes gestes.",
    choices:[
      { id:"pay", label:"Payer 25 pièces", effect:{ type:"lose-gold", amount:25 } },
      { id:"risk", label:"Forcer le passage", effect:{ type:"difficulty-shift", amount:1 } }
    ]
  },
  {
    id:"event-003", category:"positive", title:"Casier oublié",
    description:"Un casier entrouvert contient encore du matériel appartenant à un ancien cobaye.",
    choices:[
      { id:"take-item", label:"Récupérer l’objet", effect:{ type:"random-item" } },
      { id:"take-gold", label:"Prendre uniquement les pièces", effect:{ type:"gain-gold", amount:40 } }
    ]
  },
  {
    id:"event-004", category:"negative", title:"Inspection forcée",
    description:"Une voix ordonne de déposer un objet dans le réceptacle avant l’ouverture de la porte.",
    choices:[
      { id:"sacrifice", label:"Abandonner un objet aléatoire", effect:{ type:"lose-random-item" } },
      { id:"punishment", label:"Refuser", effect:{ type:"difficulty-shift", amount:1 } }
    ]
  },
  {
    id:"event-005", category:"neutral", title:"Interférence blanche",
    description:"L’écran affiche brièvement la silhouette d’une femme avant de revenir à la normale.",
    choices:[
      { id:"listen", label:"Écouter sa voix", effect:{ type:"arm-protection" } },
      { id:"ignore", label:"Continuer", effect:{ type:"none" } }
    ]
  },
  {
    id:"event-006", category:"negative", title:"Salle non répertoriée",
    description:"La porte se verrouille derrière toi. Une vidéo inconnue se charge automatiquement.",
    choices:[
      { id:"face", label:"Affronter l’épreuve", effect:{ type:"start-encounter", encounterId:"normal-001", encounterType:"normal" } }
    ]
  }
]);

export function getEventById(eventId) { return EVENTS.find((event) => event.id === eventId) ?? null; }
export function getEventsByCategory(category) { return EVENTS.filter((event) => event.category === category); }
