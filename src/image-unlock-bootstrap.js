"use strict";

async function unlockFromEvent(event) {
  const detail = event?.detail || {};
  if (!globalThis.chv1Collection?.unlockImage || !detail.id) return;
  await globalThis.chv1Collection.unlockImage({ id:detail.id, origin:detail.origin || "Récompense", snapshot:detail.snapshot || null });
  window.dispatchEvent(new CustomEvent("chv1:collection-updated"));
}

window.addEventListener("chv1:image-unlocked", (event) => { void unlockFromEvent(event); });

globalThis.__CHV1_UNLOCK_IMAGE__ = (id, origin, snapshot) => unlockFromEvent({ detail:{ id, origin, snapshot } });
