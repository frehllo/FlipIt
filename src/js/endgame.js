import * as Playroom from "playroomkit";
import { el, on } from "./dom.js";
import { getPlayers, ensureDefaults } from "./state.js";
import { escapeHtml } from "./util.js";
import { nf } from "./i18n.js";

export function installEndgameRpcs(hostNewGame){
  const endgameModal = el("endgame-modal");
  const closeEndgame = () => endgameModal && (endgameModal.style.display = "none");
  if (el("endgame-close")) el("endgame-close").onclick = closeEndgame;
  if (endgameModal) on(endgameModal, "click", (e) => e.target === endgameModal && closeEndgame);

  Playroom.RPC.register("rpcOpenEndgame", () => {
    renderEndgameRanking();
    if (endgameModal) endgameModal.style.display = "grid";
    const hostActions = el("endgame-host-actions");
    if (hostActions) hostActions.style.display = Playroom.isHost ? "block" : "none";
  });

  if (el("endgame-newgame")) el("endgame-newgame").onclick = () => {
    if (!Playroom.isHost) return;
    hostNewGame();
    if (endgameModal) endgameModal.style.display = "none";
  };
}

export function renderEndgameRanking(){
  const root = el("endgame-ranking");
  if (!root) return;
  const ps = getPlayers();
  ps.forEach(ensureDefaults);
  const winnerId = Playroom.getState("winnerId");

  const ranking = ps
    .map(p => ({ id:p.id, name:p.getProfile().name, score:p.getState("puntiTotali") || 0 }))
    .sort((a,b) => b.score - a.score);

  root.innerHTML = "";
  ranking.forEach((r,i) => {
    const row = document.createElement("div");
    row.className = `endgame-row ${r.id === winnerId ? "endgame-winner" : ""}`;
    row.innerHTML = `
      <div class="endgame-left">
        <div class="endgame-pos">${i+1}</div>
        <div class="endgame-name">${escapeHtml(r.name)}</div>
      </div>
      <div class="endgame-score">${escapeHtml(nf.formatNumber(r.score))}</div>
    `;
    root.appendChild(row);
  });
}
