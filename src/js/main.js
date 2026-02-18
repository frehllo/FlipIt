import * as Playroom from "playroomkit";
import { setLocale, getLocale, applyI18n } from "./i18n.js";
import { installFxRpc } from "./fx.js";
import { installToastRpc } from "./toast.js";
import { installLogRpcs } from "./log.js";
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
import { renderHud, renderGlobalRank, renderMyTable } from "./render.js";
// se hai aggiunto il registry players che ti ho dato prima:
// import { initPlayersRegistry } from "./state.js";

if (import.meta.hot) import.meta.hot.decline(); // evita duplicazione listeners in dev [web:399]

if (!window.flip7mainstarted) {
  window.flip7mainstarted = true;
  boot();
}

async function boot() {
  await Playroom.insertCoin({
    gameId: "flip7-pixel-v220-chat-desktop-mobile-modal",
    skipLobby: false,
  });

  // se usi il registry players:
  // initPlayersRegistry();

  // i18n init
  setLocale(getLocale());
  applyI18n();

  // language toggle + label (shows the *next* language)
  const updateLangButton = () => {
    const btn = el("btn-lang");
    if (!btn) return;
    const cur = getLocale(); // current locale stored
    btn.textContent = cur === "it" ? "EN" : "IT";
    btn.setAttribute("title", cur === "it" ? "Switch to English" : "Passa a Italiano");
  };

  updateLangButton();

  const btnLang = el("btn-lang");
  if (btnLang) {
    btnLang.onclick = () => {
      const cur = getLocale();
      setLocale(cur === "it" ? "en" : "it");

      applyI18n();
      updateLangButton();

      // redraw dynamic strings immediately
      renderHud({
        actionLocked: hostActionLocked(),
        transitionLocked: hostRoundTransitionLocked(),
      });
      renderGlobalRank();
      renderMyTable();
    };
  }

  // RPCs / UI
  installFxRpc();
  installToastRpc();
  installLogRpcs();

  initChatUI();
  initInfoModal();
  installTargetModalRpcs();

  installHostRpcs();
  installEndgameRpcs(hostNewGame);

  // inputs + loop
  initInputs();
  startLoop();
}
