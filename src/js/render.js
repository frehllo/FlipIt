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
  isEligible,
} from "./state.js";
import { pointsFromCards, cardLabel } from "./deck.js";
import { escapeHtml } from "./util.js";
import { fxIsBusy } from "./fx.js";
import { virtualize } from '@lit-labs/virtualizer/virtualize.js';

function stateKey(stato) {
  return String(stato || "IN GIOCO")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/[^A-Z0-9_]/g, "");
}

function roundStateLabel(stato) {
  const k = stateKey(stato);

  switch (k) {
    case "IN_GIOCO":
      return t("hud.state.inPlay");
    case "STAY":
      return t("hud.state.stay");
    case "SBALLATO":
      return t("hud.state.bust");
    case "FLIP7WIN":
      return t("hud.state.flip7win");
    default:
      return String(stato || "");
  }
}

export function computeInPlayCount() {
  let n = 0;
  getPlayers().forEach((p) => {
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

  const by = getPlayers().find((p) => p.id === pt.by) || null;
  const left = Math.max(0, Math.ceil(((pt.until || 0) - Date.now()) / 1000));
  return t("hud.pendingChoice", {
    player: by ? (by.getProfile().name || "PLAYER").split(" ")[0].toUpperCase() : "???",
    tipo: actionLabel(pt.tipo),
    s: left,
  });
}

export async function renderGlobalRank() {
  const root = el("global-rank");
  if (!root) return;

  const ps = getPlayers();
  ps.forEach(ensureDefaults);
  const cur = currentTurnPlayer();
  
  root.innerHTML = ""; 

  // Soglia mobile (puoi regolarla in base al tuo CSS)
  const isMobile = window.innerWidth <= 820;

  if (!isMobile) {
    // --- LOGICA DESKTOP: Renderizziamo tutti in fila ---
    ps.forEach((p, idx) => {
      renderPlayerRankItem(root, p, idx, cur);
    });
  } else {
    // --- LOGICA MOBILE: Solo il giocatore di turno (o io) + Tasto 📊 ---
    const mine = me();
    // Priorità: Giocatore di turno > Io > Primo della lista
    const focusPlayer = cur || mine || ps[0];
    
    if (focusPlayer) {
      const idx = ps.findIndex(p => p.id === focusPlayer.id);
      renderPlayerRankItem(root, focusPlayer, idx, cur);
    }

    // Aggiungiamo il tasto per aprire la classifica completa
    const btnOpen = document.createElement("button");
    btnOpen.className = "px-btn px-btn-secondary btn-open-rank";
    btnOpen.style.marginLeft = "8px";
    btnOpen.innerHTML = "📊";
    btnOpen.onclick = () => {
      const modal = el("rank-modal");
      const list = el("modal-rank-list");
      if (modal && list) {
        list.innerHTML = ""; // Pulisce la modale
        ps.forEach((p, idx) => renderPlayerRankItem(list, p, idx, cur));
        modal.style.display = "grid";
      }
    };
    root.appendChild(btnOpen);
  }
}

let lastRankState = "";

export function renderMobileRankModal() {
  const modal = el("rank-modal");
  if (!modal || modal.style.display === "none") return;

  const ps = getPlayers();
  if (!ps) return;

  // 1. Creiamo una stringa che rappresenta lo stato attuale
  // Se i punti o il numero di carte non cambiano, non ridisegniamo nulla
  const currentState = ps.map(p => 
    `${p.id}-${p.getState("puntiTotali") || 0}-${(p.getState("mioTavolo") || []).length}-${p.getState("statoRound")}`
  ).join("|");

  if (currentState === lastRankState) return; // ESCI SE NON CI SONO NOVITÀ
  lastRankState = currentState;

  const container = el("modal-rank-list");
  if (!container) return;

  // 2. Usiamo un frammento di documento (più veloce per il mobile)
  const tempDiv = document.createElement("div");
  const cur = currentTurnPlayer();
  
  ps.forEach((p, idx) => {
    // Usiamo la TUA funzione unificata
    renderPlayerRankItem(tempDiv, p, idx, cur);
  });

  // 3. Aggiorniamo il DOM in un colpo solo
  container.innerHTML = tempDiv.innerHTML;
}

// ✅ Helper per render singolo item rank (usato sia virtual che fallback)
function renderPlayerRankItem(container, p, idx, cur) {
  const score = p.getState("puntiTotali") || 0;
  const statoRaw = p.getState("statoRound") || "IN GIOCO";
  const sKey = stateKey(statoRaw);
  const statoLabel = roundStateLabel(statoRaw);
  
  // Logiche esistenti per carte e tavoli
  const tavolo = p.getState("mioTavolo") || [];
  const pending = p.getState("pendingActions") || [];
  const shown = [...tavolo, ...pending];

  // Calcolo punti round per il (+X)
  const roundPts = typeof pointsFromCards === 'function' ? pointsFromCards(tavolo) : 0;
  const isMe = p.id === me()?.id;

  // Logica 2nd Chance virtuale
  if (p.getState("hasSecondChance")) {
    const giaInPending = pending.some(c => c.value === "2ndCHANCE");
    if (!giaInPending) {
      shown.push({ type: "special", value: "2ndCHANCE" });
    }
  }

  // Logica colori dot
  const dotClass =
    sKey === "IN_GIOCO"
      ? "dot-green"
      : sKey === "STAY" || sKey === "FLIP7WIN"
        ? "dot-blue"
        : "dot-red";

  const item = document.createElement("div");
  // Aggiungiamo 'rank-active' se è il turno e uno stile speciale se sono IO
  item.className = `rank-item ${(cur && cur.id === p.id) ? "rank-active" : ""}`;
  if (isMe) {
    item.style.outline = "1px solid var(--neonCyan)";
    item.style.background = "rgba(0, 224, 255, 0.05)";
  }
  
  item.dataset.index = String(idx + 1);
  item.dataset.pid = String(p.id || "");
  item.dataset.state = sKey;

  // Layout aggiornato con (+Punti) e (TU)
  item.innerHTML = `
    <div class="rank-top">
      <div class="rank-left">
        <div class="rank-pos">${escapeHtml(nf.formatNumber(idx + 1))}</div>
        <div class="rank-name">
          ${escapeHtml((p.getProfile().name || "PLAYER").toUpperCase())}
          ${isMe ? `<span style="color:var(--neonCyan); font-size:0.7em; margin-left:4px;">(TU)</span>` : ''}
        </div>
      </div>
      <div class="rank-score">
        ${escapeHtml(nf.formatNumber(score))}
        <span style="opacity:0.7; font-size: 0.65em; margin-left:2px;">(+${roundPts})</span>
      </div>
    </div>
    <div class="badge" data-state="${escapeHtml(sKey)}">
      <span class="dot ${dotClass}"></span>
      <span>${escapeHtml(statoLabel)}</span>
      <span style="margin-left:auto">${p.getState("matchRoundDone") ? "✓" : ""}</span>
    </div>
  `;

  // Mini carte con logica duplicati e animazioni
  const minis = document.createElement("div");
  minis.className = "mini-cards";

  const now = Date.now();
  const dupValue = p.getState("dupValue");
  const dupActive = now < (p.getState("dupFxUntil") || 0);

  const cardsToShow = shown.slice(-10);
  if (cardsToShow.length === 0) {
    const empty = document.createElement("div");
    empty.className = "mini empty";
    empty.innerText = "—";
    minis.appendChild(empty);
  } else {
    cardsToShow.forEach((c) => {
      const isDup = dupActive && c?.type === "number" && dupValue != null && c.value === dupValue;
      const m = document.createElement("div");
      m.className = `mini ${c?.type !== "number" ? "special" : ""} ${isDup ? "dup-hit flash-strong" : ""}`.trim();
      m.innerText = cardLabel(c);
      minis.appendChild(m);
    });
  }

  item.appendChild(minis);
  container.appendChild(item);
  return container;
}

// ✅ FIX: renderMyTable - Virtualizer corretto + double render + pending dopo
export async function renderMyTable() {
  const mp = me();
  if (!mp) return; // ✅ Check player
  
  ensureDefaults(mp);
  const display = el("card-display");
  if (!display) return;

  const now = Date.now();
  const dupValue = mp.getState("dupValue");
  const dupActive = now < (mp.getState("dupFxUntil") || 0);
  const cards = mp.getState("mioTavolo") || [];
  const pending = mp.getState("pendingActions") || [];

  const prevCount = Number(display.getAttribute("data-prev-count") || "0");
  display.setAttribute("data-prev-count", String(cards.length));
  display.innerHTML = "";

  if (cards.length <= 20) {
    renderCardsDirect(display, cards, prevCount, dupActive, dupValue);
  } else {
    try {
      const virt = virtualize({
        items: cards,
        renderItem: (c, idx) => renderCardItem(c, idx >= prevCount, dupActive, dupValue)
      });
      virt.container = display;
      
      // ✅ Force refresh dopo 50ms
      setTimeout(() => {
        if (display.children.length === 0) {
          console.warn("[renderMyTable] Virtualizer failed, fallback direct render");
          display.innerHTML = "";
          renderCardsDirect(display, cards, prevCount, dupActive, dupValue);
        }
      }, 10000);
    } catch (e) {
      console.error("[renderMyTable]", e);
      renderCardsDirect(display, cards, prevCount, dupActive, dupValue);
    }
  }

  // ✅ Pending actions SEMPRE dopo (non virtualizzati)
  renderPendingActions(display, pending);

  // ✅ Shield second chance
  if (mp.getState("hasSecondChance")) {
    const shield = document.createElement("div");
    shield.className = "card shield";
    shield.innerText = "🛡️";
    display.appendChild(shield);
  }

  // ✅ Shake effect per duplicati
  triggerDupShake(display, dupActive, dupValue, mp);
}

// ✅ Render diretto carte (fallback affidabile)
function renderCardsDirect(container, cards, prevCount, dupActive, dupValue) {
  cards.forEach((c, idx) => {
    const item = renderCardItem(c, idx >= prevCount, dupActive, dupValue);
    container.appendChild(item);
  });
}

// ✅ Render singola carta
function renderCardItem(c, isNew, dupActive, dupValue) {
  const isSpecial = c?.type !== "number";
  const isDup = dupActive && c?.type === "number" && dupValue != null && c.value === dupValue;
  
  const d = document.createElement("div");
  d.className = `card ${isSpecial ? "special" : ""} ${isDup ? "dup-hit" : ""} ${isNew ? "deal" : ""}`.trim();
  d.innerText = cardLabel(c) || "?";
  if (c?.value != null) d.dataset.value = String(c.value);
  return d;
}

// ✅ Pending actions separate
function renderPendingActions(container, pending) {
  pending.forEach((c) => {
    const d = document.createElement("div");
    d.className = "card special pending-action";
    d.innerText = cardLabel(c) || "?";
    container.appendChild(d);
  });
}

// ✅ Shake effect migliorato
function triggerDupShake(display, dupActive, dupValue, mp) {
  if (!dupActive || !dupValue) return;

  const lastShakeKey = display.getAttribute("data-last-shake") || "";
  const shakeKey = `${dupValue}:${mp.getState("dupFxUntil") || 0}`;

  if (shakeKey !== lastShakeKey) {
    setTimeout(() => {
      const dupCards = display.querySelectorAll(`.dup-hit`);
      console.log("[shake]", { found: dupCards.length, key: shakeKey });
      
      dupCards.forEach((card, i) => {
        setTimeout(() => {
          card.classList.add("shake");
          setTimeout(() => card.classList.remove("shake"), 900);
        }, i * 50); // Stagger effect
      });
    }, 100);
    
    display.setAttribute("data-last-shake", shakeKey);
  }
}

export function renderHud(hostLocks = { actionLocked: false, transitionLocked: false }) {
  const mp = me();
  if (!mp) return;
  
  ensureDefaults(mp);

  const cur = currentTurnPlayer();
  const myTurn = !!cur && cur.id === mp.id && isEligible(mp);

  // Score
  const myScoreEl = el("my-score");
  if (myScoreEl) myScoreEl.innerText = nf.formatNumber(mp.getState("puntiTotali") || 0);

  const roundScoreEl = el("round-score");
  if (roundScoreEl) roundScoreEl.innerText = nf.formatNumber(pointsFromCards(mp.getState("mioTavolo") || []));

  // Match info
  const mr = el("match-round");
  if (mr) mr.innerText = nf.formatNumber(Playroom.getState("matchRoundIndex") || 1);

  const mt = el("match-target");
  if (mt) mt.innerText = nf.formatNumber(Playroom.getState("matchTarget") || 200);

  // Deck info
  const drawPile = Playroom.getState("drawPile") || [];
  const discardPile = Playroom.getState("discardPile") || [];
  const deckInfo = el("deck-info");
  if (deckInfo) {
    deckInfo.innerText = t("hud.deck", {
      draw: nf.formatNumber(drawPile.length),
      discard: nf.formatNumber(discardPile.length),
      inPlay: nf.formatNumber(computeInPlayCount()),
    });
  }

  // Second chance indicator
  const sc = el("sc-indicator");
  if (sc) sc.style.display = mp.getState("hasSecondChance") ? "inline-flex" : "none";

  // Lock banner
  const lockLine = pendingText();
  const lockBanner = el("lock-banner");
  if (lockBanner) {
    lockBanner.style.display = lockLine ? "block" : "none";
    if (lockLine) lockBanner.innerText = lockLine;
  }

  // Tip
  const flip3 = getFlip3Ctx();
  const lock = !!getPendingTarget() || !!hostLocks.actionLocked || !!hostLocks.transitionLocked || !!flip3;
  const tip = el("turn-tip");
  if (tip) {
    if (flip3) tip.innerText = flip3.paused ? t("hud.tipFlip3Pause") : t("hud.tipFlip3", { n: flip3.remaining || 0 });
    else if (lock) tip.innerText = t("hud.tipLock");
    else tip.innerText = myTurn ? t("hud.tipAction") : t("hud.tipWait");
  }

  // Status
  const status = el("status-bar");
  if (status) {
    if (Playroom.getState("partitaFinita")) status.innerText = t("hud.statusGameOver");
    else if (flip3) {
      const tp = getPlayers().find((p) => p.id === flip3.targetId) || null;
      const pname = tp ? (tp.getProfile().name || "PLAYER").split(" ")[0] : "??";
      status.innerText = flip3.paused
        ? t("hud.statusFlip3Pause", { player: pname })
        : t("hud.statusFlip3Run", { player: pname, n: flip3.remaining || 0 });
    } else if (lockLine) status.innerText = t("hud.statusWaitChoice");
    else if (myTurn) status.innerText = t("hud.statusYourTurn");
    else status.innerText = t("hud.statusTurnOf", { player: cur ? (cur.getProfile().name || "PLAYER").split(" ")[0] : "??" });
  }

  // Buttons
  const btnDraw = el("btn-pesca");
  const btnStop = el("btn-stop");
  const roundEnded = !!Playroom.getState("roundEndedByFlip7");
  const fxBusy = fxIsBusy();

  const drawDisabled =
    !!Playroom.getState("partitaFinita") ||
    roundEnded ||
    !!getPendingTarget() ||
    !!hostLocks.actionLocked ||
    !!hostLocks.transitionLocked ||
    !!flip3 ||
    !myTurn ||
    !!mp.getState("flip3Lock") ||
    fxBusy;

  const stopDisabled =
    !!Playroom.getState("partitaFinita") ||
    roundEnded ||
    !!getPendingTarget() ||
    !!hostLocks.actionLocked ||
    !!hostLocks.transitionLocked ||
    !!flip3 ||
    !myTurn ||
    !!mp.getState("flip3Lock") ||
    (mp.getState("mioTavolo") || []).length === 0 ||
    fxBusy;

  if (btnDraw) btnDraw.disabled = drawDisabled;
  if (btnStop) btnStop.disabled = stopDisabled;
}

document.addEventListener('click', (e) => {
  if (e.target.id === "rank-modal-close") {
    el("rank-modal").style.display = "none";
  }
});
