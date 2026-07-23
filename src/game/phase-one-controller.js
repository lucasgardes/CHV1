"use strict";

import { GAME_STATUS } from "./game-state.js";
import { ArchiveService } from "./archive-service.js";

export const ENDINGS = Object.freeze({ BAD:"subject-perfect", GOOD:"escape" });

export class PhaseOneController {
  constructor({gameState,mapController,itemController,defeatController,saveService,stopEncounter=async()=>{},onTransition=()=>{}}){Object.assign(this,{gameState,mapController,itemController,defeatController,saveService,stopEncounter,onTransition});this.archiveService=new ArchiveService({gameState,saveService});}
  getMeta(){return this.saveService.load();}
  startRun(){const startNodeId=this.mapController.getMap().startNodeId;this.gameState.startRun(startNodeId);this.itemController.resetForRun();this.onTransition({type:"run-started",loopCount:this.getMeta().loopCount,startNodeId});return{startNodeId,loopCount:this.getMeta().loopCount};}
  async processDefeat(){await this.stopEncounter();const result=this.defeatController.processDefeat();if(result.protected){this.onTransition({type:"defeat-prevented",...result});return result;}const meta=this.saveService.update((current)=>({...current,defeats:current.defeats+1,loopCount:current.loopCount+1}));this.gameState.setStatus(GAME_STATUS.GAME_OVER);this.onTransition({type:"white-space",loopCount:meta.loopCount,message:"Ce n’est pas fini. Tu ne peux pas abandonner."});return{...result,loopCount:meta.loopCount,restartRun:true};}
  restartAfterLoop(){return this.startRun();}
  completeBoss(){
    const hasEscapeKey=this.gameState.hasItem("last-act-key")||this.gameState.hasItem("escape-prototype");
    const ending=hasEscapeKey?ENDINGS.GOOD:ENDINGS.BAD;
    let meta=this.saveService.update((current)=>({...current,victories:current.victories+1,lastEnding:ending,endingsSeen:[...new Set([...current.endingsSeen,ending])],unlockedContent:ending===ENDINGS.GOOD?[...new Set([...current.unlockedContent,"true-ending","archives-menu"])]:current.unlockedContent}));
    const archiveReward=this.archiveService.unlockSecretAfterBoss();
    if(archiveReward.unlocked)meta=archiveReward.meta;
    this.gameState.completeCurrentNode();this.gameState.setCurrentEncounter(null);this.gameState.setStatus(GAME_STATUS.VICTORY);
    this.onTransition({type:"ending",ending,meta,archiveReward});
    return{ending,meta,archiveReward};
  }
  revealHiddenEncounter(){const map=this.mapController.getMap();const hiddenNode=map.nodes?.find((node)=>node.type==="hidden")??null;if(!hiddenNode)return null;const unlocked=this.gameState.hasItem("last-act-key")||this.gameState.hasItem("scout");return unlocked?hiddenNode:null;}
}
