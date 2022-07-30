import { stringify } from "querystring";
import React from "react";
import * as LMSR from "./lmsr";
import { setLMSRProbability } from "./transitions";

import { Unixtime, World, PlayerName, Connection, Round, Lobby } from "./types";
import { currentTime } from "./util";

type LobbyScreenProps = {
  ownName: PlayerName;
  world: World & { phase: Lobby };
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
      <table className="leaderboard">
        <thead>
          <tr>
            <th>Player</th>
            <th>Balance</th>
            <th>Last winnings</th>
          </tr>
        </thead>
        {Object.entries(world.balances).sort(([p1, b1], [p2, b2]) => p1.localeCompare(p2)).map(([playerName, balance]) => (
          <tr key={playerName}>
            <td>{playerName} {ownName === playerName && " (you)"}</td>
            <td>{balance.toFixed(2)}</td>
            <td>
              {world.phase.lastRoundWinnings && (() => {
                const winnings = world.phase.lastRoundWinnings[playerName];
                if (!winnings) {
                  return null;
                }
                return <strong>({winnings > 0 && '+'}{winnings.toFixed(2)})</strong>
              })()}
            </td>
          </tr>
        ))}
      </table>

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
  return (
    <h1>Round starts in: {(world.phase.startsAtUnixtime - now).toFixed(0)}</h1>
  );
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
  let [probEntered, setProbEntered] = React.useState(
    LMSR.getProbability(round.lmsr)
  );
  let [probReqsInFlight, incProbReqsInFlight] = React.useReducer<
    React.Reducer<number, number>
  >((x, y) => x + y, 0);
  const [lastSetProbErr, setLastSetProbErr] = React.useState<null | string>(
    null
  );

  const startingBalance = round.playerStartingBalances[ownName];

  return (
    <div>
      <h1>Question: {round.question}</h1>
      <h2>Time remaining: {(round.endsAtUnixtime - now).toFixed(2)}</h2>
      <h2>
        Your money: ${startingBalance.toFixed(2)} + (
        {(world.balances[ownName] - startingBalance + round.iousHeld[ownName]).toFixed(2)} if Yes,{" "}
        {(world.balances[ownName] - startingBalance                          ).toFixed(2)} if No)
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
          while (Math.abs(newVal - oldVal) > 0.00001) {
            try {
              setLMSRProbability(world, ownName, newVal);
              break;
            } catch {
              newVal = (5 * newVal + oldVal) / 6;
            }
          }
          if (Math.abs(newVal - oldVal) <= 0.00001) {
            return;
          }
          console.log("settled on ", newVal);
          incProbReqsInFlight(1);
          setProbEntered(newVal);
          requestSetProbability(newVal)
            .catch((e) => setLastSetProbErr(e.message))
            .finally(() => incProbReqsInFlight(-1));
        }}
      />
      {probReqsInFlight > 0 && "Sending..."}
      {lastSetProbErr && (
        <span style={{ color: "red" }}>Error: {lastSetProbErr}</span>
      )}
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

  switch (world.phase.t) {
    case "lobby":
      return (
        <LobbyScreen
          ownName={ownName}
          world={world as World & { phase: Lobby }}
          requestStartRound={() => conn.startRound()}
        />
      );
    case "round":
      if (world.phase.startsAtUnixtime > now) {
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
  }
};

export default App;
