const STORAGE_KEY = "flip7_locale";

const dict = {
  it: {
    ui: {
      infoTitle: "INFO REGOLE & MATCH",
      rulesTitle: "REGOLE RAPIDE",
      rulesText:
`Nel tuo turno: PESCA oppure FERMATI (banchi i punti del tavolo).
Se peschi un numero già presente sul tuo tavolo: DOPPIONE → SBALLATO e perdi il tavolo.
2ND CHANCE annulla un solo doppione poi si consuma.
FREEZE obbliga un bersaglio a bancare subito i suoi punti tavolo.
FLIP3 fa pescare 3 carte al bersaglio (si tronca se sballa o fa FLIP7).
FLIP7: 7 numeri diversi → +15 e il round finisce.
Match: finisce quando qualcuno arriva a 200 (a fine round).`,
      close: "CHIUDI",
      chat: "CHAT",
      send: "INVIA",
      chatHint: "Invio per mandare • Max 120",
      points: "PUNTI",
      round: "ROUND",
      matchRound: "ROUND",
      target: "TARGET",
      table: "TAVOLO",
      log: "LOG (ULTIMI 5)",
      yourTable: "IL TUO TAVOLO",
      draw: "PESCA",
      bank: "FERMATI",
      info: "INFO",
      gameOver: "PARTITA FINITA",
      ranking: "CLASSIFICA",
      newGame: "NUOVA PARTITA",
      legFreeze: "Freeze banca i punti del tavolo.",
      legFlip3: "Flip3 pesca 3 carte.",
      legSecond: "2nd Chance salva da un doppione.",
      legFlip7: "Flip7 +15 e finisce il round.",
      legBank: "Fermati = banca i punti del tavolo.",
    },
    fx: {
      freeze: "FREEZE!",
      flip3: "FLIP3!",
      second: "2ND!",
      bust: "DOPPIONE!",
      flip7: "FLIP7!!!",
      bank: "BANCA!"
    },
    hud: {
      chooseTargetTitle: "SCEGLI BERSAGLIO",
      meMyself: "ME STESSO",
      pendingChoice: ({ player, tipo, s }) => `LOCK: ${player} sceglie ${tipo} (${s}s)`,
      pendingFlip3Pause: "LOCK: FLIP3 in pausa (scelta bersaglio)",
      deck: ({ draw, discard, inPlay }) => `MAZZO ${draw} • SCARTI ${discard} • IN GIOCO ${inPlay}`,
      tipLock: "LOCK",
      tipAction: "AZIONE: PESCA o FERMATI",
      tipWait: "ATTENDI",
      tipFlip3: ({ n }) => `FLIP3: ${n} pescate`,
      tipFlip3Pause: "FLIP3: in pausa",
      statusGameOver: "Partita finita.",
      statusFlip3Run: ({ player, n }) => `FLIP3 su ${player} (${n})`,
      statusFlip3Pause: ({ player }) => `FLIP3 su ${player} (PAUSA)`,
      statusWaitChoice: "Attendi scelta bersaglio…",
      statusYourTurn: "Tocca a te: pesca o fermati.",
      statusTurnOf: ({ player }) => `Tocca a ${player}.`,
    },
    toast: {
      reshuffle: "Rimescolo gli scarti.",
      chooseTarget: ({ tipo }) => `Scegli bersaglio: ${tipo}.`,
      timeoutDiscard: ({ tipo }) => `Timeout: ${tipo} scartata.`,
      timeoutAuto: ({ tipo, player }) => `Timeout: ${tipo} su ${player}.`,
      flip3Start: ({ player }) => `FLIP3 su ${player}: pesca 3 carte!`,
      flip3PauseAssign: ({ tipo }) => `FLIP3 in pausa: assegna ${tipo}.`,
      freezeBank: ({ player, pts }) => `FREEZE! ${player} banca ${pts}.`,
      secondGive: ({ player }) => `2ND CHANCE a ${player}.`,
      secondAlready: ({ player }) => `${player} ha già 2ND CHANCE.`,
      useSecond: ({ player, val }) => `${player} usa 2ND e scarta il doppio ${val}.`,
      bust: ({ player, val }) => `SBALLATO! ${player} ha doppione ${val}.`,
      bank: ({ player, pts }) => `${player} banca ${pts}.`,
      flip7: ({ player, pts }) => `FLIP7! ${player} fa ${pts}.`,
      newRound: "Nuovo round!",
      matchEnd: ({ player, score }) => `Match finito: vince ${player} (${score}).`,
      newGame: "Nuova partita!",
      watchdogClose: "WATCHDOG: chiudo FLIP3.",
      secondNoTargets: "2ND: nessun bersaglio valido.",
    },
    log: {
      turn: ({ player, reason }) => `Turno: ${player}${reason ? " • " + reason : ""}`,
      draw: ({ player, card }) => `${player} pesca ${card}`,
      stop: ({ player, pts }) => `${player} banca ${pts}`,
      bust: ({ player, val }) => `${player} SBALLA (${val})`,
      deckReshuffle: "Rimescolati scarti nel mazzo.",
      matchEnd: ({ player, score }) => `Match end: ${player} (${score})`,
      roundStart: "Inizio round.",
      newGame: "Reset partita.",
      flip3Pause: ({ tipo }) => `FLIP3 pausa (${tipo})`,
      flip3Resume: "FLIP3 riprende",
      flip3Start: ({ player }) => `FLIP3 start su ${player}`,
      flip3End: ({ reason }) => `FLIP3 end (${reason})`,
      secondDiscard: "2ND scartata (già presente).",
      secondNoTargets: "2ND: no targets.",
      targetChoose: ({ player, tipo }) => `${player} sceglie ${tipo}`,
    },
    action: { FREEZE: "FREEZE", FLIP3: "FLIP3", "2ndCHANCE": "2ND" }
  },

  en: {
    ui: {
      infoTitle: "RULES & MATCH INFO",
      rulesTitle: "QUICK RULES",
      rulesText:
`On your turn: DRAW or BANK (bank your table points).
If you draw a number already on your table: DUPLICATE → BUST and you lose your table.
2ND CHANCE cancels one duplicate, then it’s consumed.
FREEZE forces a target to bank their current table points immediately.
FLIP3 makes the target draw 3 cards (stops if they bust or hit FLIP7).
FLIP7: 7 different numbers → +15 and the round ends.
Match ends when someone reaches 200 (checked at end of round).`,
      close: "CLOSE",
      chat: "CHAT",
      send: "SEND",
      chatHint: "Enter to send • Max 120",
      points: "POINTS",
      round: "ROUND",
      matchRound: "ROUND",
      target: "TARGET",
      table: "TABLE",
      log: "LOG (LAST 5)",
      yourTable: "YOUR TABLE",
      draw: "DRAW",
      bank: "BANK",
      info: "INFO",
      gameOver: "GAME OVER",
      ranking: "RANKING",
      newGame: "NEW GAME",
      legFreeze: "Freeze banks the table points.",
      legFlip3: "Flip3 draws 3 cards.",
      legSecond: "2nd Chance saves you from a duplicate.",
      legFlip7: "Flip7 +15 and ends the round.",
      legBank: "Bank = take your table points.",
    },
    fx: {
      freeze: "FREEZE!",
      flip3: "FLIP3!",
      second: "2ND!",
      bust: "DUPLICATE!",
      flip7: "FLIP7!!!",
      bank: "BANK!"
    },
    hud: {
      chooseTargetTitle: "CHOOSE TARGET",
      meMyself: "MYSELF",
      pendingChoice: ({ player, tipo, s }) => `LOCK: ${player} chooses ${tipo} (${s}s)`,
      pendingFlip3Pause: "LOCK: FLIP3 paused (choosing target)",
      deck: ({ draw, discard, inPlay }) => `DECK ${draw} • DISCARD ${discard} • IN PLAY ${inPlay}`,
      tipLock: "LOCK",
      tipAction: "ACTION: DRAW or BANK",
      tipWait: "WAIT",
      tipFlip3: ({ n }) => `FLIP3: ${n} draws`,
      tipFlip3Pause: "FLIP3: paused",
      statusGameOver: "Game over.",
      statusFlip3Run: ({ player, n }) => `FLIP3 on ${player} (${n})`,
      statusFlip3Pause: ({ player }) => `FLIP3 on ${player} (PAUSED)`,
      statusWaitChoice: "Waiting for target choice…",
      statusYourTurn: "Your turn: draw or bank.",
      statusTurnOf: ({ player }) => `${player}'s turn.`,
    },
    toast: {
      reshuffle: "Reshuffling discards.",
      chooseTarget: ({ tipo }) => `Choose a target: ${tipo}.`,
      timeoutDiscard: ({ tipo }) => `Timeout: ${tipo} discarded.`,
      timeoutAuto: ({ tipo, player }) => `Timeout: ${tipo} on ${player}.`,
      flip3Start: ({ player }) => `FLIP3 on ${player}: draw 3 cards!`,
      flip3PauseAssign: ({ tipo }) => `FLIP3 paused: assign ${tipo}.`,
      freezeBank: ({ player, pts }) => `FREEZE! ${player} banks ${pts}.`,
      secondGive: ({ player }) => `2ND CHANCE to ${player}.`,
      secondAlready: ({ player }) => `${player} already has 2ND CHANCE.`,
      useSecond: ({ player, val }) => `${player} uses 2ND and discards duplicate ${val}.`,
      bust: ({ player, val }) => `BUST! ${player} hit duplicate ${val}.`,
      bank: ({ player, pts }) => `${player} banks ${pts}.`,
      flip7: ({ player, pts }) => `FLIP7! ${player} scores ${pts}.`,
      newRound: "New round!",
      matchEnd: ({ player, score }) => `Match over: ${player} wins (${score}).`,
      newGame: "New game!",
      watchdogClose: "WATCHDOG: closing FLIP3.",
      secondNoTargets: "2ND: no valid targets.",
    },
    log: {
      turn: ({ player, reason }) => `Turn: ${player}${reason ? " • " + reason : ""}`,
      draw: ({ player, card }) => `${player} draws ${card}`,
      stop: ({ player, pts }) => `${player} banks ${pts}`,
      bust: ({ player, val }) => `${player} BUSTS (${val})`,
      deckReshuffle: "Shuffled discard pile into deck.",
      matchEnd: ({ player, score }) => `Match end: ${player} (${score})`,
      roundStart: "Round start.",
      newGame: "Game reset.",
      flip3Pause: ({ tipo }) => `FLIP3 pause (${tipo})`,
      flip3Resume: "FLIP3 resumes",
      flip3Start: ({ player }) => `FLIP3 start on ${player}`,
      flip3End: ({ reason }) => `FLIP3 end (${reason})`,
      secondDiscard: "2ND discarded (already present).",
      secondNoTargets: "2ND: no targets.",
      targetChoose: ({ player, tipo }) => `${player} chooses ${tipo}`,
    },
    action: { FREEZE: "FREEZE", FLIP3: "FLIP3", "2ndCHANCE": "2ND" }
  }
};

let locale = "it";

export function setLocale(l) {
  locale = (l === "en" ? "en" : "it");
  try { localStorage.setItem(STORAGE_KEY, locale); } catch {}
}

export function getLocale() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return (v === "en" ? "en" : "it");
  } catch {
    return "it";
  }
}

export function t(path, params) {
  const parts = String(path).split(".");
  let node = dict[locale];
  for (const p of parts) node = node?.[p];
  if (typeof node === "function") return node(params || {});
  return (node ?? path);
}

export const nf = {
  formatNumber(n) { return new Intl.NumberFormat(locale).format(Number(n || 0)); }
};

export function applyI18n() {
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    if (!key) return;
    el.textContent = t(key);
  });
}

export function actionLabel(tipo) {
  if (!tipo) return "";
  const k = String(tipo);
  const map = dict[locale]?.action || {};
  return map[k] || k;
}
