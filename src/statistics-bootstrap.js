"use strict";

const byId = (id) => document.getElementById(id);
const percent = (value) => `${Math.round((Number(value) || 0) * 100)} %`;
const duration = (seconds) => {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  return `${hours} h ${String(minutes).padStart(2, "0")} min`;
};

function renderList(targetId, entries, formatter) {
  const target = byId(targetId);
  if (!target) return;
  if (!entries?.length) { target.innerHTML = '<p class="statistics-empty">Aucune donnée.</p>'; return; }
  target.replaceChildren(...entries.map((entry, index) => {
    const row = document.createElement("article");
    row.className = "statistics-row";
    const rank = document.createElement("strong"); rank.textContent = String(index + 1);
    const name = document.createElement("span"); name.textContent = entry.id;
    const value = document.createElement("em"); value.textContent = formatter(entry);
    row.append(rank, name, value);
    return row;
  }));
}

async function render() {
  if (!globalThis.chv1VideoStats?.get) return;
  const stats = await globalThis.chv1VideoStats.get();
  const global = stats.global || {};
  const summary = byId("statistics-summary");
  summary?.replaceChildren(...[
    ["Vidéos lancées", global.totalStarted || 0],
    ["Victoires", global.totalWins || 0],
    ["Défaites", global.totalLosses || 0],
    ["Winrate global", percent((global.totalWins || 0) / Math.max(1, (global.totalWins || 0) + (global.totalLosses || 0)))],
    ["Objets utilisés", global.totalItemsUsed || 0],
    ["Temps cumulé", duration(global.totalWatchSeconds)]
  ].map(([label, value]) => {
    const card = document.createElement("article");
    card.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
    return card;
  }));
  renderList("statistics-most-viewed", stats.mostViewed, (entry) => `${entry.started} lecture${entry.started > 1 ? "s" : ""}`);
  renderList("statistics-best-winrate", stats.bestWinrate, (entry) => `${percent(entry.winrate)} · ${entry.completed} tentative${entry.completed > 1 ? "s" : ""}`);
  renderList("statistics-worst-winrate", stats.worstWinrate, (entry) => `${percent(entry.winrate)} · ${entry.completed} tentative${entry.completed > 1 ? "s" : ""}`);
  renderList("statistics-most-items", stats.mostItemsUsed, (entry) => `${entry.itemsUsed} objet${entry.itemsUsed > 1 ? "s" : ""}`);
}

function showStatistics() {
  document.querySelectorAll(".game-screen").forEach((screen) => { screen.hidden = screen.id !== "statistics-screen"; });
  document.querySelectorAll(".navigation-tab").forEach((tab) => tab.classList.remove("is-active"));
  byId("statistics-navigation-tab")?.classList.add("is-active");
  const defeat = byId("declare-defeat-button"); if (defeat) defeat.hidden = true;
  void render();
}

window.addEventListener("DOMContentLoaded", () => byId("statistics-navigation-tab")?.addEventListener("click", showStatistics));
window.addEventListener("chv1:stats-updated", () => { if (!byId("statistics-screen")?.hidden) void render(); });
