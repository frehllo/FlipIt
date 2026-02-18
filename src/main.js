import * as Playroom from "playroomkit";

if (window.__flip7_main_started__) {
  // noop
} else {
  window.__flip7_main_started__ = true;
  start();
}

async function start() {
  await Playroom.insertCoin({
    gameId: "flip7-pixel-v220-chat-desktop-mobile-modal",
    skipLobby: false,
  });

  const PLUS2 = 2000;

  const CFG = Object.freeze({
    MATCH_TARGET: 200,
    FLIP7_BONUS: 15,

    MAX_TOASTS: 3,
    MAX_LOG: 5,
    MAX_CHAT: 50,

    TARGET_TIMEOUT_MS: 18000,
    SERVER_ACTION_COOLDOWN_MS: 220,

    BUST_HOLD_MS: 1600 + PLUS2,
    ROUND_TRANSITION_PAD_MS: 120,

    FLIP3_STEP_MS: 360,
    FLIP3_WATCHDOG_MS: 12000,

    HOST_TICK_MS: 250,

    FX: {
      TEXT_MS: 950 + PLUS2,
      OVERLAY_MS: 880 + PLUS2,
      FALL_MIN_MS: 750 + PLUS2,
      FALL_MAX_MS: 1400 + PLUS2,
      SIZE_MIN_PX: 14,
      SIZE_MAX_PX: 26,
      PARTICLES: {
        BUST: 34,
        FREEZE: 28,
        FLIP3: 28,
        SECOND: 26,
        FLIP7: 40,
        BANK: 32,
        TARGET: 16,
      },
    },

    TOAST_MS_DEFAULT: 1400 + PLUS2,
  });

  // ---------- DOM helpers ----------
  const el = (id) => document.getElementById(id);
  const on = (node, evt, fn) => node && node.addEventListener(evt, fn);

  // ---------- utils ----------
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const hostNow = () => Date.now();

  const me = () => Playroom.myPlayer();

  const getPlayers = () =>
    Playroom.getParticipants()
      .slice()
      .sort((a, b) => a.id.localeCompare(b.id));

  const nameOf = (p) => (p ? p.getProfile().name.split(" ")[0].toUpperCase() : "—");

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // ---------- Chat UI (desktop + mobile modal) ----------
  const chatUI = {
    desktop: {
      messages: () => el("chat-messages-desktop"),
      text: () => el("chat-text-desktop"),
      send: () => el("chat-send-desktop"),
    },
    mobile: {
      modal: () => el("chat-modal"),
      openBtn: () => el("mobile-chat-fab"),
      closeBtn: () => el("chat-close-mobile"),
      messages: () => el("chat-messages-mobile"),
      text: () => el("chat-text-mobile"),
      send: () => el("chat-send-mobile"),
    },
  };

  const openChatMobile = () => {
    const m = chatUI.mobile.modal();
    if (!m) return;
    m.style.display = "grid";
    setTimeout(() => chatUI.mobile.text()?.focus(), 0);
  };

  const closeChatMobile = () => {
    const m = chatUI.mobile.modal();
    if (!m) return;
    m.style.display = "none";
  };

  if (chatUI.mobile.openBtn()) chatUI.mobile.openBtn().onclick = openChatMobile;
  if (chatUI.mobile.closeBtn()) chatUI.mobile.closeBtn().onclick = closeChatMobile;

  const chatModal = chatUI.mobile.modal();
  if (chatModal) on(chatModal, "click", (e) => e.target === chatModal && closeChatMobile());
  on(window, "keydown", (e) => e.key === "Escape" && closeChatMobile());

  // ---------- player defaults ----------
  const ensureDefaults = (p) => {
    if (p.getState("puntiTotali") == null) p.setState("puntiTotali", 0);
    if (p.getState("statoRound") == null) p.setState("statoRound", "IN GIOCO"); // IN GIOCO | STAY | SBALLATO | FLIP7_WIN
    if (p.getState("matchRoundDone") == null) p.setState("matchRoundDone", false);

    if (p.getState("mioTavolo") == null) p.setState("mioTavolo", []);
    if (p.getState("pendingActions") == null) p.setState("pendingActions", []);

    if (p.getState("flip3Lock") == null) p.setState("flip3Lock", false);
    if (p.getState("hasSecondChance") == null) p.setState("hasSecondChance", false);

    if (p.getState("roundDrawn") == null) p.setState("roundDrawn", []);
    if (p.getState("dupValue") == null) p.setState("dupValue", null);
    if (p.getState("dupFxUntil") == null) p.setState("dupFxUntil", 0);
  };

  const ensureAllDefaults = () => getPlayers().forEach(ensureDefaults);

  const isInGioco = (p) => (p.getState("statoRound") || "IN GIOCO") === "IN GIOCO";
  const isDone = (p) => !!p.getState("matchRoundDone");
  const isEligible = (p) => !!p && isInGioco(p) && !isDone(p);

  // ---------- Deck ----------
  function generateDeck() {
    const m = [{ type: "number", value: 0 }];
    for (let i = 1; i <= 12; i++) for (let j = 0; j < i; j++) m.push({ type: "number", value: i });
    for (let k = 0; k < 3; k++) {
      m.push(
        { type: "special", value: "FREEZE" },
        { type: "special", value: "2ndCHANCE" },
        { type: "special", value: "FLIP3" }
      );
    }
    [2, 3, 4, 6, 8, 10].forEach((v) => m.push({ type: "plus", value: v }));
    m.push({ type: "mult", value: "x2" });

    for (let i = m.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [m[i], m[j]] = [m[j], m[i]];
    }
    return m;
  }

  function pointsFromCards(cards) {
    let base = 0,
      bonus = 0,
      mult = 1;
    (cards || []).forEach((c) => {
      if (c.type === "number") base += c.value;
      else if (c.type === "plus") bonus += c.value;
      else if (c.type === "mult") mult = 2;
    });
    return base * mult + bonus;
  }

  function cardLabel(c) {
    if (!c) return "?";
    if (c.type === "plus") return `+${c.value}`;
    if (c.type === "mult") return "x2";
    if (c.value === "FREEZE") return "❄️";
    if (c.value === "FLIP3") return "🎁";
    if (c.value === "2ndCHANCE") return "🛡️";
    return `${c.value}`;
  }

  function iconFor(tipo) {
    if (tipo === "FREEZE") return "❄️";
    if (tipo === "FLIP3") return "🎁";
    if (tipo === "2ndCHANCE") return "🛡️";
    return "✨";
  }

  // ---------- FX ----------
  const fxLocal = (() => {
    const layer = () => el("fx-layer");

    const addOverlay = (cls) => {
      const root = layer();
      if (!root) return;
      const d = document.createElement("div");
      d.className = cls;
      root.appendChild(d);
      setTimeout(() => d.remove(), CFG.FX.OVERLAY_MS + 120);
    };

    const addText = (text) => {
      const root = layer();
      if (!root) return;
      const t = document.createElement("div");
      t.className = "fx-text";
      t.innerText = text;
      root.appendChild(t);
      setTimeout(() => t.remove(), CFG.FX.TEXT_MS + 160);
    };

    const addParticles = (className, glyph, count) => {
      const root = layer();
      if (!root) return;

      for (let i = 0; i < count; i++) {
        const p = document.createElement("div");
        p.className = className;
        p.innerText = glyph;

        const x = rand(2, 98);
        const size = rand(CFG.FX.SIZE_MIN_PX, CFG.FX.SIZE_MAX_PX);
        const dur = rand(CFG.FX.FALL_MIN_MS, CFG.FX.FALL_MAX_MS);
        const delay = rand(0, 160);
        const rot = rand(-35, 35);

        p.style.left = `${x}vw`;
        p.style.fontSize = `${size}px`;
        p.style.animationDuration = `${dur}ms`;
        p.style.animationDelay = `${delay}ms`;
        p.style.transform = `rotate(${rot}deg)`;

        root.appendChild(p);
        setTimeout(() => p.remove(), dur + delay + 200);
      }
    };

    const run = (kind, text) => {
      if (kind === "FREEZE") {
        addOverlay("freeze-overlay"); addText("FREEZE!"); addParticles("snowflake", "❄️", CFG.FX.PARTICLES.FREEZE);
      } else if (kind === "FLIP3") {
        addOverlay("flip3-overlay"); addText("FLIP3!"); addParticles("giftpop", "🎁", CFG.FX.PARTICLES.FLIP3);
      } else if (kind === "SECOND") {
        addOverlay("sc-overlay"); addText("2ND!"); addParticles("shieldpop", "🛡️", CFG.FX.PARTICLES.SECOND);
      } else if (kind === "BUST") {
        addOverlay("bust-overlay"); addText("DOPPIONE!"); addParticles("dangerpop", "💥", CFG.FX.PARTICLES.BUST);
      } else if (kind === "FLIP7") {
        addOverlay("flip7-overlay"); addText("FLIP7!!!"); addParticles("starpop", "✨", CFG.FX.PARTICLES.FLIP7);
      } else if (kind === "BANK") {
        addOverlay("bank-overlay"); addText(`BANK! +${text || 0}`); addParticles("coinpop", "🪙", CFG.FX.PARTICLES.BANK);
      } else if (kind === "TARGET") {
        addText(`TARGET: ${text || "—"}`); addParticles("starpop", "✨", CFG.FX.PARTICLES.TARGET);
      }
    };

    return { run };
  })();

  Playroom.RPC.register("rpcFx", (d) => {
    const tid = d?.tid;
    if (!tid) return;
    if (me().id !== tid) return;
    fxLocal.run(d.kind, d.text);
  });

  // ---------- Toast ----------
  const toast = (text, type = "neutral", ms = CFG.TOAST_MS_DEFAULT) => {
    Playroom.RPC.call("rpcToast", { text, type, ms }, Playroom.RPC.Mode.ALL);
  };

  Playroom.RPC.register("rpcToast", (d) => {
    const container = el("game-alerts");
    if (!container) return;
    const div = document.createElement("div");
    div.className = `toast ${d.type || "neutral"}`;
    div.innerText = d.text || "";
    container.appendChild(div);
    while (container.children.length > CFG.MAX_TOASTS) container.removeChild(container.firstChild);
    setTimeout(() => div.remove(), d.ms || CFG.TOAST_MS_DEFAULT);
  });

  // ---------- Round log ----------
  const logPush = (entry) => {
    if (!Playroom.isHost()) {
      Playroom.RPC.call("rpcLogEvent", entry, Playroom.RPC.Mode.HOST);
      return;
    }
    const arr = Playroom.getState("roundLog") || [];
    const next = [{ ...entry, t: Date.now() }, ...arr].slice(0, CFG.MAX_LOG);
    Playroom.setState("roundLog", next);
    Playroom.RPC.call("rpcSyncLog", { log: next }, Playroom.RPC.Mode.ALL);
  };

  const LOG = {
    turn(pid, reason) {
      const p = getPlayers().find((x) => x.id === pid) || null;
      logPush({ type: "neutral", text: `TURN → ${p ? nameOf(p) : "—"} (${reason || "-"})` });
    },
    draw(p, card) { logPush({ type: "neutral", text: `${nameOf(p)} pesca ${cardLabel(card)}` }); },
    stop(p, pts) { logPush({ type: "success", text: `${nameOf(p)} BANK +${pts}` }); },
    bust(p, val) { logPush({ type: "danger", text: `${nameOf(p)} BUST (doppio ${val})` }); },
    info(text) { logPush({ type: "info", text }); },
    round(text) { logPush({ type: "neutral", text }); },
  };

  Playroom.RPC.register("rpcLogEvent", (d) => {
    if (!Playroom.isHost()) return;
    const arr = Playroom.getState("roundLog") || [];
    const next = [{ ...d, t: Date.now() }, ...arr].slice(0, CFG.MAX_LOG);
    Playroom.setState("roundLog", next);
    Playroom.RPC.call("rpcSyncLog", { log: next }, Playroom.RPC.Mode.ALL);
  });

  Playroom.RPC.register("rpcSyncLog", (d) => {
    const root = el("round-log");
    if (!root) return;
    root.innerHTML = "";
    (d?.log || []).slice(0, CFG.MAX_LOG).reverse().forEach((x) => {
      const chip = document.createElement("div");
      chip.className = `chip ${x.type || "neutral"}`;
      chip.innerText = x.text || "";
      root.appendChild(chip);
    });
  });

  // ---------- Chat (RPC, dual UI) ----------
  const appendChatLineTo = (root, { name, msg }) => {
    if (!root) return;
    const line = document.createElement("div");
    line.className = "chat-line";
    line.innerHTML = `<span class="chat-name">${escapeHtml((name || "—").toUpperCase())}:</span> <span class="chat-msg">${escapeHtml(
      (msg || "").slice(0, 120)
    )}</span>`;
    root.appendChild(line);
    while (root.children.length > CFG.MAX_CHAT) root.removeChild(root.firstChild);
    root.scrollTop = root.scrollHeight;
  };

  const appendChatEverywhere = ({ name, msg }) => {
    appendChatLineTo(chatUI.desktop.messages(), { name, msg });
    appendChatLineTo(chatUI.mobile.messages(), { name, msg });
  };

  Playroom.RPC.register("rpcChat", (d) => appendChatEverywhere({ name: d?.name, msg: d?.msg }));

  const sendChatFrom = (inputEl) => {
    if (!inputEl) return;
    const msg = String(inputEl.value || "").trim();
    if (!msg) return;
    inputEl.value = "";
    const myName = (me()?.getProfile()?.name || "PLAYER").split(" ")[0];
    Playroom.RPC.call("rpcChat", { name: myName, msg: msg.slice(0, 120) }, Playroom.RPC.Mode.ALL);
  };

  if (chatUI.desktop.send()) chatUI.desktop.send().onclick = () => sendChatFrom(chatUI.desktop.text());
  if (chatUI.desktop.text()) on(chatUI.desktop.text(), "keydown", (e) => e.key === "Enter" && sendChatFrom(chatUI.desktop.text()));

  if (chatUI.mobile.send()) chatUI.mobile.send().onclick = () => sendChatFrom(chatUI.mobile.text());
  if (chatUI.mobile.text()) on(chatUI.mobile.text(), "keydown", (e) => e.key === "Enter" && sendChatFrom(chatUI.mobile.text()));

  // ---------- Info modal ----------
  const infoModal = el("info-modal");
  const openInfo = () => infoModal && (infoModal.style.display = "grid");
  const closeInfo = () => infoModal && (infoModal.style.display = "none");
  if (el("btn-info")) el("btn-info").onclick = openInfo;
  if (el("info-close")) el("info-close").onclick = closeInfo;
  if (infoModal) on(infoModal, "click", (e) => e.target === infoModal && closeInfo());

  // ---------- Target modal client ----------
  Playroom.RPC.register("rpcOpenTargetModal", (d) => {
    if (!d?.sourceId) return;
    if (me().id !== d.sourceId) return;
    openTargetModalClient(d.tipo, me(), d?.ctx || null);
  });

  Playroom.RPC.register("rpcForceCloseTargetModal", (d) => {
    const modal = el("target-modal");
    if (!modal) return;
    if (d?.sourceId && me().id !== d.sourceId) return;
    modal.style.display = "none";
  });

  function openTargetModalClient(tipo, sourcePlayer, ctx) {
    const modal = el("target-modal");
    const opts = el("target-options");
    const title = el("modal-title");
    const closeBtn = el("modal-close");
    const iconBox = el("modal-special-icon");
    if (!modal || !opts || !title || !closeBtn || !iconBox) return;

    iconBox.style.display = "grid";
    iconBox.innerText = iconFor(tipo);

    title.innerText = `SCEGLI BERSAGLIO: ${tipo}`;
    opts.innerHTML = "";
    closeBtn.style.display = "none";
    closeBtn.onclick = null;

    const candidates = (ctx?.candidates || []).map((x) => ({ id: x.id, name: x.name }));
    if (candidates.length === 0) {
      modal.style.display = "none";
      return;
    }

    modal.style.display = "grid";
    candidates.forEach((p) => {
      const b = document.createElement("button");
      b.className = "px-btn px-btn-secondary";
      b.innerText = p.id === sourcePlayer.id ? "ME STESSO" : p.name;
      b.onclick = () => {
        [...opts.querySelectorAll("button")].forEach((x) => (x.disabled = true));
        modal.style.display = "none";
        Playroom.RPC.call("rpcHostConfirmTargetChoice", { reqId: ctx.reqId, by: sourcePlayer.id, tid: p.id }, Playroom.RPC.Mode.HOST);
      };
      opts.appendChild(b);
    });
  }

  // ---------- Endgame modal ----------
  const endgameModal = el("endgame-modal");
  const closeEndgame = () => endgameModal && (endgameModal.style.display = "none");
  if (el("endgame-close")) el("endgame-close").onclick = closeEndgame;
  if (endgameModal) on(endgameModal, "click", (e) => e.target === endgameModal && closeEndgame());

  Playroom.RPC.register("rpcOpenEndgame", () => {
    renderEndgameRanking();
    if (endgameModal) endgameModal.style.display = "grid";
    const hostActions = el("endgame-host-actions");
    if (hostActions) hostActions.style.display = Playroom.isHost() ? "block" : "none";
  });

  if (el("endgame-newgame")) {
    el("endgame-newgame").onclick = () => {
      if (!Playroom.isHost()) return;
      hostNewGame();
      if (endgameModal) endgameModal.style.display = "none";
    };
  }

  function renderEndgameRanking() {
    const root = el("endgame-ranking");
    if (!root) return;

    const ps = getPlayers();
    ps.forEach(ensureDefaults);

    const winnerId = Playroom.getState("winnerId");
    const ranking = ps
      .map((p) => ({ id: p.id, name: p.getProfile().name, score: p.getState("puntiTotali") || 0 }))
      .sort((a, b) => b.score - a.score);

    root.innerHTML = "";
    ranking.forEach((r, i) => {
      const row = document.createElement("div");
      row.className = "endgame-row" + (r.id === winnerId ? " endgame-winner" : "");
      row.innerHTML = `
        <div class="endgame-left">
          <div class="endgame-pos">#${i + 1}</div>
          <div class="endgame-name">${escapeHtml(r.name)}</div>
        </div>
        <div class="endgame-score">${r.score}</div>
      `;
      root.appendChild(row);
    });
  }

  // ---------- Host state ----------
  const getPendingTarget = () => Playroom.getState("pendingTarget");
  const hasPendingTarget = () => !!getPendingTarget();

  const getFlip3Ctx = () => Playroom.getState("flip3Ctx");

  const hostActionLocked = () => hostNow() < (Playroom.getState("turnActionLockUntil") || 0);
  const hostRoundTransitionLocked = () => hostNow() < (Playroom.getState("roundTransitionUntil") || 0);

  const hostLockAction = (ms = CFG.SERVER_ACTION_COOLDOWN_MS) => {
    const until = hostNow() + ms;
    Playroom.setState("turnActionLockUntil", Math.max(Playroom.getState("turnActionLockUntil") || 0, until));
  };

  const hostLockRoundTransition = (ms) => {
    const until = hostNow() + ms;
    Playroom.setState("roundTransitionUntil", Math.max(Playroom.getState("roundTransitionUntil") || 0, until));
  };

  function hostInit() {
    if (!Playroom.isHost()) return;

    if (Playroom.getState("drawPile") == null) Playroom.setState("drawPile", generateDeck());
    if (Playroom.getState("discardPile") == null) Playroom.setState("discardPile", []);

    if (Playroom.getState("turnPid") == null) {
      Playroom.setState("turnPid", getPlayers()[0]?.id || null);
      if (Playroom.getState("turnPid")) LOG.turn(Playroom.getState("turnPid"), "init");
    }

    if (Playroom.getState("matchTarget") == null) Playroom.setState("matchTarget", CFG.MATCH_TARGET);
    if (Playroom.getState("matchRoundIndex") == null) Playroom.setState("matchRoundIndex", 1);

    if (Playroom.getState("roundLog") == null) Playroom.setState("roundLog", []);

    if (Playroom.getState("partitaFinita") == null) Playroom.setState("partitaFinita", false);
    if (Playroom.getState("winnerId") == null) Playroom.setState("winnerId", null);

    if (Playroom.getState("roundEndedByFlip7") == null) Playroom.setState("roundEndedByFlip7", false);

    if (Playroom.getState("turnActionLockUntil") == null) Playroom.setState("turnActionLockUntil", 0);
    if (Playroom.getState("roundTransitionUntil") == null) Playroom.setState("roundTransitionUntil", 0);

    if (Playroom.getState("pendingTarget") == null) Playroom.setState("pendingTarget", null);

    if (Playroom.getState("flip3Ctx") == null) Playroom.setState("flip3Ctx", null);
    if (Playroom.getState("flip3TimerOn") == null) Playroom.setState("flip3TimerOn", false);
    if (Playroom.getState("flip3Stepping") == null) Playroom.setState("flip3Stepping", false);
    if (Playroom.getState("flip3Pause") == null) Playroom.setState("flip3Pause", null);

    if (Playroom.getState("reqCounter") == null) Playroom.setState("reqCounter", 1);
  }

  const eligibleTurnIds = () => {
    const ps = getPlayers();
    ps.forEach(ensureDefaults);
    return ps.filter((p) => isEligible(p)).map((p) => p.id);
  };

  const currentTurnPlayer = () => {
    const pid = Playroom.getState("turnPid");
    if (!pid) return null;
    return getPlayers().find((x) => x.id === pid) || null;
  };

  const hostEnsureValidTurn = () => {
    const elig = eligibleTurnIds();
    if (elig.length === 0) return;
    const cur = currentTurnPlayer();
    if (cur && isEligible(cur)) return;
    Playroom.setState("turnPid", elig[0]);
    LOG.turn(elig[0], "fix");
  };

  const hostAdvanceTurn = (reason) => {
    if (getFlip3Ctx()) return; // durante FLIP3 sospeso
    const elig = eligibleTurnIds();
    if (elig.length === 0) return;

    const curId = Playroom.getState("turnPid");
    const idx = Math.max(0, elig.indexOf(curId));
    const nextId = elig[(idx + 1) % elig.length];

    Playroom.setState("turnPid", nextId);
    LOG.turn(nextId, reason || "advance");
  };

  // ---------- Deck ops ----------
  function hostPushDiscard(cards) {
    const discard = Playroom.getState("discardPile") || [];
    Playroom.setState("discardPile", [...discard, ...(cards || [])]);
  }

  async function hostDrawOne() {
    let drawPile = Playroom.getState("drawPile") || [];
    let discardPile = Playroom.getState("discardPile") || [];

    if (drawPile.length === 0 && discardPile.length > 0) {
      drawPile = discardPile;
      discardPile = [];
      for (let i = drawPile.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [drawPile[i], drawPile[j]] = [drawPile[j], drawPile[i]];
      }
      Playroom.setState("drawPile", drawPile);
      Playroom.setState("discardPile", discardPile);
      toast("Rimescolo gli scarti.", "neutral", 900 + PLUS2);
      LOG.round("Deck: rimescolo scarti");
    }

    if (drawPile.length === 0) return null;
    const card = drawPile.pop();
    Playroom.setState("drawPile", drawPile);
    return card;
  }

  // ---------- Targeting (host) ----------
  function hostMakeReqId() {
    const n = (Playroom.getState("reqCounter") || 1) + 1;
    Playroom.setState("reqCounter", n);
    return `req_${n}_${Date.now()}`;
  }

  const computeCandidates = (tipo, byId) => {
    const ps = getPlayers();
    ps.forEach(ensureDefaults);
    const elig = ps.filter((p) => isEligible(p));

    if (tipo === "2ndCHANCE") {
      const by = ps.find((p) => p.id === byId);
      const byHas = !!by?.getState("hasSecondChance");
      const receivers = elig.filter((p) => !p.getState("hasSecondChance"));
      if (byHas) return receivers.filter((p) => p.id !== byId);
      return receivers;
    }

    return elig;
  };

  const hostApplyTargeted = ({ tipo, tid, byId, mode }) => {
    const ps = getPlayers();
    const by = ps.find((p) => p.id === byId);
    const target = ps.find((p) => p.id === tid);
    if (!by || !target) return;

    ensureDefaults(by);
    ensureDefaults(target);

    Playroom.RPC.call("rpcFx", { tid, kind: "TARGET", text: tipo }, Playroom.RPC.Mode.ALL);

    if (tipo === "FREEZE") {
      Playroom.RPC.call("rpcFx", { tid, kind: "FREEZE" }, Playroom.RPC.Mode.ALL);

      const tavolo = target.getState("mioTavolo") || [];
      const pts = pointsFromCards(tavolo);

      target.setState("puntiTotali", (target.getState("puntiTotali") || 0) + pts);
      target.setState("statoRound", "STAY");
      target.setState("hasSecondChance", false);

      hostPushDiscard(tavolo);
      target.setState("mioTavolo", []);

      hostPushDiscard(target.getState("pendingActions") || []);
      target.setState("pendingActions", []);
      target.setState("flip3Lock", false);

      target.setState("matchRoundDone", true);

      Playroom.RPC.call("rpcFx", { tid, kind: "BANK", text: String(pts) }, Playroom.RPC.Mode.ALL);

      toast(`FREEZE → ${nameOf(target)} banca +${pts}`, "info", 1500 + PLUS2);
      LOG.info(`${nameOf(by)} FREEZE → ${nameOf(target)} (${mode || "?"})`);
      return;
    }

    if (tipo === "FLIP3") {
      Playroom.RPC.call("rpcFx", { tid, kind: "FLIP3" }, Playroom.RPC.Mode.ALL);
      LOG.info(`${nameOf(by)} FLIP3 → ${nameOf(target)} (${mode || "?"})`);
      hostStartFlip3({ ownerId: byId, targetId: tid });
      return;
    }

    // 2ND
    if (target.getState("hasSecondChance")) {
      toast(`2ND: ${nameOf(target)} già protetto (scartata).`, "neutral", 1200 + PLUS2);
      LOG.round("2ND: target già protetto → scartata");
      return;
    }

    target.setState("hasSecondChance", true);
    Playroom.RPC.call("rpcFx", { tid, kind: "SECOND" }, Playroom.RPC.Mode.ALL);
    toast(`2ND CHANCE → ${nameOf(target)}`, "neutral", 1300 + PLUS2);
    LOG.info(`${nameOf(by)} 2ND → ${nameOf(target)} (${mode || "?"})`);
  };

  const hostOpenPauseTargetModal = ({ tipo, byId, reason }) => {
    if (!Playroom.isHost()) return { opened: false, auto: false, reqId: null };

    const candidates = computeCandidates(tipo, byId);

    if (candidates.length <= 1) {
      const auto = candidates[0] || getPlayers().find((p) => p.id === byId);
      if (auto) hostApplyTargeted({ tipo, tid: auto.id, byId, mode: "AUTO_SOLO" });
      return { opened: false, auto: true, reqId: null };
    }

    const reqId = hostMakeReqId();

    const ctx = getFlip3Ctx();
    if (ctx) {
      Playroom.setState("flip3Ctx", { ...ctx, paused: true, pauseReqId: reqId });
      LOG.round(`FLIP3: PAUSE (${tipo})`);
    }

    const ctxModal = {
      reqId,
      candidates: candidates.map((p) => ({ id: p.id, name: p.getProfile().name.split(" ")[0] })),
      reason: reason || "",
    };

    Playroom.RPC.call("rpcOpenTargetModal", { tipo, sourceId: byId, ctx: ctxModal }, Playroom.RPC.Mode.ALL);
    toast(`FLIP3 PAUSA: assegna ${tipo}`, "info", 1200 + PLUS2);

    return { opened: true, auto: false, reqId };
  };

  const hostStartPending = ({ tipo, byId }) => {
    if (!Playroom.isHost()) return;
    if (Playroom.getState("partitaFinita")) return;
    if (Playroom.getState("roundEndedByFlip7")) return;
    if (getPendingTarget()) return;
    if (getFlip3Ctx()) return;

    const eligIds = eligibleTurnIds();
    if (eligIds.length === 1) {
      hostApplyTargeted({ tipo, tid: eligIds[0], byId, mode: "AUTO_SOLO" });
      return;
    }

    const candidates = computeCandidates(tipo, byId);
    if (tipo === "2ndCHANCE" && candidates.length === 0) {
      toast("2ND: nessun bersaglio valido, scartata.", "neutral", 1300 + PLUS2);
      LOG.round("2ND: nessun bersaglio valido → scartata");
      return;
    }

    if (candidates.length === 1) {
      hostApplyTargeted({ tipo, tid: candidates[0].id, byId, mode: "AUTO_ONE" });
      return;
    }

    const ctx = {
      reqId: hostMakeReqId(),
      candidates: candidates.map((p) => ({ id: p.id, name: p.getProfile().name.split(" ")[0] })),
    };

    Playroom.setState("pendingTarget", {
      tipo,
      by: byId,
      createdAt: hostNow(),
      until: hostNow() + CFG.TARGET_TIMEOUT_MS,
      ctx,
    });

    Playroom.RPC.call("rpcOpenTargetModal", { tipo, sourceId: byId, ctx }, Playroom.RPC.Mode.ALL);
    toast(`${tipo}: scegli bersaglio`, "info", 1000 + PLUS2);
    LOG.round(`Target: ${nameOf(getPlayers().find((p) => p.id === byId))} sceglie ${tipo}`);
  };

  const hostAutoResolvePendingIfNeeded = () => {
    if (!Playroom.isHost()) return;
    if (getFlip3Ctx()?.paused) return;

    const pt = getPendingTarget();
    if (!pt) return;
    if (hostNow() < (pt.until || 0)) return;

    Playroom.RPC.call("rpcForceCloseTargetModal", { sourceId: pt.by }, Playroom.RPC.Mode.ALL);

    const candidates = computeCandidates(pt.tipo, pt.by);
    if (candidates.length === 0) {
      toast(`${pt.tipo}: timeout (scartata).`, "neutral", 1200 + PLUS2);
      Playroom.setState("pendingTarget", null);
      hostAdvanceTurn("timeout_discard");
      return;
    }

    const t = pick(candidates);
    toast(`${pt.tipo}: auto → ${nameOf(t)}`, "neutral", 1300 + PLUS2);
    hostApplyTargeted({ tipo: pt.tipo, tid: t.id, byId: pt.by, mode: "AUTO_TIMEOUT" });

    Playroom.setState("pendingTarget", null);
    hostAdvanceTurn("timeout_pick");
  };

  // ---------- Confirm target choice ----------
  Playroom.RPC.register("rpcHostConfirmTargetChoice", (d) => {
    if (!Playroom.isHost()) return;

    const reqId = d?.reqId || null;
    const byId = d?.by;
    const tid = d?.tid;
    if (!byId || !tid) return;

    // FLIP3 pause
    const f = getFlip3Ctx();
    if (f && f.paused && f.pauseReqId && reqId === f.pauseReqId) {
      if (byId !== f.targetId) return;

      const pause = Playroom.getState("flip3Pause") || null; // {reqId,tipo,byId,createdAt}
      if (!pause || pause.reqId !== reqId) return;

      const candidates = computeCandidates(pause.tipo, byId);
      if (!candidates.some((p) => p.id === tid)) return;

      hostApplyTargeted({ tipo: pause.tipo, tid, byId, mode: "FLIP3_PAUSE_MANUAL" });

      Playroom.setState("flip3Pause", null);
      Playroom.setState("flip3Ctx", { ...f, paused: false, pauseReqId: null });
      LOG.round("FLIP3: RESUME (manual)");
      return;
    }

    // Normal pending
    const pt = getPendingTarget();
    if (!pt) return;
    if (byId !== pt.by) return;
    if (hostNow() >= (pt.until || 0)) return;

    const candidates2 = computeCandidates(pt.tipo, pt.by);
    if (!candidates2.some((p) => p.id === tid)) return;

    Playroom.RPC.call("rpcForceCloseTargetModal", { sourceId: pt.by }, Playroom.RPC.Mode.ALL);

    hostApplyTargeted({ tipo: pt.tipo, tid, byId: pt.by, mode: "MANUAL" });

    Playroom.setState("pendingTarget", null);
    hostAdvanceTurn("special_manual");
  });

  // ---------- FLIP3 with pause ----------
  const hostStartFlip3 = ({ ownerId, targetId }) => {
    if (!Playroom.isHost()) return;
    if (Playroom.getState("partitaFinita")) return;
    if (Playroom.getState("roundEndedByFlip7")) return;
    if (getFlip3Ctx()) return;

    const target = getPlayers().find((p) => p.id === targetId);
    if (!target) return;
    ensureDefaults(target);
    if (!isEligible(target)) return;

    target.setState("flip3Lock", true);

    Playroom.setState("flip3Ctx", {
      ownerId,
      targetId,
      remaining: 3,
      startedAt: hostNow(),
      paused: false,
      pauseReqId: null,
    });

    toast(`FLIP3 su ${nameOf(target)}: pesca 3`, "info", 1400 + PLUS2);
    LOG.round(`FLIP3: start su ${nameOf(target)}`);

    hostFlip3Schedule();
  };

  const hostEndFlip3 = (reason) => {
    const ctx = getFlip3Ctx();
    if (!ctx) return;

    const target = getPlayers().find((p) => p.id === ctx.targetId);
    if (target) {
      ensureDefaults(target);
      target.setState("flip3Lock", false);
    }

    Playroom.setState("flip3Ctx", null);
    Playroom.setState("flip3Stepping", false);
    Playroom.setState("flip3TimerOn", false);
    Playroom.setState("flip3Pause", null);

    LOG.round(`FLIP3: end (${reason || "ok"})`);

    if (!Playroom.getState("roundEndedByFlip7")) {
      const elig = eligibleTurnIds();
      if (elig.length > 0) {
        const curId = Playroom.getState("turnPid");
        const idx = Math.max(0, elig.indexOf(curId));
        const nextId = elig[(idx + 1) % elig.length];
        Playroom.setState("turnPid", nextId);
        LOG.turn(nextId, "flip3_end");
      }
    }
    hostEnsureValidTurn();
  };

  const hostFlip3Step = async () => {
    const ctx = getFlip3Ctx();
    if (!ctx) return;
    if (ctx.paused) return;

    if (Playroom.getState("flip3Stepping")) return;
    Playroom.setState("flip3Stepping", true);

    try {
      if (Playroom.getState("roundEndedByFlip7")) {
        hostEndFlip3("roundEndedByFlip7");
        return;
      }

      if ((ctx.remaining || 0) <= 0) {
        hostEndFlip3("remaining0");
        return;
      }

      const target = getPlayers().find((p) => p.id === ctx.targetId);
      if (!target) {
        hostEndFlip3("target_left");
        return;
      }
      ensureDefaults(target);
      if (!isEligible(target)) {
        hostEndFlip3("target_not_eligible");
        return;
      }

      const res = await Playroom.RPC.call("rpcHostPlayerDraw", { pid: ctx.targetId, fromFlip3: true }, Playroom.RPC.Mode.HOST);
      if (!res?.ok) return;

      const after = getFlip3Ctx();
      if (!after) return;
      if (after.paused) return;

      Playroom.setState("flip3Ctx", { ...after, remaining: Math.max(0, (after.remaining || 0) - 1) });

      const fin = getFlip3Ctx();
      if (fin && !fin.paused && (fin.remaining || 0) <= 0) hostEndFlip3("done3");
    } finally {
      Playroom.setState("flip3Stepping", false);
    }
  };

  const hostFlip3Schedule = () => {
    if (!Playroom.isHost()) return;
    if (!getFlip3Ctx()) return;
    if (Playroom.getState("flip3TimerOn")) return;

    Playroom.setState("flip3TimerOn", true);

    const tick = async () => {
      const ctx = getFlip3Ctx();
      if (!Playroom.isHost() || !ctx || Playroom.getState("partitaFinita")) {
        Playroom.setState("flip3TimerOn", false);
        return;
      }

      if ((ctx.remaining || 0) <= 0 && !ctx.paused) {
        hostEndFlip3("remaining0");
        Playroom.setState("flip3TimerOn", false);
        return;
      }

      if (ctx.paused) {
        setTimeout(tick, 160);
        return;
      }

      if (hostRoundTransitionLocked() || Playroom.getState("flip3Stepping")) {
        setTimeout(tick, 120);
        return;
      }

      await hostFlip3Step();
      setTimeout(tick, CFG.FLIP3_STEP_MS);
    };

    setTimeout(tick, 0);
  };

  const hostFlip3Watchdog = () => {
    if (!Playroom.isHost()) return;
    const ctx = getFlip3Ctx();
    if (!ctx || !ctx.startedAt) return;
    if (hostNow() - ctx.startedAt < CFG.FLIP3_WATCHDOG_MS + PLUS2) return;
    toast("WATCHDOG: chiudo FLIP3", "neutral", 1200 + PLUS2);
    hostEndFlip3("watchdog");
  };

  // ---------- Host: DRAW ----------
  Playroom.RPC.register("rpcHostPlayerDraw", async (d) => {
    if (!Playroom.isHost()) return { ok: false, reason: "not_host" };

    const pid = d?.pid;
    const fromFlip3 = !!d?.fromFlip3;
    if (!pid) return { ok: false, reason: "no_pid" };

    if (Playroom.getState("partitaFinita")) return { ok: false, reason: "game_over" };
    if (Playroom.getState("roundEndedByFlip7")) return { ok: false, reason: "round_ended" };

    if (!fromFlip3 && hasPendingTarget()) return { ok: false, reason: "pending_target" };
    if (!fromFlip3 && getFlip3Ctx()) return { ok: false, reason: "flip3_running" };

    hostEnsureValidTurn();

    const p = getPlayers().find((x) => x.id === pid);
    if (!p) return { ok: false, reason: "no_player" };
    ensureDefaults(p);
    if (!isEligible(p)) return { ok: false, reason: "not_eligible" };

    if (!fromFlip3) {
      if (Playroom.getState("turnPid") !== pid) return { ok: false, reason: "not_your_turn" };
      if (hostActionLocked() || hostRoundTransitionLocked()) return { ok: false, reason: "locked" };
      hostLockAction(CFG.SERVER_ACTION_COOLDOWN_MS);
      if (p.getState("flip3Lock")) return { ok: false, reason: "flip3_locked" };
    } else {
      if (hostRoundTransitionLocked()) return { ok: false, reason: "transition_lock" };
      if (getFlip3Ctx()?.paused) return { ok: false, reason: "flip3_paused" };
    }

    const card = await hostDrawOne();
    if (!card) return { ok: false, reason: "empty_deck" };

    LOG.draw(p, card);
    p.setState("roundDrawn", [...(p.getState("roundDrawn") || []), card]);

    let tavolo = p.getState("mioTavolo") || [];

    // Duplicate
    if (card.type === "number" && tavolo.some((c) => c.type === "number" && c.value === card.value)) {
      Playroom.RPC.call("rpcFx", { tid: p.id, kind: "BUST" }, Playroom.RPC.Mode.ALL);

      if (p.getState("hasSecondChance")) {
        p.setState("hasSecondChance", false);
        hostPushDiscard([{ type: "special", value: "2ndCHANCE" }, card]);
        toast(`${nameOf(p)} usa 2ND e scarta ${card.value}`, "neutral", 1200 + PLUS2);
        LOG.round(`${nameOf(p)} usa 2ND`);
        if (!fromFlip3) hostAdvanceTurn("draw_2ndsave");
        return { ok: true, card, outcome: "second_saved" };
      }

      tavolo = [...tavolo, card];
      p.setState("mioTavolo", tavolo);
      p.setState("dupValue", card.value);
      p.setState("dupFxUntil", hostNow() + Math.max(2000, CFG.BUST_HOLD_MS));

      toast(`${nameOf(p)} SBALLA (doppio ${card.value})`, "danger", 1700 + PLUS2);
      LOG.bust(p, card.value);

      p.setState("statoRound", "SBALLATO");
      p.setState("hasSecondChance", false);

      hostLockRoundTransition(CFG.BUST_HOLD_MS + CFG.ROUND_TRANSITION_PAD_MS);

      if (fromFlip3) {
        setTimeout(() => {
          hostPushDiscard(p.getState("mioTavolo") || []);
          p.setState("mioTavolo", []);
          p.setState("matchRoundDone", true);
          hostEndFlip3("bust");
        }, CFG.BUST_HOLD_MS);
      } else {
        setTimeout(() => {
          hostPushDiscard(p.getState("mioTavolo") || []);
          p.setState("mioTavolo", []);
          p.setState("matchRoundDone", true);
          hostAdvanceTurn("draw_bust");
        }, CFG.BUST_HOLD_MS);
      }

      return { ok: true, card, outcome: "bust" };
    }

    // 2ND drawn
    if (card.value === "2ndCHANCE") {
      hostPushDiscard([card]);

      if (fromFlip3) {
        const elig = eligibleTurnIds();
        if (elig.length <= 1) {
          if (!p.getState("hasSecondChance")) {
            p.setState("hasSecondChance", true);
            Playroom.RPC.call("rpcFx", { tid: p.id, kind: "SECOND" }, Playroom.RPC.Mode.ALL);
            toast(`2ND CHANCE → ${nameOf(p)}`, "neutral", 1200 + PLUS2);
            LOG.info(`${nameOf(p)} ottiene 2ND (solo)`);
          }
          return { ok: true, card, outcome: "second_auto_self" };
        }

        Playroom.setState("flip3Pause", { reqId: null, tipo: "2ndCHANCE", byId: p.id, createdAt: hostNow() });
        const opened = hostOpenPauseTargetModal({ tipo: "2ndCHANCE", byId: p.id, reason: "flip3_draw_special" });
        if (opened.opened) {
          const pause = Playroom.getState("flip3Pause");
          Playroom.setState("flip3Pause", { ...pause, reqId: opened.reqId });
          return { ok: true, card, outcome: "pause_for_2nd" };
        }
        return { ok: true, card, outcome: "second_auto" };
      }

      hostStartPending({ tipo: "2ndCHANCE", byId: p.id });
      return { ok: true, card, outcome: "pending_target" };
    }

    // add to table
    tavolo = [...tavolo, card];
    p.setState("mioTavolo", tavolo);

    // FREEZE / FLIP3 drawn
    if (card.value === "FREEZE" || card.value === "FLIP3") {
      if (fromFlip3) {
        const elig = eligibleTurnIds();
        if (elig.length <= 1) {
          hostApplyTargeted({ tipo: card.value, tid: p.id, byId: p.id, mode: "AUTO_SOLO" });
          return { ok: true, card, outcome: "special_auto_self" };
        }

        Playroom.setState("flip3Pause", { reqId: null, tipo: card.value, byId: p.id, createdAt: hostNow() });
        const opened = hostOpenPauseTargetModal({ tipo: card.value, byId: p.id, reason: "flip3_draw_special" });
        if (opened.opened) {
          const pause = Playroom.getState("flip3Pause");
          Playroom.setState("flip3Pause", { ...pause, reqId: opened.reqId });
          return { ok: true, card, outcome: "pause_for_special" };
        }

        return { ok: true, card, outcome: "special_auto" };
      }

      hostStartPending({ tipo: card.value, byId: p.id });
      return { ok: true, card, outcome: "pending_target" };
    }

    // FLIP7
    const nums = tavolo.filter((c) => c.type === "number").map((c) => c.value);
    if (new Set(nums).size === 7) {
      const pts = pointsFromCards(tavolo) + CFG.FLIP7_BONUS;

      p.setState("puntiTotali", (p.getState("puntiTotali") || 0) + pts);
      p.setState("statoRound", "FLIP7_WIN");
      p.setState("hasSecondChance", false);

      Playroom.setState("roundEndedByFlip7", true);

      hostPushDiscard(p.getState("mioTavolo") || []);
      p.setState("mioTavolo", []);
      hostPushDiscard(p.getState("pendingActions") || []);
      p.setState("pendingActions", []);
      p.setState("flip3Lock", false);

      p.setState("matchRoundDone", true);

      Playroom.RPC.call("rpcFx", { tid: p.id, kind: "FLIP7" }, Playroom.RPC.Mode.ALL);
      toast(`FLIP7! ${nameOf(p)} +${pts}`, "success", 1800 + PLUS2);
      LOG.round(`FLIP7: ${nameOf(p)} +${pts}`);

      if (fromFlip3) hostEndFlip3("flip7");
      else hostAdvanceTurn("draw_flip7");

      return { ok: true, card, outcome: "flip7" };
    }

    if (!fromFlip3) hostAdvanceTurn("draw");
    return { ok: true, card, outcome: "ok" };
  });

  // ---------- Host: STOP ----------
  Playroom.RPC.register("rpcHostPlayerStop", (d) => {
    if (!Playroom.isHost()) return;

    const pid = d?.pid;
    if (!pid) return;

    if (Playroom.getState("partitaFinita")) return;
    if (Playroom.getState("roundEndedByFlip7")) return;

    if (getFlip3Ctx()) return;
    if (hasPendingTarget()) return;

    hostEnsureValidTurn();
    if (Playroom.getState("turnPid") !== pid) return;
    if (hostActionLocked() || hostRoundTransitionLocked()) return;

    const p = getPlayers().find((x) => x.id === pid);
    if (!p) return;
    ensureDefaults(p);
    if (!isEligible(p)) return;

    const tavolo = p.getState("mioTavolo") || [];
    if (tavolo.length === 0) return;

    hostLockAction(CFG.SERVER_ACTION_COOLDOWN_MS);

    const pts = pointsFromCards(tavolo);

    p.setState("puntiTotali", (p.getState("puntiTotali") || 0) + pts);
    p.setState("statoRound", "STAY");
    p.setState("hasSecondChance", false);

    hostPushDiscard(tavolo);
    p.setState("mioTavolo", []);
    hostPushDiscard(p.getState("pendingActions") || []);
    p.setState("pendingActions", []);
    p.setState("flip3Lock", false);

    p.setState("matchRoundDone", true);

    Playroom.RPC.call("rpcFx", { tid: p.id, kind: "BANK", text: String(pts) }, Playroom.RPC.Mode.ALL);
    toast(`${nameOf(p)} BANK +${pts}`, "success", 1200 + PLUS2);
    LOG.stop(p, pts);

    hostAdvanceTurn("stop");
  });

  // ---------- Match / round end ----------
  function hostMaybeEndMatch() {
    if (!Playroom.isHost()) return;
    if (Playroom.getState("partitaFinita")) return;

    const targetScore = Playroom.getState("matchTarget") || CFG.MATCH_TARGET;

    const ps = getPlayers();
    ps.forEach(ensureDefaults);

    const top = ps
      .map((p) => ({ id: p.id, score: p.getState("puntiTotali") || 0 }))
      .sort((a, b) => b.score - a.score)[0];

    if (!top || top.score < targetScore) return;

    const endedByFlip7 = !!Playroom.getState("roundEndedByFlip7");
    const allDone = ps.length > 0 && ps.every((p) => !!p.getState("matchRoundDone") || !isInGioco(p));
    if (!endedByFlip7 && !allDone) return;

    Playroom.setState("partitaFinita", true);
    Playroom.setState("winnerId", top.id);

    const winner = ps.find((p) => p.id === top.id);
    toast(`PARTITA FINITA: vince ${nameOf(winner)} (${top.score})`, "success", 2200 + PLUS2);
    LOG.round(`MATCH END: ${nameOf(winner)} (${top.score})`);

    Playroom.RPC.call("rpcOpenEndgame", {}, Playroom.RPC.Mode.ALL);
  }

  function hostMaybeEndRound() {
    if (!Playroom.isHost()) return;
    if (Playroom.getState("partitaFinita")) return;

    if (hasPendingTarget()) return;
    if (getFlip3Ctx()) return;

    const ps = getPlayers();
    ps.forEach(ensureDefaults);

    const endedByFlip7 = !!Playroom.getState("roundEndedByFlip7");
    const allDone = ps.length > 0 && ps.every((p) => !!p.getState("matchRoundDone"));

    if (!endedByFlip7 && !allDone) return;

    hostMaybeEndMatch();
    if (Playroom.getState("partitaFinita")) return;

    const leftovers = [];
    ps.forEach((p) => {
      leftovers.push(...(p.getState("mioTavolo") || []));
      leftovers.push(...(p.getState("pendingActions") || []));
    });
    hostPushDiscard(leftovers);

    ps.forEach((p) => {
      p.setState("statoRound", "IN GIOCO");
      p.setState("matchRoundDone", false);
      p.setState("mioTavolo", []);
      p.setState("pendingActions", []);
      p.setState("flip3Lock", false);
      p.setState("hasSecondChance", false);
      p.setState("roundDrawn", []);
      p.setState("dupValue", null);
      p.setState("dupFxUntil", 0);
    });

    Playroom.setState("roundEndedByFlip7", false);
    Playroom.setState("matchRoundIndex", (Playroom.getState("matchRoundIndex") || 1) + 1);

    Playroom.setState("pendingTarget", null);
    Playroom.setState("flip3Ctx", null);
    Playroom.setState("flip3Pause", null);
    Playroom.setState("flip3Stepping", false);
    Playroom.setState("flip3TimerOn", false);

    Playroom.setState("roundLog", []);
    Playroom.RPC.call("rpcSyncLog", { log: [] }, Playroom.RPC.Mode.ALL);

    Playroom.setState("turnPid", ps[0]?.id || null);
    hostEnsureValidTurn();

    toast("NUOVO ROUND", "neutral", 900 + PLUS2);
    LOG.round("ROUND START");
  }

  function hostNewGame() {
    if (!Playroom.isHost()) return;

    const ps = getPlayers();
    ps.forEach(ensureDefaults);

    Playroom.setState("drawPile", generateDeck());
    Playroom.setState("discardPile", []);
    Playroom.setState("partitaFinita", false);
    Playroom.setState("winnerId", null);

    Playroom.setState("pendingTarget", null);
    Playroom.setState("flip3Ctx", null);
    Playroom.setState("flip3Pause", null);
    Playroom.setState("flip3Stepping", false);
    Playroom.setState("flip3TimerOn", false);
    Playroom.setState("roundEndedByFlip7", false);

    Playroom.setState("roundLog", []);
    Playroom.RPC.call("rpcSyncLog", { log: [] }, Playroom.RPC.Mode.ALL);

    Playroom.setState("matchRoundIndex", 1);

    ps.forEach((p) => {
      p.setState("puntiTotali", 0);
      p.setState("statoRound", "IN GIOCO");
      p.setState("matchRoundDone", false);
      p.setState("mioTavolo", []);
      p.setState("pendingActions", []);
      p.setState("flip3Lock", false);
      p.setState("hasSecondChance", false);
      p.setState("roundDrawn", []);
      p.setState("dupValue", null);
      p.setState("dupFxUntil", 0);
    });

    Playroom.setState("turnPid", ps[0]?.id || null);
    hostEnsureValidTurn();

    Playroom.RPC.call("rpcForceCloseTargetModal", {}, Playroom.RPC.Mode.ALL);
    toast("NUOVA PARTITA", "success", 1200 + PLUS2);
    LOG.round("NEW GAME");
  }

  // ---------- HUD ----------
  function computeInPlayCount() {
    let n = 0;
    getPlayers().forEach((p) => {
      n += (p.getState("mioTavolo") || []).length;
      n += (p.getState("pendingActions") || []).length;
    });
    return n;
  }

  const pendingText = () => {
    if (getFlip3Ctx()?.paused) return "FLIP3 IN PAUSA: assegna la speciale";
    const pt = getPendingTarget();
    if (!pt) return null;
    const by = getPlayers().find((p) => p.id === pt.by);
    const left = Math.max(0, Math.ceil(((pt.until || 0) - Date.now()) / 1000));
    return `SCELTA: ${nameOf(by)} assegna ${pt.tipo} (${left}s)`;
  };

  const renderGlobalRank = () => {
    const root = el("global-rank");
    if (!root) return;

    const ps = getPlayers();
    ps.forEach(ensureDefaults);

    const cur = currentTurnPlayer();
    root.innerHTML = "";

    ps.forEach((p) => {
      const score = p.getState("puntiTotali") || 0;
      const stato = p.getState("statoRound") || "IN GIOCO";
      const tavolo = p.getState("mioTavolo") || [];

      const dotClass =
        stato === "IN GIOCO" ? "dot-green" : stato === "STAY" || stato === "FLIP7_WIN" ? "dot-blue" : "dot-red";

      const item = document.createElement("div");
      item.className = "rank-item" + (cur && cur.id === p.id ? " rank-active" : "");

      item.innerHTML = `
        <div class="rank-top">
          <div class="rank-name">${escapeHtml(p.getProfile().name.toUpperCase())}</div>
          <div class="rank-score">${score}</div>
        </div>
        <div class="badge">
          <span class="dot ${dotClass}"></span>
          <span>${escapeHtml(stato)}</span>
          <span style="margin-left:auto;">${p.getState("matchRoundDone") ? "✓" : "…"}</span>
        </div>
      `;

      const minis = document.createElement("div");
      minis.className = "mini-cards";

      const now = Date.now();
      const dupValue = p.getState("dupValue");
      const dupActive = now < (p.getState("dupFxUntil") || 0);

      tavolo.slice(-10).forEach((c) => {
        const isDup = dupActive && c.type === "number" && dupValue != null && c.value === dupValue;
        const m = document.createElement("div");
        m.className = "mini" + (c.type !== "number" ? " special" : "") + (isDup ? " dup-hit flash-strong" : "");
        m.innerText = cardLabel(c);
        minis.appendChild(m);
      });

      item.appendChild(minis);
      root.appendChild(item);
    });
  };

  const renderMyTable = () => {
    const mp = me();
    ensureDefaults(mp);

    const display = el("card-display");
    if (!display) return;

    display.innerHTML = "";

    const now = Date.now();
    const dupValue = mp.getState("dupValue");
    const dupActive = now < (mp.getState("dupFxUntil") || 0);

    (mp.getState("mioTavolo") || []).forEach((c) => {
      const isDup = dupActive && c.type === "number" && dupValue != null && c.value === dupValue;
      const d = document.createElement("div");
      d.className = "card" + (c.type !== "number" ? " special" : "") + (isDup ? " dup-hit" : "");
      d.innerText = cardLabel(c);
      display.appendChild(d);
    });

    if (mp.getState("hasSecondChance")) {
      const shield = document.createElement("div");
      shield.className = "card shield";
      shield.innerText = "🛡️";
      display.appendChild(shield);
    }
  };

  const renderHud = () => {
    const mp = me();
    ensureDefaults(mp);

    const cur = currentTurnPlayer();
    const myTurn = !!cur && cur.id === mp.id && isEligible(mp);

    el("my-score").innerText = mp.getState("puntiTotali") || 0;
    el("round-score").innerText = pointsFromCards(mp.getState("mioTavolo") || []);

    const drawPile = Playroom.getState("drawPile") || [];
    const discardPile = Playroom.getState("discardPile") || [];
    el("deck-info").innerText = `MAZZO ${drawPile.length} · SCARTI ${discardPile.length} · IN GIOCO ${computeInPlayCount()}`;

    el("sc-indicator").style.display = mp.getState("hasSecondChance") ? "inline-flex" : "none";
    el("match-round").innerText = Playroom.getState("matchRoundIndex") || 1;
    el("match-target").innerText = Playroom.getState("matchTarget") || CFG.MATCH_TARGET;

    const lockLine = pendingText();
    const lockBanner = el("lock-banner");
    lockBanner.style.display = lockLine ? "block" : "none";
    if (lockLine) lockBanner.innerText = lockLine;

    const flip3 = getFlip3Ctx();
    const lock = hasPendingTarget() || hostActionLocked() || hostRoundTransitionLocked() || !!flip3;

    el("turn-tip").innerText = flip3 ? (flip3.paused ? "FLIP3 PAUSA" : `FLIP3 (${flip3.remaining})`) : lock ? "LOCK" : myTurn ? "AZIONE" : "ATTESA";

    if (Playroom.getState("partitaFinita")) el("status-bar").innerText = "Partita finita.";
    else if (flip3) {
      const t = getPlayers().find((p) => p.id === flip3.targetId);
      el("status-bar").innerText = flip3.paused
        ? `FLIP3 in pausa (speciale): ${nameOf(t)} sta scegliendo un bersaglio`
        : `FLIP3 su ${nameOf(t)}: ${flip3.remaining} pescate rimaste`;
    } else if (lockLine) el("status-bar").innerText = "Attendi: scelta bersaglio.";
    else if (myTurn) el("status-bar").innerText = "Tocca a te: pesca o fermati.";
    else el("status-bar").innerText = `Tocca a: ${cur ? nameOf(cur) : "—"}`;

    el("btn-pesca").disabled = true;
    el("btn-stop").disabled = true;

    if (!flip3) {
      el("btn-pesca").disabled =
        !!Playroom.getState("partitaFinita") ||
        !!Playroom.getState("roundEndedByFlip7") ||
        (hasPendingTarget() || hostActionLocked() || hostRoundTransitionLocked()) ||
        !myTurn ||
        !!mp.getState("flip3Lock");

      el("btn-stop").disabled =
        !!Playroom.getState("partitaFinita") ||
        !!Playroom.getState("roundEndedByFlip7") ||
        (hasPendingTarget() || hostActionLocked() || hostRoundTransitionLocked()) ||
        !myTurn ||
        !!mp.getState("flip3Lock") ||
        (mp.getState("mioTavolo") || []).length === 0;
    }
  };

  // ---------- Inputs ----------
  const isMeTurn = () => {
    const cur = currentTurnPlayer();
    const mp = me();
    return !!cur && cur.id === mp.id && isEligible(mp);
  };

  el("btn-pesca").onclick = () => {
    const mp = me();
    ensureDefaults(mp);
    if (!isMeTurn()) return;
    if (hasPendingTarget()) return;
    if (getFlip3Ctx()) return;
    if (mp.getState("flip3Lock")) return;
    if (Playroom.getState("partitaFinita")) return;
    Playroom.RPC.call("rpcHostPlayerDraw", { pid: mp.id, fromFlip3: false }, Playroom.RPC.Mode.HOST);
  };

  el("btn-stop").onclick = () => {
    const mp = me();
    ensureDefaults(mp);
    if (!isMeTurn()) return;
    if (hasPendingTarget()) return;
    if (getFlip3Ctx()) return;
    if (mp.getState("flip3Lock")) return;
    if (Playroom.getState("partitaFinita")) return;
    Playroom.RPC.call("rpcHostPlayerStop", { pid: mp.id }, Playroom.RPC.Mode.HOST);
  };

  // ---------- loop ----------
  hostInit();
  let lastHostTick = 0;

  const loop = () => {
    ensureAllDefaults();

    if (Playroom.isHost()) {
      const now = Date.now();
      if (now - lastHostTick > CFG.HOST_TICK_MS) {
        lastHostTick = now;

        hostInit();
        hostEnsureValidTurn();
        hostAutoResolvePendingIfNeeded();
        hostFlip3Watchdog();
        hostMaybeEndRound();
        hostEnsureValidTurn();
      }
    }

    renderHud();
    renderGlobalRank();
    renderMyTable();

    requestAnimationFrame(loop);
  };

  loop();
}
