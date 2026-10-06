import type { AgentState, PersistedJob } from "./agentState.js";
import type { AgentStateRepository } from "./agentStateRepository.js";

export class AgentJobRepository {
  constructor(
    private readonly state: AgentState,
    private readonly repository: AgentStateRepository,
  ) {}

  list(): PersistedJob[] {
    return this.state.jobs.map(job => ({ ...job }));
  }

  async put(job: PersistedJob): Promise<void> {
    const index = this.state.jobs.findIndex(item => item.id === job.id);
    const previous = this.state.jobs.map(item => ({ ...item }));
    if (index >= 0) this.state.jobs[index] = { ...job };
    else this.state.jobs.push({ ...job });
    try {
      await this.repository.save(this.state);
    } catch (error) {
      this.state.jobs.splice(0, this.state.jobs.length, ...previous);
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    const previous = this.state.jobs.map(item => ({ ...item }));
    const index = this.state.jobs.findIndex(item => item.id === id);
    if (index < 0) return false;
    this.state.jobs.splice(index, 1);
    try {
      await this.repository.save(this.state);
      return true;
    } catch (error) {
      this.state.jobs.splice(0, this.state.jobs.length, ...previous);
      throw error;
    }
  }
}
