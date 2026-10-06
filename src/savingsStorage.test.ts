import { describe, expect, it } from "vitest";
import {
  exportSavingsHistory,
  importSavingsHistory,
  SavingsHistoryRepository,
  SAVINGS_HISTORY_STORAGE_KEY,
} from "./savingsStorage";
import type { SavingsRecord } from "./savingsHistory";

const record: SavingsRecord = {
  recordedAt: "2026-10-06T08:00:00.000Z",
  scheduledSpotCostNok: 3,
  immediateSpotCostNok: 5,
  savingsNok: 2,
  energyKwh: 4,
  comparableJobs: 2,
};

describe("savings history persistence", () => {
  it("round-trips the versioned JSON document", () => {
    expect(importSavingsHistory(exportSavingsHistory([record]))).toEqual([record]);
  });

  it("rejects unknown schemas", () => {
    expect(() => importSavingsHistory('{"schema":"powerpilot.savings-history.v2","records":[]}'))
      .toThrow("Unsupported savings history document");
  });

  it("rejects malformed records", () => {
    expect(() => importSavingsHistory(
      '{"schema":"powerpilot.savings-history.v1","records":[{"recordedAt":"nope"}]}',
    )).toThrow("Invalid savings record");
  });

  it("loads, saves and appends through a storage adapter", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    };
    const repository = new SavingsHistoryRepository(storage);
    expect(repository.load()).toEqual([]);
    repository.save([record]);
    expect(repository.load()).toEqual([record]);
    const second = { ...record, recordedAt: "2026-10-06T09:00:00.000Z" };
    expect(repository.append(second)).toEqual([record, second]);
    expect(values.has(SAVINGS_HISTORY_STORAGE_KEY)).toBe(true);
  });
});
