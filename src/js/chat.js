import * as Playroom from "playroomkit";
import { CFG } from "./cfg.js";
import { el, on } from "./dom.js";
import { escapeHtml } from "./util.js";
import { me } from "./state.js";
import { t } from "./i18n.js";

/**
 * Chat user:
 * - rpcChat: messaggi player (testo già pronto)
 *
 * Chat system localized:
 * - rpcChatSysKey: host manda { key, params } e ogni client traduce con t(key, params)
 */

export function initChatUI() {
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

  // Player chat
  Playroom.RPC.register("rpcChat", (d) => {
    appendChatEverywhere(chatUI, d?.name || "PLAYER", d?.msg || "", "user");
  });

  // System chat localized per-client
  Playroom.RPC.register("rpcChatSysKey", (d) => {
    const name = d?.name || "GAME";
    const key = d?.key || "";
    const params = d?.params || null;
    const msg = key ? t(key, params || {}) : "";

    if (!msg) return;
    appendChatEverywhere(chatUI, name, msg, "system");
  });

  const sendChatFrom = (inputEl) => {
    if (!inputEl) return;
    const msg = String(inputEl.value || "").trim();
    if (!msg) return;
    inputEl.value = "";
    const myName = (me()?.getProfile?.().name || "PLAYER").split(" ")[0];
    Playroom.RPC.call(
      "rpcChat",
      { name: myName, msg: msg.slice(0, 120) },
      Playroom.RPC.Mode.ALL
    );
  };

  if (chatUI.desktop.send()) chatUI.desktop.send().onclick = () => sendChatFrom(chatUI.desktop.text());
  if (chatUI.desktop.text())
    on(chatUI.desktop.text(), "keydown", (e) => e.key === "Enter" && sendChatFrom(chatUI.desktop.text()));

  if (chatUI.mobile.send()) chatUI.mobile.send().onclick = () => sendChatFrom(chatUI.mobile.text());
  if (chatUI.mobile.text())
    on(chatUI.mobile.text(), "keydown", (e) => e.key === "Enter" && sendChatFrom(chatUI.mobile.text()));
}

/**
 * Usata dall'host per inviare eventi di gioco (localizzati lato client).
 */
export function systemChatKey(key, params, name = "GAME") {
  const k = String(key || "").trim();
  if (!k) return;
  Playroom.RPC.call(
    "rpcChatSysKey",
    { name, key: k, params: params || {} },
    Playroom.RPC.Mode.ALL
  );
}

function appendChatEverywhere(chatUI, name, msg, kind) {
  appendChatLineTo(chatUI.desktop.messages(), name, msg, kind);
  appendChatLineTo(chatUI.mobile.messages(), name, msg, kind);
}

function appendChatLineTo(root, name, msg, kind) {
  if (!root) return;

  const line = document.createElement("div");
  line.className = `chat-line ${kind === "system" ? "chat-system" : ""}`;

  const safeName = escapeHtml(String(name).toUpperCase());
  const safeMsg = escapeHtml(String(msg).slice(0, 180));

  line.innerHTML = `<span class="chat-name">${safeName}:</span> <span class="chat-msg">${safeMsg}</span>`;
  root.appendChild(line);

  while (root.children.length > CFG.MAXCHAT) root.removeChild(root.firstChild);
  root.scrollTop = root.scrollHeight;
}
