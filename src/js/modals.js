import * as Playroom from "playroomkit";
import { el, on } from "./dom.js";
import { t, actionLabel } from "./i18n.js";
import { me } from "./state.js";
import { iconFor } from "./deck.js";

export function initInfoModal(){
  const infoModal = el("info-modal");
  const openInfo = () => infoModal && (infoModal.style.display = "grid");
  const closeInfo = () => infoModal && (infoModal.style.display = "none");
  if (el("btn-info")) el("btn-info").onclick = openInfo;
  if (el("info-close")) el("info-close").onclick = closeInfo;
  if (infoModal) on(infoModal, "click", (e) => e.target === infoModal && closeInfo());
}

export function installTargetModalRpcs(){
  Playroom.RPC.register("rpcOpenTargetModal", (d) => {
    if (!d?.sourceId) return;
    if (me().id !== d.sourceId) return;
    openTargetModalClient(d.tipo, d?.ctx || null);
  });

  Playroom.RPC.register("rpcForceCloseTargetModal", (d) => {
    const modal = el("target-modal");
    if (!modal) return;
    if (d?.sourceId && me().id !== d.sourceId) return;
    modal.style.display = "none";
  });
}

function openTargetModalClient(tipo, ctx){
  const modal = el("target-modal");
  const opts = el("target-options");
  const title = el("modal-title");
  const closeBtn = el("modal-close");
  const iconBox = el("modal-special-icon");
  if (!modal || !opts || !title || !closeBtn || !iconBox) return;

  iconBox.style.display = "grid";
  iconBox.innerText = iconFor(tipo);
  title.innerText = `${t("hud.chooseTargetTitle")} — ${actionLabel(tipo)}`;

  opts.innerHTML = "";
  closeBtn.style.display = "none";
  closeBtn.onclick = null;

  const candidates = (ctx?.candidates || []).map(x => ({ id:x.id, name:x.name }));
  if (candidates.length === 0){
    modal.style.display = "none";
    return;
  }

  modal.style.display = "grid";

  candidates.forEach(p => {
    const b = document.createElement("button");
    b.className = "px-btn px-btn-secondary";
    b.innerText = p.id === me().id ? `${t("hud.meMyself")} (${p.name})` : p.name;
    b.onclick = () => {
      opts.querySelectorAll("button").forEach(x => x.disabled = true);
      modal.style.display = "none";
      Playroom.RPC.call("rpcHostConfirmTargetChoice", { reqId: ctx.reqId, by: me().id, tid: p.id }, Playroom.RPC.Mode.HOST);
    };
    opts.appendChild(b);
  });
}
