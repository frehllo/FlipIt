import * as Playroom from "playroomkit";
import { el } from "./dom.js";
import { CFG } from "./cfg.js";
import { t } from "./i18n.js";
import { getPlayers, nameOf } from "./state.js";
import { cardLabel } from "./deck.js";

export function installLogRpcs(){
  Playroom.RPC.register("rpcLogEvent", (d) => { if (Playroom.isHost) logPush(d); });

  Playroom.RPC.register("rpcSyncLog", (d) => {
    const root = el("round-log");
    if (!root) return;
    root.innerHTML = "";
    (d?.log || []).slice(0, CFG.MAXLOG).reverse().forEach(x => {
      const chip = document.createElement("div");
      chip.className = `chip ${x.type || "neutral"}`;
      chip.innerText = x.text || "";
      root.appendChild(chip);
    });
  });
}

export function logPush(entry){
  if (!Playroom.isHost){
    Playroom.RPC.call("rpcLogEvent", entry, Playroom.RPC.Mode.HOST);
    return;
  }
  const arr = Playroom.getState("roundLog") || [];
  const next = [{ ...entry, t: Date.now() }, ...arr].slice(0, CFG.MAXLOG);
  Playroom.setState("roundLog", next);
  Playroom.RPC.call("rpcSyncLog", { log: next }, Playroom.RPC.Mode.ALL);
}

export const LOG = {
  turn(pid, reason){
    const p = getPlayers().find(x => x.id === pid) || null;
    logPush({ type:"neutral", text: t("log.turn", { player: p ? nameOf(p) : "???", reason }) });
  },
  draw(p, card){ logPush({ type:"neutral", text: t("log.draw", { player:nameOf(p), card: cardLabel(card) }) }); },
  stop(p, pts){ logPush({ type:"success", text: t("log.stop", { player:nameOf(p), pts }) }); },
  bust(p, val){ logPush({ type:"danger", text: t("log.bust", { player:nameOf(p), val }) }); },
  info(text){ logPush({ type:"info", text }); },
  round(text){ logPush({ type:"neutral", text }); },
};
