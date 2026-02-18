import * as Playroom from "playroomkit";
import { CFG, PLUS2 } from "./cfg.js";
import { t, actionLabel, nf } from "./i18n.js";
import {
  hostNow,
  getPlayers,
  ensureDefaults,
  isEligible,
  eligibleTurnIds,
  currentTurnPlayer,
  getFlip3Ctx,
  getPendingTarget
} from "./state.js";
import { generateDeck, pointsFromCards } from "./deck.js";
import { toast } from "./toast.js";
import { LOG } from "./log.js";
import { fxCall } from "./fx.js";
import { pick } from "./util.js";

export function installHostRpcs() {
  Playroom.RPC.register("rpcHostPlayerDraw", hostPlayerDraw);
  Playroom.RPC.register("rpcHostPlayerStop", hostPlayerStop);
  Playroom.RPC.register("rpcHostConfirmTargetChoice", hostConfirmTargetChoice);
}

export function hostInit() {
  if (!Playroom.isHost()) return;

  if (Playroom.getState("drawPile") == null) Playroom.setState("drawPile", generateDeck());
  if (Playroom.getState("discardPile") == null) Playroom.setState("discardPile", []);
  if (Playroom.getState("turnPid") == null) Playroom.setState("turnPid", getPlayers()[0]?.id || null);

  if (Playroom.getState("matchTarget") == null) Playroom.setState("matchTarget", CFG.MATCHTARGET);
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

/**
 * ✅ FIX:
 * - Deve essere idempotente (non spammare setState)
 * - Deve controllare turnPid “attuale” direttamente, non solo currentTurnPlayer()
 */
export function hostEnsureValidTurn() {
  if (!Playroom.isHost()) return;

  const elig = eligibleTurnIds();
  if (elig.length === 0) return;

  const curId = Playroom.getState("turnPid");

  // Se il turnPid è dentro elig, è valido -> non fare niente
  if (curId && elig.includes(curId)) return;

  // Altrimenti fix a elig[0], ma solo se diverso (evita loop)
  const nextId = elig[0];
  if (curId === nextId) return;

  Playroom.setState("turnPid", nextId);
  LOG.turn(nextId, "fix");
}

export function hostActionLocked() {
  return hostNow() < (Playroom.getState("turnActionLockUntil") || 0);
}

export function hostRoundTransitionLocked() {
  return hostNow() < (Playroom.getState("roundTransitionUntil") || 0);
}

export function hostLockAction(ms = CFG.SERVERACTIONCOOLDOWNMS) {
  if (!Playroom.isHost()) return;
  const until = hostNow() + ms;
  Playroom.setState(
    "turnActionLockUntil",
    Math.max(Playroom.getState("turnActionLockUntil") || 0, until)
  );
}

export function hostLockRoundTransition(ms) {
  if (!Playroom.isHost()) return;
  const until = hostNow() + ms;
  Playroom.setState(
    "roundTransitionUntil",
    Math.max(Playroom.getState("roundTransitionUntil") || 0, until)
  );
}

export function hostAdvanceTurn(reason) {
  if (!Playroom.isHost()) return;
  if (getFlip3Ctx()) return;

  const elig = eligibleTurnIds();
  if (elig.length === 0) return;

  const curId = Playroom.getState("turnPid");
  const startIdx = Math.max(0, elig.indexOf(curId));

  // prova a trovare il prossimo id diverso che sia ancora eleggibile
  for (let step = 1; step <= elig.length; step++) {
    const nextId = elig[(startIdx + step) % elig.length];
    if (!nextId) continue;
    if (nextId === curId && elig.length === 1) return;

    Playroom.setState("turnPid", nextId);
    LOG.turn(nextId, reason || "advance");
    return;
  }
}

function hostMakeReqId() {
  const n = (Playroom.getState("reqCounter") || 1) + 1;
  Playroom.setState("reqCounter", n);
  return `req${n}_${Date.now()}`;
}

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
    toast(t("toast.reshuffle"), "neutral", 900 + PLUS2);
    LOG.round(t("log.deckReshuffle"));
  }

  if (drawPile.length === 0) return null;
  const card = drawPile.pop();
  Playroom.setState("drawPile", drawPile);
  return card;
}

