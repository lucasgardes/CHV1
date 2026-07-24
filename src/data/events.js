"use strict";

export const EVENTS = Object.freeze([
  {
    id:"obedience-chest", category:"discovery", difficulty:"low", title:"Le coffre d’obéissance",
    description:"Une salle blanche contient uniquement un coffre métallique. L’écran au-dessus affiche : « Ne pas ouvrir. » La porte de sortie est déjà déverrouillée.",
    choices:[
      { id:"leave-closed", label:"Quitter la salle sans ouvrir le coffre", effect:{ type:"gain-gold", amount:25 } },
      { id:"open-chest", label:"Ouvrir le coffre", effect:{ type:"compound", effects:[{ type:"gain-gold", amountRange:[35,45] }, { type:"shop-price-multiplier", multiplier:1.05 }] } }
    ]
  },
  {
    id:"three-lockers", category:"discovery", difficulty:"medium", title:"Les trois casiers",
    description:"Trois casiers portent les inscriptions Sécurité, Richesse et Connaissance. Un seul peut être ouvert.",
    choices:[
      { id:"security", label:"Ouvrir Sécurité — réduire d’un round la recharge de tous les rechargeables", effect:{ type:"three-lockers-security", rounds:1 } },
      { id:"wealth", label:"Ouvrir Richesse — recevoir entre 45 et 60 pièces d’or", effect:{ type:"gain-gold", amountRange:[45,60] } },
      { id:"knowledge", label:"Ouvrir Connaissance — révéler les deux prochaines rencontres accessibles", effect:{ type:"reveal-next-encounters", count:2, source:"three-lockers" } }
    ]
  },
  {
    id:"confiscated-equipment", category:"discovery", difficulty:"medium", title:"Le matériel confisqué",
    description:"Deux objets confisqués apparaissent derrière une vitre. Le système autorise un échange contre l’un de tes objets, ou leur démontage.",
    choices:[
      {
        id:"exchange",
        label:"Échanger un objet possédé contre l’une des deux propositions",
        effect:{
          type:"choose-item-exchange",
          count:2,
          proposalTitle:"Choisir le matériel récupéré",
          proposalPrompt:"Deux objets non possédés ont été sélectionnés. Choisis celui que tu veux récupérer.",
          giveTitle:"Choisir l’objet à confisquer",
          unavailableLabel:"Aucun échange n’est actuellement possible."
        }
      },
      {
        id:"dismantle",
        label:"Démonter le matériel — gagner entre 50 et 65 pièces d’or",
        effect:{ type:"compound", effects:[
          { type:"gain-gold", amountRange:[50,65] },
          { type:"elite-rare-bonus", amount:0.15 }
        ] }
      }
    ]
  },
  {
    id:"two-doors", category:"immediate-choice", difficulty:"low", title:"Les deux portes",
    description:"Deux portes apparaissent : l’une marquée d’une pièce, l’autre d’un chronomètre.",
    choices:[
      { id:"gold-door", label:"Porte de la pièce — gagner 35 pièces d’or", effect:{ type:"gain-gold", amount:35 } },
      { id:"timer-door", label:"Porte du chronomètre — réduire la prochaine rencontre de 20 secondes", effect:{ type:"next-duration", seconds:-20, source:"two-doors" } }
    ]
  },
  {
    id:"calculated-sacrifice", category:"immediate-choice", difficulty:"medium", title:"Le sacrifice calculé",
    description:"La personne masquée annonce qu’un coût doit être payé pour ouvrir la porte suivante.",
    choices:[
      { id:"pay-gold", label:"Payer 35 pièces d’or", effect:{ type:"lose-gold", amount:35 } },
      { id:"sacrifice-consumable", label:"Sacrifier un consommable", effect:{ type:"choose-owned-item", itemType:"consumable", selectionTitle:"Sacrifier un consommable", prompt:"Choisis le consommable qui sera détruit.", unavailableLabel:"Tu ne possèdes aucun consommable.", selectedEffect:{ type:"lose-item", itemId:"$selectedItemId" } } },
      { id:"accept-sanction", label:"Accepter la sanction", effect:{ type:"compound", effects:[{ type:"next-intensity", amount:1, encounters:1, source:"calculated-sacrifice" }, { type:"next-reward", multiplier:1.25, source:"calculated-sacrifice" }] } }
    ]
  },
  {
    id:"rest-dilemma", category:"immediate-choice", difficulty:"medium", title:"Le dilemme du repos",
    description:"Le protocole peut être ralenti, mais le temps gagné doit être compensé d’une autre manière.",
    choices:[
      { id:"take-break", label:"Prendre une pause de 45 secondes et recharger un objet", effect:{ type:"choose-owned-item", itemType:"rechargeable", selectionTitle:"Choisir l’objet à recharger", prompt:"Sélectionne l’objet rechargeable qui profitera de la pause.", unavailableLabel:"Tu ne possèdes aucun objet rechargeable.", selectedEffect:{ type:"recharge-item", itemId:"$selectedItemId" }, afterEffects:[{ type:"next-reward", goldFlat:-20, source:"rest-dilemma" }] } },
      { id:"continue", label:"Continuer immédiatement — gagner 30 pièces d’or", effect:{ type:"gain-gold", amount:30 } },
      { id:"accelerate", label:"Accélérer le protocole", effect:{ type:"compound", effects:[{ type:"next-duration", seconds:-20, source:"rest-dilemma" }, { type:"next-intensity", amount:1, encounters:1, source:"rest-dilemma" }] } }
    ]
  },
  {
    id:"condemned-door", category:"immediate-choice", difficulty:"high", rarity:"rare", title:"La porte condamnée",
    description:"La porte suivante est condamnée. Le système propose trois solutions pour poursuivre.",
    choices:[
      { id:"force-passage", label:"Forcer le passage — perdre entre 55 et 70 pièces d’or", effect:{ type:"lose-gold", amountRange:[55,70] } },
      { id:"use-equipment", label:"Utiliser son équipement", effect:{ type:"choose-owned-item", itemType:"rechargeable", selectionTitle:"Désactiver un objet rechargeable", prompt:"Choisis l’objet qui sera désactivé jusqu’à ce que deux rencontres soient réussies.", unavailableLabel:"Tu ne possèdes aucun objet rechargeable.", selectedEffect:{ type:"disable-item", itemId:"$selectedItemId", encounters:2 } } },
      { id:"extra-trial", label:"Accepter une épreuve supplémentaire", effect:{ type:"start-encounter", encounterId:"normal-001", encounterType:"normal" } }
    ]
  },
  {
    id:"wounded-prisoner", category:"other-prisoner", difficulty:"medium", title:"Le faux blessé",
    description:"Un cobaye est allongé au sol et affirme avoir été abandonné par les scientifiques. Son récit semble plausible, mais quelque chose paraît anormal.",
    choices:[
      {
        id:"approach",
        label:"S’approcher immédiatement",
        effect:{
          type:"nested-choice",
          title:"Le vol",
          setup:{ type:"random-owned-item", itemType:"consumable" },
          prompt:"Le cobaye bondit et s’empare de « $contextItemName ». Il exige 20 pièces d’or pour le rendre.",
          emptyPrompt:"Le cobaye tente de voler quelque chose, mais tu ne possèdes aucun consommable. Il recule et abandonne.",
          emptyLabel:"Quitter la salle",
          choices:[
            { id:"pay-to-recover", label:"Payer 20 pièces d’or et récupérer $contextItemName", requiresGold:20, effect:{ type:"lose-gold", amount:20 } },
            { id:"let-him-keep-it", label:"Refuser de payer et perdre $contextItemName", effect:{ type:"lose-item", itemId:"$contextItemId" } }
          ]
        }
      },
      { id:"question-from-distance", label:"L’interroger à distance", effect:{ type:"gain-gold", amount:25 } },
      { id:"leave", label:"Quitter la salle", effect:{ type:"none" } }
    ]
  },
  {
    id:"lighting-failure", category:"incident", difficulty:"low", title:"La panne d’éclairage",
    description:"Les lumières s’éteignent. Un message demande d’attendre le redémarrage, mais une porte de maintenance devient visible dans l’obscurité.",
    choices:[
      { id:"wait", label:"Attendre le redémarrage — recevoir 20 pièces d’or", effect:{ type:"gain-gold", amount:20 } },
      { id:"maintenance-door", label:"Prendre la porte de maintenance", effect:{ type:"random-outcome", outcomes:[{ type:"gain-gold", amount:40 }, { type:"hide-interface", seconds:15, source:"lighting-failure" }] } }
    ]
  },
  {
    id:"total-lockdown", category:"incident", difficulty:"high", title:"Le verrouillage total",
    description:"La salle se ferme entièrement. Le système prétend qu’une défaillance menace les appareils et exige de choisir ce qui doit être protégé.",
    choices:[
      { id:"protect-inventory", label:"Protéger l’inventaire — payer entre 50 et 65 pièces d’or", effect:{ type:"lose-gold", amountRange:[50,65] } },
      { id:"protect-rechargeables", label:"Protéger les systèmes rechargeables — perdre un consommable aléatoire", effect:{ type:"lose-random-item", itemType:"consumable" } },
      {
        id:"protect-nothing",
        label:"Ne rien protéger — désactiver un rechargeable pendant deux rencontres",
        effect:{
          type:"disable-random-item-with-deferred-reward",
          itemType:"rechargeable",
          disableEncounters:2,
          rewardAfterEncounters:2,
          gold:35,
          rewardId:"total-lockdown-compensation",
          source:"total-lockdown"
        }
      }
    ]
  }
]);

export function getEventById(eventId){return EVENTS.find((event)=>event.id===eventId)??null;}
export function getEventsByCategory(category){return EVENTS.filter((event)=>event.category===category);}