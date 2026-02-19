import * as Playroom from "playroomkit";
import { el } from "./dom.js";
import {
  ensureDefaults,
  currentTurnPlayer,
  me,
  isEligible,
  getPendingTarget,
  getFlip3Ctx
} from "./state.js";
import { fxIsBusy } from "./fx.js";

export function initInputs() {
  const isMeTurn = () => {
    const cur = currentTurnPlayer();
    const mp = me();
    return !!cur && cur.id === mp.id && isEligible(mp);
  };

  const canActNow = () => {
    const mp = me();
    ensureDefaults(mp);

    if (fxIsBusy()) return false;
    if (!isMeTurn()) return false;
    if (getPendingTarget()) return false;
    if (getFlip3Ctx()) return false;
    if (mp.getState("flip3Lock")) return false;
    if (Playroom.getState("partitaFinita")) return false;

    return true;
  };

  const btnDraw = el("btn-pesca");
  if (btnDraw) btnDraw.onclick = () => {
    if (!canActNow()) return;
    const mp = me();
    Playroom.RPC.call(
      "rpcHostPlayerDraw",
      { pid: mp.id, fromFlip3: false },
      Playroom.RPC.Mode.HOST
    );
  };

  const btnStop = el("btn-stop");
  if (btnStop) btnStop.onclick = () => {
    if (!canActNow()) return;
    const mp = me();
    Playroom.RPC.call(
      "rpcHostPlayerStop",
      { pid: mp.id },
      Playroom.RPC.Mode.HOST
    );
  };
}
