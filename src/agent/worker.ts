export type WorkerTask = () => Promise<void>;

export class AgentWorker {
  private timer?: NodeJS.Timeout;
  private running = false;
  private stopped = false;

  constructor(
    private readonly task: WorkerTask,
    private readonly intervalMs: number,
  ) {}

  async start(): Promise<void> {
    if (this.stopped || this.timer) return;
    await this.run();
    if (this.stopped) return;
    this.timer = setInterval(() => void this.run(), this.intervalMs);
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  private async run(): Promise<void> {
    if (this.running || this.stopped) return;
    this.running = true;
    try {
      await this.task();
    } catch (error) {
      console.error("PowerPilot Agent worker iteration failed", error);
    } finally {
      this.running = false;
    }
  }
}
