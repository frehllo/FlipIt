import * as Playroom from "playroomkit";
import { setLocale, getLocale, applyI18n } from "./i18n.js";
import { installFxRpc } from "./fx.js";
import { installToastRpc } from "./toast.js";
import { LOG } from "./log.js";
import { initChatUI } from "./chat.js";
import { initInfoModal, installTargetModalRpcs } from "./modals.js";
import { installEndgameRpcs } from "./endgame.js";
import {
  installHostRpcs,
  hostNewGame,
  hostActionLocked,
  hostRoundTransitionLocked,
} from "./host.js";
import { initInputs } from "./input.js";
import { startLoop } from "./loop.js";
import { el } from "./dom.js";
import { renderHud, renderGlobalRank, renderMyTable } from "./render.js"; // ✅ Già corretto

if (import.meta.hot) import.meta.hot.decline();

if (!window.flip7mainstarted) {
  window.flip7mainstarted = true;
  boot();
}

async function boot() {
  await Playroom.insertCoin({
    gameId: "flip7-pixel-v220-chat-desktop-mobile-modal",
    skipLobby: false,
  });

  // i18n init
  setLocale(getLocale());
  applyI18n();

  // language toggle + label (shows the *next* language)
  const updateLangButton = async () => { // ✅ ASYNC
    const btn = el("btn-lang");
    if (!btn) return;
    const cur = getLocale();
    btn.textContent = cur === "it" ? "EN" : "IT";
    btn.setAttribute("title", cur === "it" ? "Switch to English" : "Passa a Italiano");
  };

  await updateLangButton(); // ✅ AWAIT

  const btnLang = el("btn-lang");
  if (btnLang) {
    btnLang.onclick = async () => { // ✅ ASYNC
      const cur = getLocale();
      setLocale(cur === "it" ? "en" : "it");

      applyI18n();
      await updateLangButton(); // ✅ AWAIT

      // ✅ RENDER ASYNC - Ordine importante!
      await renderGlobalRank();     // 1° Sidebar
      await renderMyTable();        // 2° My table  
      renderHud({                   // 3° Sync (testi)
        actionLocked: hostActionLocked(),
        transitionLocked: hostRoundTransitionLocked(),
      });
    };
  }

  // RPCs / UI
  installFxRpc();
  installToastRpc();

  initChatUI();
  initInfoModal();
  installTargetModalRpcs();

  installHostRpcs();
  installEndgameRpcs(hostNewGame);

  // inputs + loop
  initInputs();
  startLoop();
}
