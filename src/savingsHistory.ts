export type SavingsRecord = {
  recordedAt: string;
  scheduledSpotCostNok: number;
  immediateSpotCostNok: number;
  savingsNok: number;
  energyKwh: number;
  comparableJobs: number;
};

export type SavingsAggregate = {
  records: number;
  comparableJobs: number;
  energyKwh: number;
  scheduledSpotCostNok: number;
  immediateSpotCostNok: number;
  savingsNok: number;
  savingsPercent?: number;
};

export function aggregateSavings(
  records: SavingsRecord[],
  fromInclusive?: string,
  toExclusive?: string,
): SavingsAggregate {
  const from = fromInclusive ? Date.parse(fromInclusive) : Number.NEGATIVE_INFINITY;
  const to = toExclusive ? Date.parse(toExclusive) : Number.POSITIVE_INFINITY;

  const result: SavingsAggregate = {
    records: 0,
    comparableJobs: 0,
    energyKwh: 0,
    scheduledSpotCostNok: 0,
    immediateSpotCostNok: 0,
    savingsNok: 0,
  };

  for (const record of records) {
    const at = Date.parse(record.recordedAt);
    if (!Number.isFinite(at) || at < from || at >= to) continue;
    result.records++;
    result.comparableJobs += record.comparableJobs;
    result.energyKwh += record.energyKwh;
    result.scheduledSpotCostNok += record.scheduledSpotCostNok;
    result.immediateSpotCostNok += record.immediateSpotCostNok;
    result.savingsNok += record.savingsNok;
  }

  if (result.immediateSpotCostNok !== 0) {
    result.savingsPercent = (result.savingsNok / result.immediateSpotCostNok) * 100;
  }

  return result;
}
