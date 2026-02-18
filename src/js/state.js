import * as Playroom from "playroomkit";

const playersMap = new Map(); // id -> PlayerState

export function initPlayersRegistry(){
  // registra me subito se disponibile
  const mine = Playroom.myPlayer();
  if (mine && mine.id) playersMap.set(mine.id, mine);

  // registra chi entra
  Playroom.onPlayerJoin((playerState) => {
    if (!playerState?.id) return;
    playersMap.set(playerState.id, playerState);
    playerState.onQuit(() => {
      playersMap.delete(playerState.id);
    });
  });
}

export const hostNow = () => Date.now();
export const me = () => Playroom.myPlayer();

export const getPlayers = () => {
  const mine = Playroom.myPlayer();
  if (mine?.id) playersMap.set(mine.id, mine);

  return Playroom.getParticipants().slice().sort((a, b) => a.id.localeCompare(b.id));
};

export const nameOf = (p) =>
  p ? (p.getProfile().name || "PLAYER").split(" ")[0].toUpperCase() : "???";

export function ensureDefaults(p){
  if (!p || typeof p.getState !== "function") return;

  if (p.getState("puntiTotali") == null) p.setState("puntiTotali", 0);
  if (p.getState("statoRound") == null) p.setState("statoRound", "IN GIOCO");
  if (p.getState("matchRoundDone") == null) p.setState("matchRoundDone", false);
  if (p.getState("mioTavolo") == null) p.setState("mioTavolo", []);
  if (p.getState("pendingActions") == null) p.setState("pendingActions", []);
  if (p.getState("flip3Lock") == null) p.setState("flip3Lock", false);
  if (p.getState("hasSecondChance") == null) p.setState("hasSecondChance", false);
  if (p.getState("roundDrawn") == null) p.setState("roundDrawn", []);
  if (p.getState("dupValue") == null) p.setState("dupValue", null);
  if (p.getState("dupFxUntil") == null) p.setState("dupFxUntil", 0);
}

export const ensureAllDefaults = () => getPlayers().forEach(ensureDefaults);

export const isInGioco = (p) => p && p.getState("statoRound") === "IN GIOCO";
export const isDone = (p) => !!p?.getState("matchRoundDone");
export const isEligible = (p) => !!p && isInGioco(p) && !isDone(p);

export const getPendingTarget = () => Playroom.getState("pendingTarget");
export const getFlip3Ctx = () => Playroom.getState("flip3Ctx");

export function eligibleTurnIds(){
  const ps = getPlayers();
  ps.forEach(ensureDefaults);
  return ps.filter(p => isEligible(p)).map(p => p.id);
}

export function currentTurnPlayer(){
  const pid = Playroom.getState("turnPid");
  if (!pid) return null;
  return getPlayers().find(x => x.id === pid) || null;
}
