"use strict";

import { getGameRuntime } from "../game/runtime-access.js";

export class CampfireView {
  constructor({screen,message,mainChoices,upgradeList,restButton,upgradeButton,onRest,onUpgradeSelected}){
    Object.assign(this,{screen,message,mainChoices,upgradeList,onRest,onUpgradeSelected});
    this.context={firstArchive:true,hasExperiencedCamper:false,previewExperiencedResult:false};
    restButton.addEventListener("click",()=>this.onRest());
    upgradeButton.addEventListener("click",()=>this.showUpgradeChoices());
  }
  setCampfireContext(context={}){this.context={...this.context,...context};}
  ensureExtraChoices(){
    this.mainChoices.querySelectorAll("[data-campfire-extra]").forEach((element)=>element.remove());
    const narrative=document.createElement("button");narrative.type="button";narrative.dataset.campfireExtra="archive";narrative.className="room-action-button";
    narrative.innerHTML=`<strong>${this.context.firstArchive?"Examiner le bruit sous le sol":"Explorer la pièce cachée"}</strong><span>Renoncer au repos et à l’amélioration pour découvrir une archive clandestine.</span>`;
    narrative.addEventListener("click",()=>getGameRuntime().roomController?.exploreHiddenRoom());
    this.mainChoices.append(narrative);
    if(this.context.hasExperiencedCamper){
      const camper=document.createElement("button");camper.type="button";camper.dataset.campfireExtra="camper";camper.className="room-action-button";
      const description=this.context.previewExperiencedResult?"Recharge précisément un objet rechargeable indisponible ; sinon donne 20 or.":"Exploiter le campement pour obtenir un avantage mécanique supplémentaire.";
      camper.innerHTML=`<strong>Installer un camp efficace</strong><span>${description}</span>`;
      camper.addEventListener("click",()=>getGameRuntime().roomController?.useExperiencedCamper());
      this.mainChoices.append(camper);
    }
  }
  show(){for(const screen of document.querySelectorAll(".game-screen"))screen.hidden=true;this.screen.hidden=false;this.mainChoices.hidden=false;this.upgradeList.hidden=true;this.message.textContent="Choisis une seule action.";this.ensureExtraChoices();}
  hide(){this.screen.hidden=true;}
  setUpgradeableItems(items){this.upgradeableItems=items;}
  showUpgradeChoices(){const items=this.upgradeableItems??[];this.mainChoices.hidden=true;this.upgradeList.hidden=false;this.upgradeList.replaceChildren();if(items.length===0){const empty=document.createElement("p");empty.className="room-empty-message";empty.textContent="Aucun objet améliorable.";const backButton=document.createElement("button");backButton.type="button";backButton.textContent="Retour";backButton.addEventListener("click",()=>this.show());this.upgradeList.append(empty,backButton);return;}for(const item of items){const card=document.createElement("article");card.className="room-item-card";const title=document.createElement("h3");title.textContent=`${item.name} +`;const description=document.createElement("p");description.textContent=item.upgrade.description;const button=document.createElement("button");button.type="button";button.textContent="Améliorer";button.addEventListener("click",()=>this.onUpgradeSelected(item.id));card.append(title,description,button);this.upgradeList.append(card);}}
  showArchive(archive,{alreadyExplored=false,onContinue=()=>{}}={}){
    this.mainChoices.hidden=true;
    this.upgradeList.hidden=false;
    this.upgradeList.replaceChildren();
    const card=document.createElement("article");card.className="room-item-card archive-card";
    const title=document.createElement("h3");title.textContent=archive?.title??"Archive clandestine";
    const author=document.createElement("p");author.className="archive-author";author.textContent=archive?.author??"Auteur inconnu";
    const text=document.createElement("p");text.textContent=alreadyExplored?"Tu reconnais cette pièce. Aucun nouveau message n’a été laissé.":archive?.text??"Le message est illisible.";
    const button=document.createElement("button");button.type="button";button.textContent="Quitter la pièce";button.addEventListener("click",onContinue);
    card.append(title,author,text,button);
    this.upgradeList.append(card);
    this.message.textContent=alreadyExplored?"Cette archive était déjà connue.":"Nouvelle archive ajoutée aux souvenirs du cobaye 426.";
  }
}
