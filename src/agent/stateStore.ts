export interface StateStore<T> {
  load(): Promise<T | undefined>;
  save(value: T): Promise<void>;
}
