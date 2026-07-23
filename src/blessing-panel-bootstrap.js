"use strict";

import { getBlessingById } from "./data/blessings.js";
import { getGameRuntime } from "./game/runtime-access.js";

function render(){const runtime=getGameRuntime();const section=document.querySelector(".modifier-section");if(!section||!runtime.gameState)return;let panel=document.getElementById("active-blessing-panel");if(!panel){panel=document.createElement("article");panel.id="active-blessing-panel";panel.className="active-blessing-panel";section.prepend(panel);}const blessing=getBlessingById(runtime.gameState.activeBlessingId);if(!blessing){panel.hidden=true;return;}panel.hidden=false;panel.replaceChildren();const label=document.createElement("small");label.textContent="Bénédiction active";const title=document.createElement("strong");title.textContent=blessing.name;const description=document.createElement("span");description.textContent=blessing.description;panel.append(label,title,description);}
window.addEventListener("DOMContentLoaded",render);window.addEventListener("chv1:blessing-changed",render);
