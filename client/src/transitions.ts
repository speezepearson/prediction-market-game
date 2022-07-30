import * as LMSR from "./lmsr";
import { World, Round, PlayerName, Lobby } from "./types";
import { currentTime } from "./util";

export const startRound: (
  world: World & { phase: Lobby }
) => World & { phase: Round } = (world) => {
  const startsAt = currentTime() + 0;
  const endsAt = startsAt + 10;
  return {
    ...world,
    phase: {
      t: "round",
      question: "Is the average adult male mongoose over 1kg?",
      startsAtUnixtime: startsAt,
      endsAtUnixtime: endsAt,
      iousHeld: Object.fromEntries(
        Object.keys(world.balances).map((p) => [p, 0])
      ),
      lmsr: { sharesIssued: 0, inertia: 100 },
      playerStartingBalances: world.balances,
    },
  };
};

export const setLMSRProbability: (
  world: World & { phase: Round },
  actor: PlayerName,
  probability: number
) => World & { phase: Round } = (world, actor, probability) => {
  const round: Round = world.phase;

  const { newState: newLMSR, cost } = LMSR.setProbability(
    round.lmsr,
    probability
  );
  const newActorBalance = world.balances[actor] + cost.dollars;
  const newActorIOUs = round.iousHeld[actor] + cost.ious;
  if (newActorBalance < 0 || newActorBalance + newActorIOUs < 0) {
    console.log("SRP: throwing");
    throw new Error("insufficient funds");
  }

  return {
    ...world,
    balances: {
      ...world.balances,
      [actor]: newActorBalance,
    },
    phase: {
      ...round,
      lmsr: newLMSR,
      iousHeld: {
        ...world.phase.iousHeld,
        [actor]: newActorIOUs,
      },
    },
  };
};

export const endRound: (
  world: World & { phase: Round },
  doAssetsHaveValue: boolean
) => World & { phase: Lobby } = (world, doAssetsHaveValue) => {
  const round: Round = world.phase;

  const newBalances = doAssetsHaveValue
    ? Object.fromEntries(
        Object.entries(world.balances).map(([p, b]) => [
          p,
          b + round.iousHeld[p],
        ])
      )
    : world.balances

  return {
    ...world,
    balances: newBalances,
    phase: {
      t: "lobby",
      lastRoundWinnings: Object.fromEntries(Object.entries(newBalances).map(([p, b]) => [p, b - round.playerStartingBalances[p]]))
    },
  };
};