function computeCandidates(tipo, byId) {
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
}

function hostApplyTargeted(tipo, tid, byId, mode) {
  const ps = getPlayers();
  const by = ps.find((p) => p.id === byId);
  const target = ps.find((p) => p.id === tid);
  if (!by || !target) return;

  ensureDefaults(by);
  ensureDefaults(target);
  if (!isEligible(target)) return;

  if (tipo === "FREEZE") {
    fxCall(tid, "FREEZE");

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

    fxCall(tid, "BANK", String(pts));
    toast(
      t("toast.freezeBank", {
        player: (target.getProfile().name || "PLAYER").split(" ")[0],
        pts: nf.formatNumber(pts),
      }),
      "info",
      1500 + PLUS2
    );

    LOG.info(
      `${(by.getProfile().name || "PLAYER").split(" ")[0]} ${actionLabel("FREEZE")} → ${(target.getProfile().name || "PLAYER").split(" ")[0]} ${
        mode ? "(" + mode + ")" : ""
      }`.trim()
    );
    return;
  }

  if (tipo === "FLIP3") {
    fxCall(tid, "FLIP3");
    LOG.info(
      `${(by.getProfile().name || "PLAYER").split(" ")[0]} ${actionLabel("FLIP3")} → ${(target.getProfile().name || "PLAYER").split(" ")[0]} ${
        mode ? "(" + mode + ")" : ""
      }`.trim()
    );
    hostStartFlip3(byId, tid);
    return;
  }

  // 2ndCHANCE
  if (target.getState("hasSecondChance")) {
    toast(
      t("toast.secondAlready", {
        player: (target.getProfile().name || "PLAYER").split(" ")[0],
      }),
      "neutral",
      1200 + PLUS2
    );
    LOG.round(t("log.secondDiscard"));
    return;
  }

  target.setState("hasSecondChance", true);
  fxCall(tid, "SECOND");
  toast(
    t("toast.secondGive", {
      player: (target.getProfile().name || "PLAYER").split(" ")[0],
    }),
    "neutral",
    1300 + PLUS2
  );
  LOG.info(
    `${(by.getProfile().name || "PLAYER").split(" ")[0]} ${actionLabel("2ndCHANCE")} → ${(target.getProfile().name || "PLAYER").split(" ")[0]} ${
      mode ? "(" + mode + ")" : ""
    }`.trim()
  );
}


function hostStartPending(tipo, byId) {
  if (!Playroom.isHost()) return;
  if (Playroom.getState("partitaFinita")) return;
  if (Playroom.getState("roundEndedByFlip7")) return;
  if (getPendingTarget()) return;
  if (getFlip3Ctx()) return;

  const candidates = computeCandidates(tipo, byId);

  if (tipo === "2ndCHANCE" && candidates.length === 0) {
    toast(t("toast.secondNoTargets"), "neutral", 1300 + PLUS2);
    LOG.round(t("toast.secondNoTargets"));
    return;
  }

  if (candidates.length === 1) {
    hostApplyTargeted(tipo, candidates[0].id, byId, "AUTOONE");
    hostAdvanceTurn("special:autoone");
    return;
  }

  const ctx = {
    reqId: hostMakeReqId(),
    candidates: candidates.map((p) => ({ id: p.id, name: (p.getProfile().name || "PLAYER").split(" ")[0] })),
  };

  Playroom.setState("pendingTarget", {
    tipo,
    by: byId,
    createdAt: hostNow(),
    until: hostNow() + CFG.TARGETTIMEOUTMS,
    ctx,
  });

  Playroom.RPC.call("rpcOpenTargetModal", { tipo, sourceId: byId, ctx }, Playroom.RPC.Mode.ALL);
  toast(t("toast.chooseTarget", { tipo: actionLabel(tipo) }), "info", 1000 + PLUS2);
}

