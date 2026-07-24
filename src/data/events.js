"use strict";

export const EVENTS = Object.freeze([
  {
    id:"obedience-chest",
    category:"discovery",
    difficulty:"low",
    title:"Le coffre d’obéissance",
    description:"Une salle blanche contient uniquement un coffre métallique. L’écran au-dessus affiche : « Ne pas ouvrir. » La porte de sortie est déjà déverrouillée.",
    choices:[
      {
        id:"leave-closed",
        label:"Quitter la salle sans ouvrir le coffre",
        effect:{ type:"gain-gold", amount:25 }
      },
      {
        id:"open-chest",
        label:"Ouvrir le coffre",
        effect:{
          type:"compound",
          effects:[
            { type:"gain-gold", amountRange:[35,45] },
            { type:"shop-price-multiplier", multiplier:1.05 }
          ]
        }
      }
    ]
  },
  {
    id:"two-doors",
    category:"immediate-choice",
    difficulty:"low",
    title:"Les deux portes",
    description:"Deux portes apparaissent : l’une marquée d’une pièce, l’autre d’un chronomètre.",
    choices:[
      {
        id:"gold-door",
        label:"Porte de la pièce — gagner 35 pièces d’or",
        effect:{ type:"gain-gold", amount:35 }
      },
      {
        id:"timer-door",
        label:"Porte du chronomètre — réduire la prochaine rencontre de 20 secondes",
        effect:{ type:"next-duration", seconds:-20, source:"two-doors" }
      }
    ]
  },
  {
    id:"lighting-failure",
    category:"incident",
    difficulty:"low",
    title:"La panne d’éclairage",
    description:"Les lumières s’éteignent. Un message demande d’attendre le redémarrage, mais une porte de maintenance devient visible dans l’obscurité.",
    choices:[
      {
        id:"wait",
        label:"Attendre le redémarrage — recevoir 20 pièces d’or",
        effect:{ type:"gain-gold", amount:20 }
      },
      {
        id:"maintenance-door",
        label:"Prendre la porte de maintenance",
        effect:{
          type:"random-outcome",
          outcomes:[
            { type:"gain-gold", amount:40 },
            { type:"hide-interface", seconds:15, source:"lighting-failure" }
          ]
        }
      }
    ]
  }
]);

export function getEventById(eventId) { return EVENTS.find((event) => event.id === eventId) ?? null; }
export function getEventsByCategory(category) { return EVENTS.filter((event) => event.category === category); }
