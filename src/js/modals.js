import * as Playroom from "playroomkit";
import { el, on } from "./dom.js";
import { t, actionLabel } from "./i18n.js";
import { me } from "./state.js";
import { iconFor } from "./deck.js";

export function initInfoModal() {
  const infoModal = el("info-modal");
  const openInfo = () => infoModal && (infoModal.style.display = "grid");
  const closeInfo = () => infoModal && (infoModal.style.display = "none");

  if (el("btn-info")) el("btn-info").onclick = openInfo;
  if (el("info-close")) el("info-close").onclick = closeInfo;
  if (infoModal) on(infoModal, "click", (e) => e.target === infoModal && closeInfo());
}

export function installTargetModalRpcs() {
  Playroom.RPC.register("rpcOpenTargetModal", (d) => {
    const mine = me();
    if (!mine?.id) return;

    if (!d?.sourceId) return;
    if (mine.id !== d.sourceId) return;

    openTargetModalClient(d.tipo, d?.ctx || null);
  });

  Playroom.RPC.register("rpcForceCloseTargetModal", (d) => {
    const modal = el("target-modal");
    if (!modal) return;

    const mine = me();
    const sourceId = d?.sourceId;

    // Se sourceId è presente, chiudi solo per quel client.
    if (sourceId && mine?.id && mine.id !== sourceId) return;

    modal.style.display = "none";
  });

  // UX: ESC chiude la modale localmente (non inviamo cancel all'host)
  on(window, "keydown", (e) => {
    if (e.key !== "Escape") return;
    const modal = el("target-modal");
    if (!modal) return;
    if (modal.style.display === "grid") modal.style.display = "none";
  });
}

function openTargetModalClient(tipo, ctx) {
  const modal = el("target-modal");
  const opts = el("target-options");
  const title = el("modal-title");
  const closeBtn = el("modal-close");
  const iconBox = el("modal-special-icon");

  if (!modal || !opts || !title || !closeBtn || !iconBox) return;

  // reqId è fondamentale per distinguere pending vs flip3-pause
  const reqId = ctx?.reqId || null;

  iconBox.style.display = "grid";
  iconBox.innerText = iconFor(tipo);
  title.innerText = `${t("hud.chooseTargetTitle")} — ${actionLabel(tipo)}`;

  opts.innerHTML = "";

  // In questa versione non usiamo "Chiudi" (niente cancel RPC),
  // quindi lo nascondiamo per evitare aspettative.
  closeBtn.style.display = "none";
  closeBtn.onclick = null;

  const candidates = Array.isArray(ctx?.candidates) ? ctx.candidates.map((x) => ({ id: x.id, name: x.name })) : [];
  if (candidates.length === 0) {
    modal.style.display = "none";
    return;
  }

  modal.style.display = "grid";

  candidates.forEach((p) => {
    const b = document.createElement("button");
    b.className = "px-btn px-btn-secondary";
    b.innerText = p.id === me().id ? `${t("hud.meMyself")} (${p.name})` : p.name;

    b.onclick = () => {
      // se manca reqId, non inviamo niente: evita conferme “orfane”
      if (!reqId) {
        modal.style.display = "none";
        return;
      }

      opts.querySelectorAll("button").forEach((x) => (x.disabled = true));
      modal.style.display = "none";

      Playroom.RPC.call(
        "rpcHostConfirmTargetChoice",
        { reqId, by: me().id, tid: p.id },
        Playroom.RPC.Mode.HOST
      );
    };

    opts.appendChild(b);
  });
}