export function hostAutoResolvePendingIfNeeded() {
  if (!Playroom.isHost()) return;
  const f = getFlip3Ctx();
  if (f?.paused) return;

  const pt = getPendingTarget();
  if (!pt) return;
  if (hostNow() < (pt.until || 0)) return;

  Playroom.RPC.call("rpcForceCloseTargetModal", { sourceId: pt.by }, Playroom.RPC.Mode.ALL);

  const candidates = computeCandidates(pt.tipo, pt.by);
  if (candidates.length === 0) {
    toast(t("toast.timeoutDiscard", { tipo: actionLabel(pt.tipo) }), "neutral", 1200 + PLUS2);
    Playroom.setState("pendingTarget", null);
    hostAdvanceTurn("timeout:discard");
    return;
  }

  const target = pick(candidates);
  toast(
    t("toast.timeoutAuto", { tipo: actionLabel(pt.tipo), player: (target.getProfile().name || "PLAYER").split(" ")[0] }),
    "neutral",
    1300 + PLUS2
  );
  hostApplyTargeted(pt.tipo, target.id, pt.by, "AUTOTIMEOUT");

  Playroom.setState("pendingTarget", null);
  hostAdvanceTurn("timeout:pick");
}

function hostConfirmTargetChoice(d) {
  if (!Playroom.isHost()) return;

  const reqId = d?.reqId || null;
  const byId = d?.by;
  const tid = d?.tid;
  if (!byId || !tid) return;

  // FLIP3 pause path (v220)
  const f = getFlip3Ctx();
  if (f && f.paused && f.pauseReqId && reqId && f.pauseReqId === reqId) {
    if (byId !== f.targetId) return;
    const pause = Playroom.getState("flip3Pause") || null;
    if (!pause || pause.reqId !== reqId) return;

    const candidates = computeCandidates(pause.tipo, byId);
    if (!candidates.some(p => p.id === tid)) return;

    hostApplyTargeted(pause.tipo, tid, byId, "FLIP3PAUSEMANUAL");
    Playroom.setState("flip3Pause", null);
    Playroom.setState("flip3Ctx", { ...f, paused: false, pauseReqId: null });
    LOG.round(t("log.flip3Resume"));
    return;
  }

  // normal pending
  const pt = getPendingTarget();
  if (!pt) return;
  if (byId !== pt.by) return;
  if (hostNow() > (pt.until || 0)) return;

  const candidates = computeCandidates(pt.tipo, pt.by);
  if (!candidates.some(p => p.id === tid)) return;

  Playroom.RPC.call("rpcForceCloseTargetModal", { sourceId: pt.by }, Playroom.RPC.Mode.ALL);
  hostApplyTargeted(pt.tipo, tid, pt.by, "MANUAL");
  Playroom.setState("pendingTarget", null);
  hostAdvanceTurn("special:manual");
}

function hostStartFlip3(ownerId, targetId) {
  if (!Playroom.isHost()) return;
  if (Playroom.getState("partitaFinita")) return;
  if (Playroom.getState("roundEndedByFlip7")) return;
  if (getFlip3Ctx()) return;

  const target = getPlayers().find(p => p.id === targetId);
  if (!target) return;
  ensureDefaults(target);
  if (!isEligible(target)) return;

  target.setState("flip3Lock", true);
  Playroom.setState("flip3Ctx", { ownerId, targetId, remaining: 3, startedAt: hostNow(), paused: false, pauseReqId: null });

  toast(t("toast.flip3Start", { player: (target.getProfile().name || "PLAYER").split(" ")[0] }), "info", 1400 + PLUS2);
  LOG.round(t("log.flip3Start", { player: (target.getProfile().name || "PLAYER").split(" ")[0] }));

  hostFlip3Schedule();
}

function hostEndFlip3(reason) {
  const ctx = getFlip3Ctx();
  if (!ctx) return;

  const target = getPlayers().find(p => p.id === ctx.targetId);
  if (target) {
    ensureDefaults(target);
    target.setState("flip3Lock", false);
  }

  Playroom.setState("flip3Ctx", null);
  Playroom.setState("flip3Stepping", false);
  Playroom.setState("flip3TimerOn", false);
  Playroom.setState("flip3Pause", null);

  LOG.round(t("log.flip3End", { reason: reason || "ok" }));

  if (!Playroom.getState("roundEndedByFlip7")) {
    const elig = eligibleTurnIds();
    if (elig.length) {
      const curId = Playroom.getState("turnPid");
      const idx = Math.max(0, elig.indexOf(curId));
      const nextId = elig[(idx + 1) % elig.length];
      Playroom.setState("turnPid", nextId);
      LOG.turn(nextId, "flip3end");
    }
    hostEnsureValidTurn();
  }
}

