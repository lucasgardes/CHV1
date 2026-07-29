"use strict";

import { getGameRuntime } from "../game/runtime-access.js";
import { getItemById } from "../data/items.js";
import { createItemVisual, getItemTypeLabel } from "./item-visual.js";

function ensureCampfireStylesheet() {
  if (document.querySelector('link[data-campfire-ui-styles="true"]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "./campfire-ui.css";
  link.dataset.campfireUiStyles = "true";
  document.head.append(link);
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function formatValue(key, value) {
  if (typeof value === "boolean") return value ? "Oui" : "Non";
  if (typeof value !== "number") return String(value);
  if (key.toLowerCase().includes("second") || key === "seconds") return `${value} s`;
  if (["intensityMultiplier", "penaltyMultiplier", "rewardMultiplier", "difficultyMultiplier"].includes(key)) return `×${value}`;
  if (key.toLowerCase().includes("chance") || key.toLowerCase().includes("bonus") || key.toLowerCase().includes("discount") || key === "step" || key === "max") {
    if (Math.abs(value) <= 1) return `${Math.round(value * 100)} %`;
  }
  return String(value);
}

function formatValueLabel(key) {
  const labels = {
    durationSeconds:"Durée", pauseSeconds:"Pause", seconds:"Durée retirée", intensityMultiplier:"Intensité",
    penaltyMultiplier:"Pénalité", difficultyShift:"Difficulté supplémentaire", difficultyMultiplier:"Difficulté",
    rewardMultiplier:"Récompense", choices:"Choix proposés", rounds:"Rounds de recharge", rareBonus:"Chance rare",
    discountPerPurchase:"Réduction par achat", maxDiscount:"Réduction maximale", goldLossPerMove:"Or perdu par déplacement",
    step:"Progression du bonus", max:"Bonus maximal", showDetails:"Informations détaillées", revealCategory:"Catégorie révélée"
  };
  return labels[key] ?? key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
}

function rechargeText(recharge) {
  if (!recharge) return "—";
  if (recharge.type === "elite") return "Après un élite";
  if (recharge.type === "once-per-run") return "Une fois par partie";
  if (recharge.type === "none") return "Aucune recharge";
  if (recharge.type === "elite-or-encounters") return `Après un élite ou ${recharge.amount ?? 1} rounds`;
  return `${recharge.amount ?? 1} round${Number(recharge.amount) > 1 ? "s" : ""}`;
}

function getUpgradeChanges(item) {
  const beforeValues = item.values ?? {};
  const afterValues = { ...beforeValues, ...(item.upgrade?.values ?? {}) };
  const changes = [];
  for (const key of new Set([...Object.keys(beforeValues), ...Object.keys(afterValues)])) {
    if (beforeValues[key] === afterValues[key]) continue;
    changes.push({ label:formatValueLabel(key), before:formatValue(key, beforeValues[key]), after:formatValue(key, afterValues[key]) });
  }
  if (item.upgrade?.recharge && JSON.stringify(item.recharge) !== JSON.stringify(item.upgrade.recharge)) {
    changes.push({ label:"Recharge", before:rechargeText(item.recharge), after:rechargeText(item.upgrade.recharge) });
  }
  return changes;
}

class CampfireAmbience {
  constructor(){this.context=null;this.source=null;}
  get active(){return this.source!==null;}
  async start(){
    if(this.active)return;
    const AudioContextClass=window.AudioContext||window.webkitAudioContext;
    if(!AudioContextClass)return;
    this.context=new AudioContextClass();
    await this.context.resume();
    const buffer=this.context.createBuffer(1,this.context.sampleRate*3,this.context.sampleRate);
    const data=buffer.getChannelData(0);
    for(let index=0;index<data.length;index+=1){data[index]=(Math.random()*2-1)*.16+(Math.random()>.996?(Math.random()*2-1)*.75:0);}
    const source=this.context.createBufferSource();source.buffer=buffer;source.loop=true;
    const filter=this.context.createBiquadFilter();filter.type="lowpass";filter.frequency.value=1250;
    const gain=this.context.createGain();gain.gain.value=.025;
    source.connect(filter).connect(gain).connect(this.context.destination);source.start();this.source=source;
  }
  stop(){try{this.source?.stop();}catch{}this.source=null;this.context?.close?.();this.context=null;}
}

export class CampfireView {
  constructor({screen,message,mainChoices,upgradeList,restButton,upgradeButton,onRest,onUpgradeSelected}){
    ensureCampfireStylesheet();
    Object.assign(this,{screen,message,mainChoices,upgradeList,onRest,onUpgradeSelected,restButton,upgradeButton});
    this.context={firstArchive:true,hasExperiencedCamper:false,previewExperiencedResult:false};
    this.ambience=new CampfireAmbience();
    this.installScene();
    restButton.addEventListener("click",()=>this.onRest());
    upgradeButton.addEventListener("click",()=>this.showUpgradeChoices());
  }

  installScene(){
    const card=this.screen.querySelector(".modal-card");card?.classList.add("campfire-card");
    if(!card?.querySelector(".campfire-scene")){const scene=createElement("div","campfire-scene");scene.setAttribute("aria-hidden","true");scene.innerHTML='<span class="campfire-flame campfire-flame--left"></span><span class="campfire-flame campfire-flame--center"></span><span class="campfire-flame campfire-flame--right"></span><span class="campfire-embers"></span>';card.insertBefore(scene,card.firstChild);}
    if(!card?.querySelector(".campfire-ambience-toggle")){const toggle=createElement("button","campfire-ambience-toggle secondary-button","Activer l’ambiance sonore");toggle.type="button";toggle.addEventListener("click",async()=>{if(this.ambience.active){this.ambience.stop();toggle.textContent="Activer l’ambiance sonore";toggle.classList.remove("is-active");}else{await this.ambience.start();toggle.textContent="Couper l’ambiance sonore";toggle.classList.toggle("is-active",this.ambience.active);}});card.append(toggle);}
    this.restButton.classList.add("campfire-action","campfire-action--rest");
    this.upgradeButton.classList.add("campfire-action","campfire-action--upgrade");
  }

  setCampfireContext(context={}){this.context={...this.context,...context};}

  ensureExtraChoices(){
    this.mainChoices.querySelectorAll("[data-campfire-extra]").forEach((element)=>element.remove());
    const narrative=document.createElement("button");narrative.type="button";narrative.dataset.campfireExtra="archive";narrative.className="room-action-button campfire-action campfire-action--archive";narrative.innerHTML=`<span class="campfire-action__icon" aria-hidden="true">▤</span><strong>${this.context.firstArchive?"Examiner le bruit sous le sol":"Explorer la pièce cachée"}</strong><span>Renoncer au repos et à l’amélioration pour découvrir une archive clandestine.</span>`;narrative.addEventListener("click",()=>getGameRuntime().roomController?.exploreHiddenRoom());this.mainChoices.append(narrative);
    if(this.context.hasExperiencedCamper){const camper=document.createElement("button");camper.type="button";camper.dataset.campfireExtra="camper";camper.className="room-action-button campfire-action campfire-action--experienced";const description=this.context.previewExperiencedResult?"Recharge précisément un objet rechargeable indisponible ; sinon donne 20 or.":"Exploiter le campement pour obtenir un avantage mécanique supplémentaire.";camper.innerHTML=`<span class="campfire-action__icon" aria-hidden="true">⌂</span><strong>Installer un camp efficace</strong><span>${description}</span>`;camper.addEventListener("click",()=>getGameRuntime().roomController?.useExperiencedCamper());this.mainChoices.append(camper);}
  }

  renderRechargePreview(){
    this.mainChoices.querySelectorAll(".campfire-recharge-preview").forEach((element)=>element.remove());
    const runtime=getGameRuntime();
    const rechargeableIds=(runtime.gameState?.inventory??[]).filter((itemId)=>getItemById(itemId)?.type==="rechargeable");
    const panel=createElement("section","campfire-recharge-preview");panel.append(createElement("h3","campfire-section-title","Recharge au repos"));
    if(!rechargeableIds.length){panel.append(createElement("p","campfire-recharge-empty","Aucun objet rechargeable dans l’inventaire."));}
    else{const list=createElement("div","campfire-recharge-list");for(const itemId of rechargeableIds){const definition=getItemById(itemId)??{id:itemId,name:itemId,type:"rechargeable"};const state=runtime.itemController.getState(itemId);const card=createElement("article",`campfire-recharge-item${state.available?" is-ready":" is-depleted"}`);card.append(createItemVisual(definition,{compact:true}));const copy=createElement("div","campfire-recharge-item__copy");copy.append(createElement("strong","",definition.name),createElement("span","",state.available?"Déjà chargé":state.remainingRechargeRounds>0?`${state.remainingRechargeRounds} round(s) restant(s) → chargé`:"Indisponible → chargé"));card.append(copy,createElement("span","campfire-recharge-arrow",state.available?"✓":"→ 100 %"));list.append(card);}panel.append(list);}
    this.mainChoices.append(panel);
  }

  show(){for(const screen of document.querySelectorAll(".game-screen"))screen.hidden=true;this.screen.hidden=false;this.mainChoices.hidden=false;this.upgradeList.hidden=true;this.message.textContent=this.context.autoRecharged?"La grâce du repos a déjà rechargé tes objets. Choisis une seule action.":"Le protocole ralentit. Choisis une seule action.";this.ensureExtraChoices();this.renderRechargePreview();}
  hide(){this.screen.hidden=true;this.ambience.stop();}
  setUpgradeableItems(items){this.upgradeableItems=items;}

  showUpgradeChoices(){
    const items=this.upgradeableItems??[];this.mainChoices.hidden=true;this.upgradeList.hidden=false;this.upgradeList.replaceChildren();this.message.textContent="Compare les effets avant et après l’amélioration.";
    const header=createElement("header","campfire-upgrade-header");header.append(createElement("span","campfire-upgrade-header__icon","⌁"),createElement("div","","Une seule amélioration peut être effectuée."));this.upgradeList.append(header);
    if(items.length===0){const empty=createElement("p","room-empty-message","Aucun objet améliorable.");const back=createElement("button","secondary-button","Retour au feu");back.type="button";back.addEventListener("click",()=>this.show());this.upgradeList.append(empty,back);return;}
    const grid=createElement("div","campfire-upgrade-grid");
    for(const item of items){const card=createElement("article","campfire-upgrade-card");const heading=createElement("div","item-card-heading");heading.append(createItemVisual(item,{upgraded:false}));const copy=createElement("div","item-card-heading__copy");copy.append(createElement("h3","",item.name),createElement("p","room-item-type",getItemTypeLabel(item.type)));heading.append(copy);const comparison=createElement("div","campfire-upgrade-comparison");const changes=getUpgradeChanges(item);if(changes.length){for(const change of changes){const row=createElement("div","campfire-upgrade-change");row.append(createElement("span","campfire-upgrade-change__label",change.label),createElement("del","campfire-upgrade-change__before",change.before),createElement("span","campfire-upgrade-change__arrow","→"),createElement("strong","campfire-upgrade-change__after",change.after));comparison.append(row);}}else{comparison.append(createElement("p","campfire-upgrade-description campfire-upgrade-description--before",item.description),createElement("span","campfire-upgrade-change__arrow","↓"),createElement("p","campfire-upgrade-description campfire-upgrade-description--after",item.upgrade.description));}const result=createElement("div","campfire-upgrade-result");result.append(createItemVisual(item,{upgraded:true,compact:true}),createElement("span","",item.upgrade.description));const button=createElement("button","primary-button campfire-upgrade-button","Améliorer cet objet");button.type="button";button.addEventListener("click",()=>this.onUpgradeSelected(item.id));card.append(heading,comparison,result,button);grid.append(card);}
    const back=createElement("button","secondary-button campfire-back-button","Retour au feu");back.type="button";back.addEventListener("click",()=>this.show());this.upgradeList.append(grid,back);
  }

  showArchive(archive,{alreadyExplored=false,onContinue=()=>{}}={}){
    this.mainChoices.hidden=true;
    this.upgradeList.hidden=false;
    this.upgradeList.replaceChildren();

    const dossier=createElement("article",`campfire-archive-dossier${alreadyExplored?" is-corrupted":""}`);
    const folderHeader=createElement("header","campfire-dossier-header");
    const fileIdentity=createElement("div","campfire-dossier-identity");
    fileIdentity.append(createElement("span","campfire-dossier-stripes","///"),createElement("div","","DOSSIER CHV1-426\nARCHIVE CLANDESTINE"));
    const classification=createElement("div","campfire-dossier-classification","CLASSIFIÉ\nACCÈS NON AUTORISÉ");
    folderHeader.append(fileIdentity,classification);

    const paper=createElement("section","campfire-dossier-paper");
    const paperHeading=createElement("header","campfire-dossier-paper-heading");
    const headingCopy=createElement("div","");
    headingCopy.append(createElement("p","campfire-dossier-kicker",alreadyExplored?"ARCHIVE DÉJÀ MÉMORISÉE":"DOCUMENT RÉCUPÉRÉ"),createElement("h3","",archive?.title??"Archive clandestine"),createElement("p","campfire-dossier-author",archive?.author??"Auteur inconnu"));
    const stamp=createElement("div","campfire-dossier-stamp","CHV1\n426");
    paperHeading.append(headingCopy,stamp);

    const body=createElement("div","campfire-dossier-body");
    const text=createElement("p","campfire-dossier-text",alreadyExplored?"Tu reconnais cette pièce. Le document est toujours là, mais son contenu est déjà gravé dans tes souvenirs. Aucun nouveau message n’a été laissé.":archive?.text??"Le document est trop endommagé pour être lu.");
    const redaction=createElement("div","campfire-dossier-redaction","LE RESTE DU RAPPORT A ÉTÉ CAVIARDÉ.");
    body.append(text,redaction);

    const footer=createElement("footer","campfire-dossier-footer");
    footer.append(createElement("span","","SOURCE : PIÈCE TECHNIQUE NON SURVEILLÉE"),createElement("span","",`MÉMOIRE COBAYE 426 // ${alreadyExplored?"CONNUE":"NOUVELLE"}`));
    const button=createElement("button","campfire-dossier-close","Refermer le dossier et repartir");
    button.type="button";
    button.addEventListener("click",onContinue);

    paper.append(paperHeading,body,footer,button);
    dossier.append(folderHeader,paper);
    this.upgradeList.append(dossier);
    this.message.textContent=alreadyExplored?"Cette archive était déjà connue.":"Nouvelle archive ajoutée aux souvenirs du cobaye 426.";
  }
}
