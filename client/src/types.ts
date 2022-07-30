import { LMSR } from "./lmsr";

export type PlayerName = string;
export type Unixtime = number;

export type Round = {
  t: "round";
  question: string;
  startsAtUnixtime: Unixtime;
  endsAtUnixtime: Unixtime;
  playerStartingBalances: Record<PlayerName, number>;
  iousHeld: Record<PlayerName, number>;
  lmsr: LMSR;
};

export type Lobby = {
  t: "lobby";
  lastRoundWinnings: null | Record<PlayerName, number>;
};

export type World = {
  balances: Record<PlayerName, number>;
  phase: Lobby | Round;
};
export type LobbyWorld = World & { phase: Lobby };

export interface Connection {
  startRound(): Promise<void>;
  sendProbability(p: number): Promise<void>;
  subscribe(cb: (world: World) => void): [World, () => void];
}
