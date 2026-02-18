import * as Playroom from "playroomkit";
import { el } from "./dom.js";
import { t, nf, actionLabel } from "./i18n.js";
import {
  ensureDefaults,
  getPlayers,
  currentTurnPlayer,
  me,
  getPendingTarget,
  getFlip3Ctx,
  isEligible
} from "./state.js";
import { pointsFromCards, cardLabel } from "./deck.js";
import { escapeHtml } from "./util.js";

export function computeInPlayCount() {
  let n = 0;
  getPlayers().forEach(p => {
    n += (p.getState("mioTavolo") || []).length;
    n += (p.getState("pendingActions") || []).length;
  });
  return n;
}

export function pendingText() {
  const f = getFlip3Ctx();
  if (f?.paused) return t("hud.pendingFlip3Pause");

  const pt = getPendingTarget();
  if (!pt) return null;
  const by = getPlayers().find(p => p.id === pt.by) || null;
  const left = Math.max(0, Math.ceil(((pt.until || 0) - Date.now()) / 1000));
  return t("hud.pendingChoice", { player: by ? (by.getProfile().name || "PLAYER").split(" ")[0].toUpperCase() : "???", tipo: actionLabel(pt.tipo), s: left });
}

export function renderGlobalRank() {
  const root = el("global-rank");
  if (!root) return;

  const ps = getPlayers();
  ps.forEach(ensureDefaults);

  const cur = currentTurnPlayer();
  root.innerHTML = "";

  ps.forEach(p => {
    const score = p.getState("puntiTotali") || 0;
    const stato = p.getState("statoRound") || "IN GIOCO";
    const tavolo = p.getState("mioTavolo") || [];

    const dotClass =
      stato === "IN GIOCO" ? "dot-green" :
      (stato === "STAY" || stato === "FLIP7WIN") ? "dot-blue" : "dot-red";

    const item = document.createElement("div");
    item.className = `rank-item ${(cur && cur.id === p.id) ? "rank-active" : ""}`;
    item.innerHTML = `
      <div class="rank-top">
        <div class="rank-name">${escapeHtml((p.getProfile().name || "PLAYER").toUpperCase())}</div>
        <div class="rank-score">${escapeHtml(nf.formatNumber(score))}</div>
      </div>
      <div class="badge">
        <span class="dot ${dotClass}"></span>
        <span>${escapeHtml(stato)}</span>
        <span style="margin-left:auto">${p.getState("matchRoundDone") ? "✓" : ""}</span>
      </div>
    `;

    const minis = document.createElement("div");
    minis.className = "mini-cards";

    const now = Date.now();
    const dupValue = p.getState("dupValue");
    const dupActive = now < (p.getState("dupFxUntil") || 0);

    tavolo.slice(-10).forEach(c => {
      const isDup = dupActive && c.type === "number" && dupValue != null && c.value === dupValue;
      const m = document.createElement("div");
      m.className = `mini ${c.type !== "number" ? "special" : ""} ${isDup ? "dup-hit flash-strong" : ""}`;
      m.innerText = cardLabel(c);
      minis.appendChild(m);
    });

    item.appendChild(minis);
    root.appendChild(item);
  });
}

export function renderMyTable() {
  const mp = me();
  ensureDefaults(mp);

  const display = el("card-display");
  if (!display) return;

  const now = Date.now();
  const dupValue = mp.getState("dupValue");
  const dupActive = now < (mp.getState("dupFxUntil") || 0);

  const cards = mp.getState("mioTavolo") || [];
  const prevCount = Number(display.getAttribute("data-prev-count") || "0");
  display.setAttribute("data-prev-count", String(cards.length));

  display.innerHTML = "";

  cards.forEach((c, idx) => {
    const isDup = dupActive && c.type === "number" && dupValue != null && c.value === dupValue;
    const d = document.createElement("div");
    const isSpecial = c.type !== "number";
    d.className = `card ${isSpecial ? "special" : ""} ${isDup ? "dup-hit" : ""} ${(idx >= prevCount) ? "deal" : ""}`;
    d.innerText = cardLabel(c);
    display.appendChild(d);

    if (isDup) {
      d.classList.add("shake");
      setTimeout(() => d.classList.remove("shake"), 900);
    }
  });

  if (mp.getState("hasSecondChance")) {
    const shield = document.createElement("div");
    shield.className = "card shield";
    shield.innerText = "🛡️";
    display.appendChild(shield);
  }
}

