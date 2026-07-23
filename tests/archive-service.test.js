"use strict";

import test from "node:test";
import assert from "node:assert/strict";
import { ArchiveService, SECRET_ARCHIVE_UNLOCK } from "../src/game/archive-service.js";
import { LocalSaveService } from "../src/game/local-save.js";

function createStorage(){const data=new Map();return{getItem:(key)=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:(key)=>data.delete(key)};}
function createState(){return{campfireNarrativeNodeIds:[],campfiresEncountered:0};}

test("une archive reste découverte après une nouvelle instance",()=>{
  const storage=createStorage();const saveService=new LocalSaveService({storage});const state=createState();state.campfiresEncountered=1;
  const first=new ArchiveService({gameState:state,saveService});const result=first.discoverCurrentCampfire("camp-1");
  assert.equal(result.archive.id,"archive-001");
  const second=new ArchiveService({gameState:createState(),saveService});
  assert.deepEqual(second.getMeta().discoveredArchives,["archive-001"]);
  assert.equal(second.getNextArchive().id,"archive-002");
});

test("la récompense secrète exige au moins deux feux tous explorés",()=>{
  const storage=createStorage();const saveService=new LocalSaveService({storage});const state=createState();state.campfiresEncountered=2;state.campfireNarrativeNodeIds=["camp-1","camp-2"];
  const service=new ArchiveService({gameState:state,saveService});const result=service.unlockSecretAfterBoss();
  assert.equal(result.unlocked,true);
  assert.ok(result.meta.unlockedContent.includes(SECRET_ARCHIVE_UNLOCK));
});

test("un seul feu exploré ne débloque pas la récompense",()=>{
  const service=new ArchiveService({gameState:{campfiresEncountered:1,campfireNarrativeNodeIds:["camp-1"]},saveService:new LocalSaveService({storage:createStorage()})});
  assert.equal(service.unlockSecretAfterBoss().unlocked,false);
});
