import * as Playroom from "playroomkit";
import { CFG } from "./cfg.js";
import { ensureAllDefaults } from "./state.js";
import {
  hostInit,
  hostEnsureValidTurn,
  hostAutoResolvePendingIfNeeded,
  hostFlip3Watchdog,
  hostMaybeEndRoundAndMatch,
  hostActionLocked,
  hostRoundTransitionLocked
} from "./host.js";
import { renderHud, renderGlobalRank, renderMyTable, renderMobileRankModal } from "./render.js";

export function startLoop() {
  let lastHostTick = 0;

  const loop = () => {
    ensureAllDefaults();

    if (Playroom.isHost()) {
      const now = Date.now();
      if (now - lastHostTick >= CFG.HOSTTICKMS) {
        lastHostTick = now;

        hostInit();
        hostEnsureValidTurn();
        hostAutoResolvePendingIfNeeded();
        hostFlip3Watchdog();
        hostMaybeEndRoundAndMatch();

        // ✅ NON richiamare hostEnsureValidTurn qui (evita thrash)
        // hostEnsureValidTurn();
      }
    }

    renderHud({ actionLocked: hostActionLocked(), transitionLocked: hostRoundTransitionLocked() });
    renderGlobalRank();
    try {
      renderMobileRankModal();
    } catch (err) {
      alert("ERRORE RANK: " + err.message);
    }
    renderMyTable();

    requestAnimationFrame(loop);
  };

  // ok chiamarlo una volta, ma solo se host
  if (Playroom.isHost()) hostInit();
  requestAnimationFrame(loop);
}
