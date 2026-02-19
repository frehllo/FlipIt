import * as Playroom from "playroomkit";
import { nf } from "./i18n.js";
import { getPlayers } from "./state.js";
import { cardLabel } from "./deck.js";
import { systemChatKey } from "./chat.js";

/**
 * LOG → Chat (eventi localizzati lato client).
 * L'host manda solo {key, params}; ogni client traduce con t(key, params).
 */

function shortNameById(pid) {
  const p = getPlayers().find((x) => x.id === pid) || null;
  return p ? (p.getProfile().name || "PLAYER").split(" ")[0] : "PLAYER";
}

function shortName(p) {
  return p ? (p.getProfile().name || "PLAYER").split(" ")[0] : "PLAYER";
}

function send(key, params) {
  if (!Playroom.isHost()) return;
  systemChatKey(key, params, "GAME");
}

export const LOG = {
  turn(pid, reason) {
    send("log.turn", { player: shortNameById(pid), reason: reason || "" });
  },

  draw(p, card) {
    send("log.draw", { player: shortName(p), card: cardLabel(card) });
  },

  stop(p, pts) {
    send("log.stop", { player: shortName(p), pts: nf.formatNumber(pts) });
  },

  bust(p, val) {
    send("log.bust", { player: shortName(p), val: String(val) });
  },

  // Messaggi liberi (già testo): sconsigliati se vuoi 100% i18n.
  // Li teniamo ma come fallback: li inviamo come log.info e li traduci nel dict se vuoi.
  info(text) {
    send("log.info", { text: String(text || "").trim() });
  },

  round(text) {
    send("log.round", { text: String(text || "").trim() });
  },

  deckReshuffle() {
    send("log.deckReshuffle", {});
  },

  roundStart() {
    send("log.roundStart", {});
  },

  newGame() {
    send("log.newGame", {});
  },

  flip3Pause(tipo) {
    send("log.flip3Pause", { tipo: String(tipo || "") });
  },

  flip3Resume() {
    send("log.flip3Resume", {});
  },

  flip3Start(player) {
    send("log.flip3Start", { player: String(player || "") });
  },

  flip3End(reason) {
    send("log.flip3End", { reason: String(reason || "") });
  },

  secondDiscard() {
    send("log.secondDiscard", {});
  },

  secondNoTargets() {
    send("log.secondNoTargets", {});
  },

  targetChoose(player, tipo) {
    send("log.targetChoose", { player: String(player || ""), tipo: String(tipo || "") });
  },
};
