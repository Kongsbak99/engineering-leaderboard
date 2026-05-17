export const SCORING_WEIGHTS = {
  delivery: {
    cycleTime: 0.35,
    prsMerged: 0.25,
    deployFrequency: 0.25,
    revertRate: 0.15,
  },
  collaboration: {
    reviewsGiven: 0.30,
    reviewTurnaround: 0.25,
    crossTeamReviews: 0.25,
    unblocking: 0.20,
  },
  project: {
    ticketVelocity: 0.30,
    cycleTime: 0.25,
    burnDown: 0.20,
    blockedCount: 0.15,
    completionPct: 0.10,
  },
} as const;

export const SCORE_RANGE = { min: 0, max: 100 } as const;
