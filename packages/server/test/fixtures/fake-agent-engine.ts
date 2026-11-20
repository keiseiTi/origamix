import {
  getAgentModel,
  type AgentEngine,
  type AgentEngineRequest,
  type AgentEngineResult,
} from '@/agent/agent-engine';

export class FakeAgentEngine implements AgentEngine {
  constructor(
    private readonly handler: (request: AgentEngineRequest) => Promise<AgentEngineResult>,
  ) {}

  async run(request: AgentEngineRequest): Promise<AgentEngineResult> {
    getAgentModel(request.modelId);
    return await this.handler(request);
  }
}
