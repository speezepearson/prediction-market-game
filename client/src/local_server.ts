import { endRound, setLMSRProbability, startRound } from "./transitions";
import { Connection, Round, World } from "./types";
import { currentTime } from "./util";

const insertNetworkDelay: (f: () => void) => void = (f) => {
  setTimeout(f, 100 * (1 + 2*Math.random()));
}

export class LocalServer implements Connection {
  ownName: string;
  world: World;
  subscriptions: Map<number, (world: World) => void> = new Map();

  constructor(ownName: string, world: World) {
    this.ownName = ownName;
    this.world = world;
  }

  setWorld<W extends World>(w: W): W {
    this.world = w;
    this.subscriptions.forEach((cb) => insertNetworkDelay(() => cb(w)));
    return w;
  }

  startRound(): Promise<void> {
    console.log("calling startRound on", this);
    return new Promise((resolve, reject) => {
      insertNetworkDelay(() => {
        const worldBeforeStart = this.world;
        if (worldBeforeStart.phase !== "lobby") {
          insertNetworkDelay(() => reject("can only start rounds from lobby"));
          return;
        }
        const worldAfterStart = this.setWorld(
          startRound(worldBeforeStart as World & { phase: "lobby" })
        );
        setTimeout(() => {
          const worldBeforeEnd = this.world;
          if (worldBeforeEnd.phase === "lobby") {
            throw new Error("somehow received endRound timeout in lobby");
          }
          this.setWorld(
            endRound(worldBeforeEnd as World & { phase: Round }, true)
          );
        }, (worldAfterStart.phase.endsAtUnixtime - currentTime()) * 1000);
        insertNetworkDelay(resolve);
      });
    });
  }

  sendProbability(p: number): Promise<void> {
    return new Promise((resolve, reject) => {
      insertNetworkDelay(() => {
        const w0 = this.world;
        if (w0.phase === "lobby") {
          insertNetworkDelay(() => reject("can't send probability in lobby"));
          return;
        }
        try {
          this.setWorld(
            setLMSRProbability(w0 as World & { phase: Round }, this.ownName, p)
          );
        } catch (e) {
          console.log('SRP: caught IRL', w0.balances, w0.phase.lmsr, p);
          insertNetworkDelay(() => reject(e));
          return;
        }
        insertNetworkDelay(resolve);
      });
    });
  }

  subscribe(cb: (world: World) => void): [World, () => void] {
    const cbid = Math.random();
    this.subscriptions.set(cbid, cb);
    return [
      this.world,
      () => {
        this.subscriptions.delete(cbid);
      },
    ];
  }
}
