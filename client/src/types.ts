import { LMSR } from "./lmsr";

export type PlayerName = string;
export type Unixtime = number;

export type Round = {
  question: string;
  startsAtUnixtime: Unixtime;
  endsAtUnixtime: Unixtime;
  iousHeld: Record<PlayerName, number>;
  lmsr: LMSR;
};

export type World = {
  balances: Record<PlayerName, number>;
  phase: "lobby" | Round;
};

export interface Connection {
  startRound(): Promise<void>;
  sendProbability(p: number): Promise<void>;
  subscribe(cb: (world: World) => void): [World, () => void];
}
