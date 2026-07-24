"use strict";

import test from "node:test";
import assert from "node:assert/strict";
import {
  ArchiveService,
  SECRET_ARCHIVE_UNLOCK,
  getArchiveTierForRow
} from "../src/game/archive-service.js";
import { ARCHIVE_TIERS } from "../src/data/archives.js";
import { LocalSaveService } from "../src/game/local-save.js";

function createStorage(){const data=new Map();return{getItem:(key)=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:(key)=>data.delete(key)};}
function createState(){return{campfireNarrativeNodeIds:[],campfiresEncountered:0,currentLevel:1};}
function createNode(id,row){return{id,type:"campfire",row,level:1,totalRows:13};}

test("les rangées sélectionnent la bonne catégorie d’archive",()=>{
  assert.equal(getArchiveTierForRow(0),ARCHIVE_TIERS.EARLY);
  assert.equal(getArchiveTierForRow(3),ARCHIVE_TIERS.EARLY);
  assert.equal(getArchiveTierForRow(4),ARCHIVE_TIERS.MIDDLE);
  assert.equal(getArchiveTierForRow(7),ARCHIVE_TIERS.MIDDLE);
  assert.equal(getArchiveTierForRow(8),ARCHIVE_TIERS.LATE);
  assert.equal(getArchiveTierForRow(11),ARCHIVE_TIERS.LATE);
});

test("une archive du premier tiers reste découverte après une nouvelle instance",()=>{
  const storage=createStorage();
  const saveService=new LocalSaveService({storage});
  const state=createState();
  state.campfiresEncountered=1;
  const first=new ArchiveService({gameState:state,saveService,random:()=>0});
  const result=first.discoverCurrentCampfire(createNode("camp-1",2));
  assert.equal(result.archive.tier,ARCHIVE_TIERS.EARLY);
  assert.equal(result.archive.id,"level-1-early-001");
  const second=new ArchiveService({gameState:createState(),saveService,random:()=>0});
  assert.deepEqual(second.getMeta().discoveredArchives,["level-1-early-001"]);
  assert.equal(second.getNextArchive({level:1,row:2,totalRows:13}).id,"level-1-early-002");
});

test("une note jamais découverte est prioritaire dans sa catégorie",()=>{
  const storage=createStorage();
  const saveService=new LocalSaveService({storage});
  saveService.update((meta)=>({...meta,discoveredArchives:["level-1-middle-001"]}));
  const service=new ArchiveService({gameState:createState(),saveService,random:()=>0});
  const next=service.getNextArchive({level:1,row:5,totalRows:13});
  assert.equal(next.tier,ARCHIVE_TIERS.MIDDLE);
  assert.equal(next.id,"level-1-middle-002");
});

test("une archive tardive ne peut pas apparaître dans le premier tiers",()=>{
  const service=new ArchiveService({gameState:createState(),saveService:new LocalSaveService({storage:createStorage()}),random:()=>0.99});
  const result=service.discoverCurrentCampfire(createNode("camp-early",1));
  assert.equal(result.archive.tier,ARCHIVE_TIERS.EARLY);
  assert.match(result.archive.id,/^level-1-early-/);
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
