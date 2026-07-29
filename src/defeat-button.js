"use strict";

import { getGameRuntime } from "./game/runtime-access.js";
import { DefeatController } from "./game/defeat-controller.js";
import { RunController } from "./game/run-controller.js";

const button = document.getElementById("declare-defeat-button");

function ensureRunController() {
  const runtime = getGameRuntime();
  if (runtime.runController) return runtime.runController;
  if (!runtime.gameState || !runtime.mapController || !runtime.itemController || !runtime.screenController) throw new Error("La partie n’est pas encore initialisée.");
  const video = document.getElementById("round-video");
  const status = document.getElementById("video-status");
  return new RunController({
    ...runtime,
    video: video instanceof HTMLVideoElement ? video : null,
    async stopEncounter() {
      const emergencyStop = document.getElementById("emergency-stop-button");
      if (emergencyStop instanceof HTMLButtonElement && !emergencyStop.disabled) emergencyStop.click();
      if (video instanceof HTMLVideoElement) video.pause();
      await new Promise((resolve) => window.setTimeout(resolve, 150));
    },
    onStatusChange(message) { if (status) status.textContent = message; }
  });
}

function ensureDialogStyles() {
  if (document.querySelector('link[data-defeat-dialog-styles="true"]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "./item-choice-dialog.css";
  link.dataset.defeatDialogStyles = "true";
  document.head.append(link);
}

function ensureProtectionAnimationStyles() {
  if (document.querySelector('style[data-protection-animation="true"]')) return;
  const style = document.createElement("style");
  style.dataset.protectionAnimation = "true";
  style.textContent = `
    .protection-trigger{position:fixed;inset:0;z-index:1400;display:grid;place-items:center;overflow:hidden;pointer-events:none;animation:protection-fade 1.65s ease both}
    .protection-trigger::before,.protection-trigger::after{content:"";position:absolute;inset:50%;width:18vmin;height:18vmin;border:2px solid currentColor;border-radius:50%;transform:translate(-50%,-50%);animation:protection-ring 1.4s ease-out both}
    .protection-trigger::after{animation-delay:.16s}
    .protection-trigger--delayed{color:rgba(148,218,255,.82);background:radial-gradient(circle at center,rgba(92,184,255,.22),rgba(7,10,19,.9) 62%)}
    .protection-trigger--second-chance{color:rgba(255,213,115,.9);background:radial-gradient(circle at center,rgba(255,171,60,.25),rgba(24,10,7,.92) 64%)}
    .protection-trigger--second-chance::before,.protection-trigger--second-chance::after{border-radius:14%;transform:translate(-50%,-50%) rotate(45deg);animation-name:second-chance-ring}
    .protection-trigger__card{position:relative;display:grid;justify-items:center;gap:12px;padding:30px 42px;border:1px solid currentColor;border-radius:20px;background:rgba(12,20,34,.9);box-shadow:0 0 70px color-mix(in srgb,currentColor 42%,transparent),inset 0 0 28px color-mix(in srgb,currentColor 12%,transparent);color:#fff;text-align:center;animation:protection-card .72s cubic-bezier(.2,.9,.2,1) both}
    .protection-trigger--second-chance .protection-trigger__card{border-radius:8px;background:linear-gradient(145deg,rgba(50,26,13,.94),rgba(20,13,12,.94));animation-name:second-chance-card}
    .protection-trigger__icon{display:grid;place-items:center;width:76px;height:76px;border:2px solid currentColor;border-radius:24px;background:color-mix(in srgb,currentColor 20%,transparent);font-size:38px;filter:drop-shadow(0 0 18px currentColor);animation:protection-pulse .8s ease-in-out infinite alternate}
    .protection-trigger--second-chance .protection-trigger__icon{border-radius:50%;animation:second-chance-spin .9s cubic-bezier(.2,.8,.2,1) both}
    .protection-trigger__eyebrow{margin:0;color:currentColor;font-size:12px;font-weight:800;letter-spacing:.18em;text-transform:uppercase}
    .protection-trigger__title{margin:0;font-size:clamp(24px,4vw,44px);letter-spacing:.04em;text-transform:uppercase}
    .protection-trigger__message{margin:0;color:#edf4ff;font-size:15px}
    @keyframes protection-card{0%{opacity:0;transform:scale(.72) translateY(24px);filter:blur(8px)}65%{opacity:1;transform:scale(1.04) translateY(0);filter:blur(0)}100%{opacity:1;transform:scale(1)}}
    @keyframes second-chance-card{0%{opacity:0;transform:translateX(-70px) rotate(-4deg);filter:blur(7px)}60%{opacity:1;transform:translateX(8px) rotate(1deg);filter:blur(0)}100%{opacity:1;transform:translateX(0) rotate(0)}}
    @keyframes protection-ring{0%{opacity:.9;transform:translate(-50%,-50%) scale(.35)}100%{opacity:0;transform:translate(-50%,-50%) scale(5.2)}}
    @keyframes second-chance-ring{0%{opacity:.95;transform:translate(-50%,-50%) rotate(45deg) scale(.3)}100%{opacity:0;transform:translate(-50%,-50%) rotate(225deg) scale(5)}}
    @keyframes protection-pulse{from{transform:scale(.96)}to{transform:scale(1.05)}}
    @keyframes second-chance-spin{0%{transform:rotate(-180deg) scale(.4);opacity:0}70%{transform:rotate(12deg) scale(1.1);opacity:1}100%{transform:rotate(0) scale(1)}}
    @keyframes protection-fade{0%,72%{opacity:1}100%{opacity:0}}
    @media (prefers-reduced-motion:reduce){.protection-trigger,.protection-trigger::before,.protection-trigger::after,.protection-trigger__card,.protection-trigger__icon{animation:none}.protection-trigger{opacity:1}}
  `;
  document.head.append(style);
}

function playProtectionAnimation(protectionId) {
  const variants = {
    "delayed-protection": {
      className:"protection-trigger--delayed",
      icon:"⬡",
      eyebrow:"Protocole de secours",
      title:"Protection différée",
      message:"Défaite annulée — le round est sécurisé."
    },
    "second-chance": {
      className:"protection-trigger--second-chance",
      icon:"↻",
      eyebrow:"Intervention d’urgence",
      title:"Deuxième chance",
      message:"La défaite est effacée — la run continue."
    }
  };
  const variant = variants[protectionId];
  if (!variant) return Promise.resolve();

  ensureProtectionAnimationStyles();
  document.querySelector(".protection-trigger")?.remove();
  const overlay = document.createElement("div");
  overlay.className = `protection-trigger ${variant.className}`;
  overlay.setAttribute("role", "status");
  overlay.setAttribute("aria-live", "assertive");
  overlay.innerHTML = `
    <section class="protection-trigger__card">
      <span class="protection-trigger__icon" aria-hidden="true">${variant.icon}</span>
      <p class="protection-trigger__eyebrow">${variant.eyebrow}</p>
      <h2 class="protection-trigger__title">${variant.title}</h2>
      <p class="protection-trigger__message">${variant.message}</p>
    </section>
  `;
  document.body.append(overlay);
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
  return new Promise((resolve) => {
    window.setTimeout(() => {
      overlay.remove();
      resolve();
    }, reducedMotion ? 700 : 1700);
  });
}

function confirmDefeat() {
  ensureDialogStyles();
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "item-choice-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "defeat-dialog-title");

    const dialog = document.createElement("section");
    dialog.className = "item-choice-dialog defeat-confirmation-dialog";
    dialog.innerHTML = `
      <header class="item-choice-dialog__header">
        <span class="item-choice-dialog__icon" aria-hidden="true">!</span>
        <div>
          <p class="item-choice-dialog__eyebrow">Abandon du round</p>
          <h2 id="defeat-dialog-title">Confirmer la défaite ?</h2>
        </div>
      </header>
      <div class="item-choice-dialog__body">
        <p class="item-choice-dialog__message">La vidéo et le funscript seront immédiatement arrêtés.</p>
        <p class="item-choice-dialog__details">Une protection disponible sera consommée et le round sera alors considéré comme réussi. Sans protection, la boucle temporelle recommencera.</p>
      </div>
      <div class="item-choice-dialog__actions">
        <button class="item-choice-dialog__decline" type="button">Continuer le round</button>
        <button class="item-choice-dialog__activate" type="button">Confirmer la défaite</button>
      </div>
    `;

    const finish = (confirmed) => {
      document.removeEventListener("keydown", onKeyDown);
      overlay.remove();
      resolve(confirmed);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") finish(false);
      if (event.key === "Enter") finish(true);
    };

    dialog.querySelector(".item-choice-dialog__decline")?.addEventListener("click", () => finish(false));
    dialog.querySelector(".item-choice-dialog__activate")?.addEventListener("click", () => finish(true));
    overlay.addEventListener("click", (event) => { if (event.target === overlay) finish(false); });
    document.addEventListener("keydown", onKeyDown);
    overlay.append(dialog);
    document.body.append(overlay);
    dialog.querySelector(".item-choice-dialog__decline")?.focus();
  });
}

