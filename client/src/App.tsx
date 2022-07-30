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
  viewProbsAs: ViewProbsAs;
  setViewProbsAs: (v: ViewProbsAs) => void;
};
const LobbyScreen: React.FunctionComponent<LobbyScreenProps> = ({
  ownName,
  world,
  requestStartRound,
  viewProbsAs,
  setViewProbsAs,
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
        <tbody>
          {Object.entries(world.balances)
            .sort(([p1, b1], [p2, b2]) => p1.localeCompare(p2))
            .map(([playerName, balance]) => (
              <tr key={playerName}>
                <td>
                  {playerName} {ownName === playerName && " (you)"}
                </td>
                <td>{balance.toFixed(2)}</td>
                <td>
                  {world.phase.lastRoundWinnings &&
                    (() => {
                      const winnings = world.phase.lastRoundWinnings[playerName];
                      if (!winnings) {
                        return null;
                      }
                      return (
                        <strong>
                          ({winnings > 0 && "+"}
                          {winnings.toFixed(2)})
                        </strong>
                      );
                    })()}
                </td>
              </tr>
            ))}
        </tbody>
      </table>

      <p>
        View probabilities as: <select onChange={(e) => {setViewProbsAs(e.target.value as ViewProbsAs)}}>
          <option value={"percentages" as ViewProbsAs}>percentages</option>
          <option value={"odds" as ViewProbsAs}>odds</option>
        </select>
      </p>

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

type ProbabilitySliderProps = {
  prob: number;
  dbRange: number;
  onChange: (newValue: number) => void;
  viewProbsAs: ViewProbsAs;
};
const ProbabilitySlider: React.FunctionComponent<ProbabilitySliderProps> = ({
  prob,
  dbRange,
  onChange,
  viewProbsAs,
}) => {

  let ticks: {dB: number, text: React.ReactNode}[];
  switch (viewProbsAs) {
    case "percentages":
      ticks = [1, 2, 5, 10, 20, 30,40,  50,60, 70, 80, 90, 95, 98, 99].map((probPct: number) => {
        const prob = probPct / 100;
        const dB = 10 * Math.log10(prob / (1-prob));
        return { dB: dB, text: <>{probPct}<span style={{color:"gray"}}>%</span></> };
      });
      break;
    case "odds":
      ticks = [1,2,3,5,10,20,30,50,100,200,300,500].flatMap((odds: number) => {
        const oddsPairs: [number, number][] = (odds === 1) ? [[1, 1]] : [[1, odds], [odds, 1]];
        return oddsPairs.map(([for_, against]) => {
          const prob = for_ / (for_ + against);
          const dB = 10 * Math.log10(prob / (1-prob));
          return { dB: dB, text: `${for_}:${against}` };
      })})
      break;
  }

  return (
    <div className="probability-slider">
      <input
        type="range"
        min={-dbRange}
        max={dbRange}
        step="any"
        value={10 * Math.log10(prob / (1-prob))}
        style={{ width: "80%" }}
        onChange={(e) => {
          const dB = e.target.valueAsNumber;
          console.log('dragged to dB', dB);
          const odds = Math.pow(10, dB / 10);
          const prob = odds / (1 + odds);
          console.log('   equals prob', prob);
          onChange(prob);
        }}
      />
      <div className="ticks">
        {ticks.filter((tick) => tick.dB >= -dbRange-1 && tick.dB <= dbRange+1).map(({dB, text}) => {
          const widthPct = `${100 * (dB + dbRange)/(2*dbRange)}%`;
          return<div key={dB.toString()} data-foo={dB.toString()} className="tick-container" style={{ width: widthPct}}>
              <div className="tick" style={{width: 0, right: "100%"}}>{text}</div>
            </div>;
        })}
      </div>
    </div>
  );
};

type RoundScreenProps = {
  ownName: PlayerName;
  world: World & { phase: Round };
  requestSetProbability: (p: number) => Promise<void>;
  viewProbsAs: ViewProbsAs;
};
const RoundScreen: React.FunctionComponent<RoundScreenProps> = ({
  ownName,
  world,
  requestSetProbability,
  viewProbsAs,
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
        {(
          world.balances[ownName] -
          startingBalance +
          round.iousHeld[ownName]
        ).toFixed(2)}{" "}
        if Yes, {(world.balances[ownName] - startingBalance).toFixed(2)} if No)
      </h2>
      <ProbabilitySlider
        prob={probEntered}
        viewProbsAs={viewProbsAs}
        dbRange={20}
        onChange={(newVal) => {
          const oldVal = LMSR.getProbability(round.lmsr);
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
          incProbReqsInFlight(1);
          setProbEntered(newVal);
          requestSetProbability(newVal)
            .catch((e) => setLastSetProbErr(e.message))
            .finally(() => incProbReqsInFlight(-1));
        }}
      ></ProbabilitySlider>
      {probReqsInFlight > 0 && "Sending..."}
      {lastSetProbErr && (
        <span style={{ color: "red" }}>Error: {lastSetProbErr}</span>
      )}
    </div>
  );
};

type ViewProbsAs = "percentages" | "odds"

const App: React.FunctionComponent<{
  ownName: string;
  conn: Connection;
}> = ({ ownName, conn }) => {
  let now = useCurrentTime(0.1);
  let [world, setWorld] = React.useState<World | null>(null);
  let [viewProbsAs, setViewProbsAs] = React.useState<ViewProbsAs>("percentages")
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
          viewProbsAs={viewProbsAs}
          setViewProbsAs={setViewProbsAs}
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
            viewProbsAs={viewProbsAs}
          />
        );
      }
  }
};

export default App;