export function renderHud(hostLocks) {
  const mp = me();
  ensureDefaults(mp);

  const cur = currentTurnPlayer();
  const myTurn = !!cur && cur.id === mp.id && isEligible(mp);

  const myScoreEl = el("my-score");
  if (myScoreEl) myScoreEl.innerText = nf.formatNumber(mp.getState("puntiTotali") || 0);

  const roundScoreEl = el("round-score");
  if (roundScoreEl) roundScoreEl.innerText = nf.formatNumber(pointsFromCards(mp.getState("mioTavolo") || []));

  const mr = el("match-round");
  if (mr) mr.innerText = nf.formatNumber(Playroom.getState("matchRoundIndex") || 1);

  const mt = el("match-target");
  if (mt) mt.innerText = nf.formatNumber(Playroom.getState("matchTarget") || 200);

  const drawPile = Playroom.getState("drawPile") || [];
  const discardPile = Playroom.getState("discardPile") || [];
  const deckInfo = el("deck-info");
  if (deckInfo) {
    deckInfo.innerText = t("hud.deck", {
      draw: nf.formatNumber(drawPile.length),
      discard: nf.formatNumber(discardPile.length),
      inPlay: nf.formatNumber(computeInPlayCount())
    });
  }

  const sc = el("sc-indicator");
  if (sc) sc.style.display = mp.getState("hasSecondChance") ? "inline-flex" : "none";

  const lockLine = pendingText();
  const lockBanner = el("lock-banner");
  if (lockBanner) {
    lockBanner.style.display = lockLine ? "block" : "none";
    if (lockLine) lockBanner.innerText = lockLine;
  }

  const flip3 = getFlip3Ctx();
  const lock = !!getPendingTarget() || hostLocks.actionLocked || hostLocks.transitionLocked || !!flip3;

  const tip = el("turn-tip");
  if (tip) {
    if (flip3) tip.innerText = flip3.paused ? t("hud.tipFlip3Pause") : t("hud.tipFlip3", { n: flip3.remaining || 0 });
    else if (lock) tip.innerText = t("hud.tipLock");
    else tip.innerText = myTurn ? t("hud.tipAction") : t("hud.tipWait");
  }

  const status = el("status-bar");
  if (status) {
    if (Playroom.getState("partitaFinita")) status.innerText = t("hud.statusGameOver");
    else if (flip3) {
      const tp = getPlayers().find(p => p.id === flip3.targetId) || null;
      const pname = tp ? (tp.getProfile().name || "PLAYER").split(" ")[0] : "??";
      status.innerText = flip3.paused ? t("hud.statusFlip3Pause", { player: pname }) : t("hud.statusFlip3Run", { player: pname, n: flip3.remaining || 0 });
    } else if (lockLine) status.innerText = t("hud.statusWaitChoice");
    else if (myTurn) status.innerText = t("hud.statusYourTurn");
    else status.innerText = t("hud.statusTurnOf", { player: cur ? (cur.getProfile().name || "PLAYER").split(" ")[0] : "??" });
  }

  const btnDraw = el("btn-pesca");
  const btnStop = el("btn-stop");
  const roundEnded = !!Playroom.getState("roundEndedByFlip7");

  if (btnDraw) btnDraw.disabled =
    !!Playroom.getState("partitaFinita") ||
    roundEnded ||
    !!getPendingTarget() ||
    hostLocks.actionLocked ||
    hostLocks.transitionLocked ||
    !!flip3 ||
    !myTurn ||
    !!mp.getState("flip3Lock");

  if (btnStop) btnStop.disabled =
    !!Playroom.getState("partitaFinita") ||
    roundEnded ||
    !!getPendingTarget() ||
    hostLocks.actionLocked ||
    hostLocks.transitionLocked ||
    !!flip3 ||
    !myTurn ||
    !!mp.getState("flip3Lock") ||
    (mp.getState("mioTavolo") || []).length === 0;
}