async function hostFlip3Step() {
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

    const target = getPlayers().find(p => p.id === ctx.targetId);
    if (!target) { hostEndFlip3("targetleft"); return; }
    ensureDefaults(target);
    if (!isEligible(target)) { hostEndFlip3("targetnoteligible"); return; }

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
}

function hostFlip3Schedule() {
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
    if (ctx.paused) { setTimeout(tick, 160); return; }
    if (hostRoundTransitionLocked() || Playroom.getState("flip3Stepping")) { setTimeout(tick, 120); return; }

    await hostFlip3Step();
    setTimeout(tick, CFG.FLIP3STEPMS);
  };

  setTimeout(tick, 0);
}

export function hostFlip3Watchdog() {
  if (!Playroom.isHost()) return;
  const ctx = getFlip3Ctx();
  if (!ctx || !ctx.startedAt) return;
  if (hostNow() - ctx.startedAt < (CFG.FLIP3WATCHDOGMS + PLUS2)) return;
  toast(t("toast.watchdogClose"), "neutral", 1200 + PLUS2);
  hostEndFlip3("watchdog");
}

async function hostPlayerDraw(d) {
  if (!Playroom.isHost()) return { ok: false, reason: "nothost" };

  const pid = d?.pid;
  const fromFlip3 = !!d?.fromFlip3;
  if (!pid) return { ok: false, reason: "nopid" };

  if (Playroom.getState("partitaFinita")) return { ok: false, reason: "gameover" };
  if (Playroom.getState("roundEndedByFlip7")) return { ok: false, reason: "roundended" };

  if (!fromFlip3 && getPendingTarget()) return { ok: false, reason: "pendingtarget" };
  if (!fromFlip3 && getFlip3Ctx()) return { ok: false, reason: "flip3running" };

  hostEnsureValidTurn();

  const p = getPlayers().find(x => x.id === pid);
  if (!p) return { ok: false, reason: "noplayer" };
  ensureDefaults(p);
  if (!isEligible(p)) return { ok: false, reason: "noteligible" };

  if (!fromFlip3) {
    if (Playroom.getState("turnPid") !== pid) return { ok: false, reason: "notyourturn" };
    if (hostActionLocked() || hostRoundTransitionLocked()) return { ok: false, reason: "locked" };
    hostLockAction(CFG.SERVERACTIONCOOLDOWNMS);
    if (p.getState("flip3Lock")) return { ok: false, reason: "flip3locked" };
  } else {
    if (hostRoundTransitionLocked()) return { ok: false, reason: "transitionlock" };
    if (getFlip3Ctx()?.paused) return { ok: false, reason: "flip3paused" };
  }

  const card = await hostDrawOne();
  if (!card) return { ok: false, reason: "emptydeck" };
  LOG.draw(p, card);

  p.setState("roundDrawn", [...(p.getState("roundDrawn") || []), card]);
  let tavolo = p.getState("mioTavolo") || [];

  // DUPLICATE number
  if (card.type === "number" && tavolo.some(c => c.type === "number" && c.value === card.value)) {
    fxCall(p.id, "BUST");

    if (p.getState("hasSecondChance")) {
      p.setState("hasSecondChance", false);
      hostPushDiscard([{ type: "special", value: "2ndCHANCE" }, card]);
      toast(t("toast.useSecond", { player: (p.getProfile().name || "PLAYER").split(" ")[0], val: card.value }), "neutral", 1200 + PLUS2);
      if (!fromFlip3) hostAdvanceTurn("draw:2ndsave");
      return { ok: true, card, outcome: "secondsaved" };
    }

    tavolo = [...tavolo, card];
    p.setState("mioTavolo", tavolo);
    p.setState("dupValue", card.value);
    p.setState("dupFxUntil", hostNow() + Math.max(2000, CFG.BUSTHOLDMS));

    toast(t("toast.bust", { player: (p.getProfile().name || "PLAYER").split(" ")[0], val: card.value }), "danger", 1700 + PLUS2);
    LOG.bust(p, card.value);

    p.setState("statoRound", "SBALLATO");
    p.setState("hasSecondChance", false);

    hostLockRoundTransition(CFG.BUSTHOLDMS + CFG.ROUNDTRANSITIONPADMS);

    if (fromFlip3) {
      setTimeout(() => {
        hostPushDiscard(p.getState("mioTavolo") || []);
        p.setState("mioTavolo", []);
        p.setState("matchRoundDone", true);
        hostEndFlip3("bust");
      }, CFG.BUSTHOLDMS);
    } else {
      setTimeout(() => {
        hostPushDiscard(p.getState("mioTavolo") || []);
        p.setState("mioTavolo", []);
        p.setState("matchRoundDone", true);
        hostAdvanceTurn("draw:bust");
      }, CFG.BUSTHOLDMS);
    }
    return { ok: true, card, outcome: "bust" };
  }

  // SPECIAL draw: 2ndCHANCE
  if (card.type === "special" && card.value === "2ndCHANCE") {
    hostPushDiscard([card]);

    if (fromFlip3) {
      const elig = eligibleTurnIds();
      if (elig.length === 1) {
        if (!p.getState("hasSecondChance")) {
          p.setState("hasSecondChance", true);
          fxCall(p.id, "SECOND");
          toast(t("toast.secondGive", { player: (p.getProfile().name || "PLAYER").split(" ")[0] }), "neutral", 1200 + PLUS2);
        }
        return { ok: true, card, outcome: "secondautoself" };
      }

      // PAUSE FLIP3: open target modal (by target player)
      const candidates = computeCandidates("2ndCHANCE", p.id);
      const reqId = hostMakeReqId();
      const ctx = getFlip3Ctx();
      Playroom.setState("flip3Ctx", { ...ctx, paused: true, pauseReqId: reqId });
      Playroom.setState("flip3Pause", { reqId, tipo: "2ndCHANCE", byId: p.id, createdAt: hostNow() });

      Playroom.RPC.call("rpcOpenTargetModal", {
        tipo: "2ndCHANCE",
        sourceId: p.id,
        ctx: { reqId, candidates: candidates.map(x => ({ id: x.id, name: (x.getProfile().name || "PLAYER").split(" ")[0] })) }
      }, Playroom.RPC.Mode.ALL);

      toast(t("toast.flip3PauseAssign", { tipo: actionLabel("2ndCHANCE") }), "info", 1200 + PLUS2);
      return { ok: true, card, outcome: "pausefor2nd" };
    }

    hostStartPending("2ndCHANCE", p.id);
    return { ok: true, card, outcome: "pendingtarget" };
  }

  // SPECIAL draw: FREEZE / FLIP3
  if (card.type === "special" && (card.value === "FREEZE" || card.value === "FLIP3")) {
    if (fromFlip3) {
      const elig = eligibleTurnIds();
      if (elig.length === 1) {
        hostApplyTargeted(card.value, p.id, p.id, "AUTOSOLO");
        return { ok: true, card, outcome: "specialautoself" };
      }

      const candidates = computeCandidates(card.value, p.id);
      const reqId = hostMakeReqId();
      const ctx = getFlip3Ctx();
      Playroom.setState("flip3Ctx", { ...ctx, paused: true, pauseReqId: reqId });
      Playroom.setState("flip3Pause", { reqId, tipo: card.value, byId: p.id, createdAt: hostNow() });

      Playroom.RPC.call("rpcOpenTargetModal", {
        tipo: card.value,
        sourceId: p.id,
        ctx: { reqId, candidates: candidates.map(x => ({ id: x.id, name: (x.getProfile().name || "PLAYER").split(" ")[0] })) }
      }, Playroom.RPC.Mode.ALL);

      toast(t("toast.flip3PauseAssign", { tipo: actionLabel(card.value) }), "info", 1200 + PLUS2);
      return { ok: true, card, outcome: "pauseforspecial" };
    }

    hostStartPending(card.value, p.id);
    return { ok: true, card, outcome: "pendingtarget" };
  }

  // add to table
  tavolo = [...tavolo, card];
  p.setState("mioTavolo", tavolo);

  // FLIP7
  const nums = tavolo.filter(c => c.type === "number").map(c => c.value);
  if (new Set(nums).size >= 7) {
    const pts = pointsFromCards(tavolo) + CFG.FLIP7BONUS;
    p.setState("puntiTotali", (p.getState("puntiTotali") || 0) + pts);
    p.setState("statoRound", "FLIP7WIN");
    p.setState("hasSecondChance", false);

    Playroom.setState("roundEndedByFlip7", true);

    hostPushDiscard(p.getState("mioTavolo") || []);
    p.setState("mioTavolo", []);

    hostPushDiscard(p.getState("pendingActions") || []);
    p.setState("pendingActions", []);

    p.setState("flip3Lock", false);
    p.setState("matchRoundDone", true);

    fxCall(p.id, "FLIP7");
    toast(t("toast.flip7", { player: (p.getProfile().name || "PLAYER").split(" ")[0], pts: nf.formatNumber(pts) }), "success", 1800 + PLUS2);
    LOG.round(`FLIP7 ${(p.getProfile().name || "PLAYER").split(" ")[0]} ${nf.formatNumber(pts)}`);

    if (fromFlip3) hostEndFlip3("flip7");
    else hostAdvanceTurn("draw:flip7");

    return { ok: true, card, outcome: "flip7" };
  }

  if (!fromFlip3) hostAdvanceTurn("draw");
  return { ok: true, card, outcome: "ok" };
}

