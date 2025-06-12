import { parse } from 'yaml';
import { WorkOrderTask } from './workorder';

export class Workflow {
  private tasks?: WorkOrderTask[];
  private workflowDefinitionUrl: URL;

  constructor(workflowDefinitionUrl: URL) {
    this.tasks = undefined;
    this.workflowDefinitionUrl = workflowDefinitionUrl;
  }

  private async loadWorkflowDefinition(url: URL): Promise<WorkOrderTask[]> {
    let data;
    if (url.protocol === 'file:') {
      const fs = await import('fs/promises');
      const filePath = url.pathname;
      console.debug(`Loading workflow definition from file: ${filePath}`);
      data = await fs.readFile(filePath, 'utf-8');
    } else if (url.protocol === 'http:' || url.protocol === 'https:') {
      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(
          `Failed to fetch workflow definition: ${response.statusText}`
        );
      }
      data = await response.text();
    } else {
      throw new Error(
        `Unsupported protocol to fetch workflow definition: ${url.protocol}`
      );
    }
    const parsed = parse(data);
    const steps = parsed.steps;
    steps.forEach((step: WorkOrderTask) => {
      step.status = 'PENDING'; // Ensure all tasks start with PENDING status
    });
    return steps;
  }

  public async getTasks(): Promise<WorkOrderTask[]> {
    if (this.tasks === undefined) {
      this.tasks = await this.loadWorkflowDefinition(
        this.workflowDefinitionUrl
      );
      console.debug(
        `Loaded workflow definition from ${this.workflowDefinitionUrl}: `,
        this.tasks
      );
    }
    return this.tasks;
  }
}
