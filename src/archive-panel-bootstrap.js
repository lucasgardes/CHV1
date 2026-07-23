"use strict";

import { LocalSaveService } from "./game/local-save.js";
import { getArchiveById } from "./data/archives.js";

function createPanel(){
  const sidebar=document.querySelector("#map-screen .detail-sidebar");
  if(!sidebar||document.getElementById("archive-panel"))return;
  const section=document.createElement("section");section.id="archive-panel";section.className="archive-panel";
  const title=document.createElement("h3");title.textContent="Archives clandestines";
  const summary=document.createElement("p");summary.className="archive-summary";
  const list=document.createElement("div");list.className="archive-list";
  section.append(title,summary,list);sidebar.append(section);
  const render=()=>{
    const meta=new LocalSaveService().load();const entries=meta.discoveredArchives.map(getArchiveById).filter(Boolean);
    summary.textContent=entries.length?`${entries.length} souvenir${entries.length>1?"s":""} conservé${entries.length>1?"s":""}.`:"Aucune archive découverte.";
    list.replaceChildren();
    for(const entry of entries){const details=document.createElement("details");const heading=document.createElement("summary");heading.textContent=entry.title;const text=document.createElement("p");text.textContent=entry.text;details.append(heading,text);list.append(details);}
  };
  render();
  const campfire=document.getElementById("campfire-screen");if(campfire)new MutationObserver(render).observe(campfire,{attributes:true,attributeFilter:["hidden"]});
  const phase=document.getElementById("phase-one-screen");if(phase)new MutationObserver(render).observe(phase,{attributes:true,attributeFilter:["hidden"]});
}
window.addEventListener("DOMContentLoaded",createPanel);
