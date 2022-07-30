import React from "react";
import * as LMSR from "./lmsr";
import { setLMSRProbability } from "./transitions";

import { Unixtime, World, PlayerName, Connection, Round } from "./types";
import { currentTime } from "./util";

type LobbyScreenProps = {
  ownName: PlayerName;
  world: World & { phase: "lobby" };
  requestStartRound: () => Promise<void>;
};
const LobbyScreen: React.FunctionComponent<LobbyScreenProps> = ({
  ownName,
  world,
  requestStartRound,
}) => {
  let [reqStartStatus, setReqStartStatus] = React.useState<
    | { t: "unclicked" }
    | { t: "pending" }
    | { t: "error"; message: string }
    | { t: "done" }
  >({ t: "unclicked" });
  return (
    <div>
      <h1>Lobby</h1>
      <ul>
        {Object.entries(world.balances).map(([playerName, balance]) => (
          <li key={playerName}>
            <strong>
              {playerName}
              {ownName === playerName && " (you)"}:
            </strong>{" "}
            ${balance.toFixed(0)}
          </li>
        ))}
      </ul>

      <p>
        <button
          disabled={
            reqStartStatus.t === "pending" || reqStartStatus.t === "done"
          }
          onClick={() => {
            setReqStartStatus({ t: "pending" });
            requestStartRound()
              .then(() => setReqStartStatus({ t: "done" }))
              .catch((err) =>
                setReqStartStatus({ t: "error", message: err.message })
              );
          }}
        >
          {reqStartStatus.t === "unclicked"
            ? "Start round"
            : reqStartStatus.t === "pending"
            ? "Starting..."
            : reqStartStatus.t === "error"
            ? "Retry"
            : "!?!?!?!?"}
        </button>
        {reqStartStatus.t === "error" && (
          <span style={{ color: "red" }}>Error: {reqStartStatus.message}</span>
        )}
      </p>
    </div>
  );
};

function useCurrentTime(intervalSec: number): Unixtime {
  const [now, setNow] = React.useState(currentTime());
  React.useEffect(() => {
    const interval = setInterval(
      () => setNow(currentTime()),
      intervalSec * 1000
    );
    return () => clearInterval(interval);
  }, [intervalSec]);
  return now;
}

type CountdownScreenProps = {
  world: World & { phase: Round };
};
const CountdownScreen: React.FunctionComponent<CountdownScreenProps> = ({
  world,
}) => {
  let now = useCurrentTime(0.01);
  return <h1>Round starts in: {(world.phase.startsAtUnixtime - now).toFixed(0)}</h1>;
};

type RoundScreenProps = {
  ownName: PlayerName;
  world: World & { phase: Round };
  requestSetProbability: (p: number) => Promise<void>;
};
const RoundScreen: React.FunctionComponent<RoundScreenProps> = ({
  ownName,
  world,
  requestSetProbability,
}) => {
  let round: Round = world.phase;

  let now = useCurrentTime(0.01);
  let [probEntered, setProbEntered] = React.useState(LMSR.getProbability(round.lmsr));
  let [probReqsInFlight, incProbReqsInFlight] = React.useReducer<
    React.Reducer<number, number>
  >((x, y) => x + y, 0);
  const [lastSetProbErr, setLastSetProbErr] = React.useState<null | string>(null);

  return (
    <div>
      <h1>Question: {round.question}</h1>
      <h2>Time remaining: {(round.endsAtUnixtime - now).toFixed(0)}</h2>
      <h2>
        Your money: ${world.balances[ownName].toFixed(0)} + ?{round.iousHeld[ownName].toFixed(0)}
      </h2>
      <input
        type="range"
        style={{ width: "80%" }}
        min={0.001}
        max={0.999}
        step={"any"}
        value={probEntered}
        onChange={(e) => {
          const oldVal = LMSR.getProbability(round.lmsr);
          let newVal = e.target.valueAsNumber;
          while (newVal > oldVal + 0.00001) {
            try {
              setLMSRProbability(world, ownName, newVal);
              break;
            } catch {
              newVal = (5*newVal + oldVal) / 6;
            }
          }
          if (newVal < oldVal + 0.00001) {
            return;
          }
          console.log("settled on ", newVal);
          incProbReqsInFlight(1);
          setProbEntered(newVal);
          requestSetProbability(newVal)
            .catch((e) => console.error(e))
            .finally(() => incProbReqsInFlight(-1));
        }}
      />
      {probReqsInFlight > 0 && "Sending..."}
      {lastSetProbErr && <span style={{ color: "red" }}>Error: {lastSetProbErr}</span>}
    </div>
  );
};

const App: React.FunctionComponent<{
  ownName: string;
  conn: Connection;
}> = ({ ownName, conn }) => {
  let now = useCurrentTime(0.1);
  let [world, setWorld] = React.useState<World | null>(null);
  React.useEffect(() => {
    const [w0, unhook] = conn.subscribe((w) => setWorld(w));
    setWorld(w0);
    return unhook;
  }, [conn]);
  if (world === null) {
    return <div>Loading...</div>;
  }

  if (world.phase === "lobby") {
    return (
      <LobbyScreen
        ownName={ownName}
        world={world as World & { phase: "lobby" }}
        requestStartRound={() => conn.startRound()}
      />
    );
  } else if (world.phase.startsAtUnixtime > now) {
    return <CountdownScreen world={world as World & { phase: Round }} />;
  } else {
    return (
      <RoundScreen
        ownName={ownName}
        world={world as World & { phase: Round }}
        requestSetProbability={(p) => conn.sendProbability(p)}
      />
    );
  }
};

export default App;
