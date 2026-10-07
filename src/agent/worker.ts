export type WorkerTask = () => Promise<void>;

export class AgentWorker {
  private timer?: NodeJS.Timeout;
  private inFlight?: Promise<void>;
  private stopped = false;

  constructor(
    private readonly task: WorkerTask,
    private readonly intervalMs: number,
  ) {}

  async start(): Promise<void> {
    if (this.stopped || this.timer || this.inFlight) return;
    await this.trigger();
    if (this.stopped) return;
    this.timer = setInterval(() => void this.trigger(), this.intervalMs);
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    await this.inFlight;
  }

  private trigger(): Promise<void> {
    if (this.stopped) return Promise.resolve();
    if (this.inFlight) return this.inFlight;
    const run = this.task().catch(error => {
      console.error("PowerPilot Agent worker iteration failed", error);
    });
    this.inFlight = run.finally(() => {
      if (this.inFlight === run || this.inFlight) this.inFlight = undefined;
    });
    return this.inFlight;
  }
}