async function processDefeat() {
  if (globalThis.__CHV1_PHASE_ONE__?.processDefeat) return globalThis.__CHV1_PHASE_ONE__.processDefeat();
  const runController = ensureRunController();
  await runController.stopCurrentEncounter();
  const { gameState, mapController, itemController } = getGameRuntime();
  return new DefeatController({ gameState, mapController, itemController }).processDefeat();
}

async function applyProtectionResult(result, runtime) {
  const status = document.getElementById("video-status");
  if (result.action !== "complete-current-encounter") return;
  if (!runtime.encounterController) throw new Error("Le contrôleur de rencontre n’est pas disponible.");

  await playProtectionAnimation(result.protectionId);

  const completion = await runtime.encounterController.complete();
  if (!completion) throw new Error("La rencontre protégée n’a pas pu être terminée.");

  const statusMessages = {
    "delayed-protection":"Protection différée déclenchée : la défaite est annulée.",
    "second-chance":"Deuxième chance déclenchée : la défaite est annulée."
  };
  if (status) status.textContent = statusMessages[result.protectionId] ?? "Protection activée : le round est considéré comme réussi.";

  if (completion.type === "boss") {
    globalThis.__CHV1_PHASE_ONE__?.controller?.completeBoss();
  }
}

window.addEventListener("DOMContentLoaded", () => { try { ensureRunController(); } catch { /* renderer may still be initializing */ } });

if (button instanceof HTMLButtonElement) {
  button.addEventListener("click", async () => {
    if (button.disabled) return;
    const confirmed = await confirmDefeat();
    if (!confirmed) return;

    button.disabled = true;
    button.textContent = "Traitement...";
    try {
      const result = await processDefeat();
      const runtime = getGameRuntime();
      if (result.protected) {
        await applyProtectionResult(result, runtime);
        button.textContent = "Protection activée";
      } else {
        button.textContent = "Boucle relancée";
      }
      window.setTimeout(() => {
        button.disabled = false;
        button.textContent = "J’ai perdu";
      }, 900);
    } catch (error) {
      console.error("Impossible de traiter la défaite :", error);
      button.disabled = false;
      button.textContent = "J’ai perdu";
    }
  });
}
