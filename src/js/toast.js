import * as Playroom from "playroomkit";
import { el } from "./dom.js";
import { CFG } from "./cfg.js";

export function installToastRpc(){
  Playroom.RPC.register("rpcToast", (d) => {
    const container = el("game-alerts");
    if (!container) return;
    const div = document.createElement("div");
    div.className = `toast ${d?.type || "neutral"}`;
    div.innerText = d?.text || "";
    container.appendChild(div);
    while (container.children.length > CFG.MAXTOASTS) container.removeChild(container.firstChild);
    setTimeout(() => div.remove(), d?.ms || CFG.TOASTMSDEFAULT);
  });
}

export function toast(text, type="neutral", ms=CFG.TOASTMSDEFAULT){
  Playroom.RPC.call("rpcToast", { text, type, ms }, Playroom.RPC.Mode.ALL);
}
