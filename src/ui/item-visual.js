"use strict";

const ITEM_GLYPHS = Object.freeze({
  "emergency-button":"⏹", "detour-shoes":"↗", "shortcut-key":"🗝", "dubious-coupon":"🎟",
  "rigged-coin":"◉", "blank-contract":"▤", "mini-checkpoint":"⌁", "second-chance":"↻",
  "delayed-protection":"⬡", "shortcut":"»", "fragmentation":"✂", "reduced-difficulty":"⇩",
  "room-swap":"⇄", "spyglass":"⌕", "annotated-map":"⌖", "danger-detector":"⌁",
  "exit-ticket":"⇥", "controlled-breath":"≈", "time-out":"Ⅱ", "smoke-screen":"☁",
  "silencer":"∅", "mirror-mode":"◇", "cracked-stopwatch":"◴", "hourglass":"⌛",
  "escape-token":"⇱", "last-stand":"♜", "rhythm-analyzer":"⌁", "time-marker":"◷",
  "overheat-contract":"♨", "double-bet":"×2", "cursed-token":"☠", "loyalty-program":"％",
  "leaky-wallet":"¤", "lucky-coin":"✦", "metronome":"♩", "possessed-battery":"ϟ",
  "radio-silence":"⌁", "director-eye":"◉", "last-act-key":"✣", "broken-watch":"◴",
  "golden-hourglass":"⌛", "fast-path":"⇢", "elite-hunter":"◆", "shop-regular":"％",
  "loyal-customer":"★", "careful-explorer":"△", "experienced-camper":"♨", "privileged-stock":"▦",
  "scout":"⌖", "utility-belt":"▰", "recycler":"♻", "external-battery":"▥",
  "double-command":"Ⅱ", "clown-bet":"♣", "overconfidence":"▲"
});

const TYPE_LABELS = Object.freeze({
  consumable: "Consommable",
  rechargeable: "Rechargeable",
  passive: "Passif"
});

export function getItemGlyph(itemOrId) {
  const id = typeof itemOrId === "string" ? itemOrId : itemOrId?.id;
  return ITEM_GLYPHS[id] ?? (id?.slice(0, 1).toUpperCase() || "?");
}

export function getItemTypeLabel(type) {
  return TYPE_LABELS[type] ?? type ?? "Objet";
}

export function createItemVisual(item, { upgraded = false, compact = false } = {}) {
  const visual = document.createElement("span");
  visual.className = `item-visual item-visual--${item?.type ?? "unknown"}${compact ? " item-visual--compact" : ""}`;
  visual.dataset.itemId = item?.id ?? "unknown";
  visual.setAttribute("aria-hidden", "true");

  const glyph = document.createElement("span");
  glyph.className = "item-visual__glyph";
  glyph.textContent = getItemGlyph(item);
  visual.append(glyph);

  if (upgraded) {
    const badge = document.createElement("span");
    badge.className = "item-visual__upgrade";
    badge.textContent = "+";
    visual.append(badge);
  }

  return visual;
}
