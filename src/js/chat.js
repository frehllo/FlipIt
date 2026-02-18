import * as Playroom from "playroomkit";
import { CFG } from "./cfg.js";
import { el, on } from "./dom.js";
import { escapeHtml } from "./util.js";
import { me } from "./state.js";

export function initChatUI(){
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

  Playroom.RPC.register("rpcChat", (d) => appendChatEverywhere(chatUI, d?.name || "PLAYER", d?.msg || ""));

  const sendChatFrom = (inputEl) => {
    if (!inputEl) return;
    const msg = String(inputEl.value || "").trim();
    if (!msg) return;
    inputEl.value = "";
    const myName = (me()?.getProfile?.().name || "PLAYER").split(" ")[0];
    Playroom.RPC.call("rpcChat", { name: myName, msg: msg.slice(0, 120) }, Playroom.RPC.Mode.ALL);
  };

  if (chatUI.desktop.send()) chatUI.desktop.send().onclick = () => sendChatFrom(chatUI.desktop.text());
  if (chatUI.desktop.text()) on(chatUI.desktop.text(), "keydown", (e) => e.key === "Enter" && sendChatFrom(chatUI.desktop.text()));

  if (chatUI.mobile.send()) chatUI.mobile.send().onclick = () => sendChatFrom(chatUI.mobile.text());
  if (chatUI.mobile.text()) on(chatUI.mobile.text(), "keydown", (e) => e.key === "Enter" && sendChatFrom(chatUI.mobile.text()));
}

function appendChatEverywhere(chatUI, name, msg){
  appendChatLineTo(chatUI.desktop.messages(), name, msg);
  appendChatLineTo(chatUI.mobile.messages(), name, msg);
}

function appendChatLineTo(root, name, msg){
  if (!root) return;
  const line = document.createElement("div");
  line.className = "chat-line";
  line.innerHTML = `<span class="chat-name">${escapeHtml(String(name).toUpperCase())}:</span> <span class="chat-msg">${escapeHtml(String(msg).slice(0,120))}</span>`;
  root.appendChild(line);
  while (root.children.length > CFG.MAXCHAT) root.removeChild(root.firstChild);
  root.scrollTop = root.scrollHeight;
}
