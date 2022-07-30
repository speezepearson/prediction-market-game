export type Wealth = {
  dollars: number;
  ious: number;
};

export type LMSR = {
  inertia: number;
  sharesIssued: number;
};

export const getProbability: (lmsr: LMSR) => number = (lmsr) => {
  return Math.exp(lmsr.sharesIssued) / (1 + Math.exp(lmsr.sharesIssued));
};

export const setProbability: (
  lmsr: LMSR,
  newProbability: number
) => { newState: LMSR; cost: Wealth } = (lmsr, newProbability) => {
  const newSharesIssued = Math.log(newProbability / (1 - newProbability));
  // The cost is the integral of the share price (i.e. probability) from old number of shares to new.
  // The price is e^x / (1+e^x); the integral of that is log(1+e^x).
  const cost = {
    dollars:
      lmsr.inertia *
      (Math.log(1 + Math.exp(newSharesIssued)) -
        Math.log(1 + Math.exp(lmsr.sharesIssued))),
    ious: lmsr.inertia * (lmsr.sharesIssued - newSharesIssued),
  };
  return {
    newState: { ...lmsr, sharesIssued: newSharesIssued },
    cost: cost,
  };
};
