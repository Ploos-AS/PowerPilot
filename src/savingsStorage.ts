import type { SavingsRecord } from "./savingsHistory";

export const SAVINGS_HISTORY_SCHEMA = "powerpilot.savings-history.v1" as const;
export const SAVINGS_HISTORY_STORAGE_KEY = "powerpilot.savings-history.v1";

export type SavingsHistoryDocument = {
  schema: typeof SAVINGS_HISTORY_SCHEMA;
  records: SavingsRecord[];
};

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function exportSavingsHistory(records: SavingsRecord[]): string {
  const document: SavingsHistoryDocument = {
    schema: SAVINGS_HISTORY_SCHEMA,
    records,
  };
  return JSON.stringify(document, null, 2);
}

export function importSavingsHistory(json: string): SavingsRecord[] {
  const value: unknown = JSON.parse(json);
  if (
    typeof value !== "object" ||
    value === null ||
    !("schema" in value) ||
    value.schema !== SAVINGS_HISTORY_SCHEMA ||
    !("records" in value) ||
    !Array.isArray(value.records)
  ) {
    throw new Error("Unsupported savings history document");
  }

  return value.records.map((record, index) => {
    if (
      typeof record !== "object" ||
      record === null ||
      !("recordedAt" in record) ||
      typeof record.recordedAt !== "string" ||
      !Number.isFinite(Date.parse(record.recordedAt)) ||
      !("scheduledSpotCostNok" in record) ||
      typeof record.scheduledSpotCostNok !== "number" ||
      !("immediateSpotCostNok" in record) ||
      typeof record.immediateSpotCostNok !== "number" ||
      !("savingsNok" in record) ||
      typeof record.savingsNok !== "number" ||
      !("energyKwh" in record) ||
      typeof record.energyKwh !== "number" ||
      !("comparableJobs" in record) ||
      typeof record.comparableJobs !== "number"
    ) {
      throw new Error(`Invalid savings record at index ${index}`);
    }
    return record as SavingsRecord;
  });
}

export class SavingsHistoryRepository {
  constructor(private readonly storage: KeyValueStorage) {}

  load(): SavingsRecord[] {
    const json = this.storage.getItem(SAVINGS_HISTORY_STORAGE_KEY);
    return json === null ? [] : importSavingsHistory(json);
  }

  save(records: SavingsRecord[]): void {
    this.storage.setItem(
      SAVINGS_HISTORY_STORAGE_KEY,
      exportSavingsHistory(records),
    );
  }

  append(record: SavingsRecord): SavingsRecord[] {
    const records = [...this.load(), record];
    this.save(records);
    return records;
  }
}
