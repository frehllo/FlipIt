import * as Playroom from "playroomkit";
import { el } from "./dom.js";
import { CFG } from "./cfg.js";
import { rand } from "./util.js";
import { t, actionLabel } from "./i18n.js";
import { me } from "./state.js";

// singleton locale (serve per fxIsBusy)
let _fx = null;

export function fxIsBusy() {
  return _fx?.isBusy?.() ?? false;
}

export function installFxRpc() {
  if (window.__fxRpcInstalled) return;
  window.__fxRpcInstalled = true;

  _fx = createFxLocal();

  Playroom.RPC.register("rpcFx", (d) => {
    const tid = d?.tid;
    if (!tid) return;
    if (me().id !== tid) return;
    _fx.run(d.kind, d.text);
  });
}

function createFxLocal() {
  const layer = el("fx-layer");

  // ---- FX QUEUE (serial: overlay + text + particles) ----
  let q = [];
  let running = false;
  let busyUntil = 0;

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const STEP_MS = Math.max(CFG.FX.TEXTMS ?? 950, CFG.FX.OVERLAYMS ?? 850) + 120;

  const enqueue = (fn) => {
    q.push(fn);
    pump();
  };

  async function pump() {
    if (running) return;
    running = true;
    try {
      while (q.length) {
        const job = q.shift();
        await job();
      }
    } finally {
      running = false;
    }
  }

  const isBusy = () => running || q.length > 0 || Date.now() < busyUntil;

  const addOverlay = (cls) => {
    if (!layer) return;
    const d = document.createElement("div");
    d.className = cls;
    layer.appendChild(d);
    setTimeout(() => d.remove(), (CFG.FX.OVERLAYMS ?? 850) + 120);
  };

  const addText = (text) => {
    if (!layer) return;
    const tEl = document.createElement("div");
    tEl.className = "fx-text";
    tEl.innerText = text;
    layer.appendChild(tEl);
    setTimeout(() => tEl.remove(), (CFG.FX.TEXTMS ?? 950) + 160);
  };

  const addParticles = (className, glyph, count) => {
    if (!layer) return;
    const n = Math.max(0, count | 0);
    for (let i = 0; i < n; i++) {
      const p = document.createElement("div");
      p.className = className;
      p.innerText = glyph;

      const x = rand(2, 98);
      const size = rand(CFG.FX.SIZEMINPX ?? 14, CFG.FX.SIZEMAXPX ?? 26);
      const dur = rand(CFG.FX.FALLMINMS ?? 750, CFG.FX.FALLMAXMS ?? 1400);
      const delay = rand(0, 160);
      const rot = rand(-35, 35);

      p.style.left = `${x}vw`;
      p.style.fontSize = `${size}px`;
      p.style.animationDuration = `${dur}ms`;
      p.style.animationDelay = `${delay}ms`;
      p.style.transform = `rotate(${rot}deg)`;

      layer.appendChild(p);
      setTimeout(() => p.remove(), dur + delay + 200);
    }
  };

  const runNow = (kind, text) => {
    if (kind === "FREEZE") {
      addOverlay("freeze-overlay");
      addText(t("fx.freeze"));
      addParticles("snowflake", "❄️", CFG.FX.PARTICLES?.FREEZE ?? 28);
    } else if (kind === "FLIP3") {
      addOverlay("flip3-overlay");
      addText(t("fx.flip3"));
      addParticles("giftpop", "🎁", CFG.FX.PARTICLES?.FLIP3 ?? 28);
    } else if (kind === "SECOND") {
      addOverlay("sc-overlay");
      addText(t("fx.second"));
      addParticles("shieldpop", "🛡️", CFG.FX.PARTICLES?.SECOND ?? 26);
    } else if (kind === "BUST") {
      addOverlay("bust-overlay");
      addText(t("fx.bust"));
      addParticles("dangerpop", "💥", CFG.FX.PARTICLES?.BUST ?? 34);
    } else if (kind === "FLIP7") {
      addOverlay("flip7-overlay");
      addText(t("fx.flip7"));
      addParticles("starpop", "✨", CFG.FX.PARTICLES?.FLIP7 ?? 40);
    } else if (kind === "BANK") {
      addOverlay("bank-overlay");
      addText(`${t("fx.bank")} ${text || ""}`.trim());
      addParticles("coinpop", "🪙", CFG.FX.PARTICLES?.BANK ?? 32);
    }
  };

  const run = (kind, text) => {
    // lock immediato: blocca input anche se sei tra due job
    busyUntil = Math.max(busyUntil, Date.now() + STEP_MS);

    enqueue(async () => {
      runNow(kind, text);
      await wait(STEP_MS);
    });
  };

  return { run, isBusy };
}

export function fxCall(tid, kind, text) {
  Playroom.RPC.call("rpcFx", { tid, kind, text }, Playroom.RPC.Mode.ALL);
}