function hostPlayerStop(d) {
  if (!Playroom.isHost()) return;

  const pid = d?.pid;
  if (!pid) return;

  if (Playroom.getState("partitaFinita")) return;
  if (Playroom.getState("roundEndedByFlip7")) return;
  if (getFlip3Ctx()) return;
  if (getPendingTarget()) return;

  hostEnsureValidTurn();
  if (Playroom.getState("turnPid") !== pid) return;
  if (hostActionLocked() || hostRoundTransitionLocked()) return;

  const p = getPlayers().find(x => x.id === pid);
  if (!p) return;
  ensureDefaults(p);
  if (!isEligible(p)) return;

  const tavolo = p.getState("mioTavolo") || [];
  if (tavolo.length === 0) return;

  hostLockAction(CFG.SERVERACTIONCOOLDOWNMS);

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

  fxCall(p.id, "BANK", String(pts));
  toast(t("toast.bank", { player: (p.getProfile().name || "PLAYER").split(" ")[0], pts: nf.formatNumber(pts) }), "success", 1200 + PLUS2);
  LOG.stop(p, nf.formatNumber(pts));

  hostAdvanceTurn("stop");
}

export function hostMaybeEndRoundAndMatch() {
  if (!Playroom.isHost()) return;
  if (Playroom.getState("partitaFinita")) return;
  if (getPendingTarget()) return;
  if (getFlip3Ctx()) return;

  const ps = getPlayers();
  ps.forEach(ensureDefaults);

  const endedByFlip7 = !!Playroom.getState("roundEndedByFlip7");
  const allDone = ps.length > 0 && ps.every(p => !!p.getState("matchRoundDone"));
  if (!endedByFlip7 && !allDone) return;

  // match end?
  const targetScore = Playroom.getState("matchTarget") || CFG.MATCHTARGET;
  const top = ps.map(p => ({ id: p.id, score: p.getState("puntiTotali") || 0 })).sort((a, b) => b.score - a.score)[0];
  if (top && top.score >= targetScore) {
    Playroom.setState("partitaFinita", true);
    Playroom.setState("winnerId", top.id);
    const winner = ps.find(p => p.id === top.id);
    toast(t("toast.matchEnd", { player: (winner?.getProfile().name || "PLAYER").split(" ")[0], score: nf.formatNumber(top.score) }), "success", 2200 + PLUS2);
    Playroom.RPC.call("rpcOpenEndgame", {}, Playroom.RPC.Mode.ALL);
    return;
  }

  // end round reset
  const leftovers = [];
  ps.forEach(p => {
    leftovers.push(...(p.getState("mioTavolo") || []));
    leftovers.push(...(p.getState("pendingActions") || []));
  });
  hostPushDiscard(leftovers);

  ps.forEach(p => {
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

  toast(t("toast.newRound"), "neutral", 900 + PLUS2);
  LOG.round(t("log.roundStart"));
}

export function hostNewGame() {
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

  ps.forEach(p => {
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
  toast(t("toast.newGame"), "success", 1200 + PLUS2);
  LOG.round(t("log.newGame"));
}
