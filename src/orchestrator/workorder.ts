import { EncoreJob } from './encore';
import { ShakaJob } from './shaka';

export type WorkOrderStatus = 'OPEN' | 'CLOSED';

export type WorkOrderTaskType = 'ABR_TRANSCODE' | 'VOD_PACKAGE' | 'TRANSCRIBE';
export type WorkOrderTaskStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'FAILED';
export type WorkOrderTaskPayload = EncoreJob | ShakaJob;

export interface WorkOrderTask {
  type: WorkOrderTaskType;
  dependsOn: WorkOrderTaskType[];
  status: WorkOrderTaskStatus;
  taskPayload?: WorkOrderTaskPayload;
}

export interface WorkOrder {
  id: string;
  source: URL;
  status: WorkOrderStatus;
  tasks: WorkOrderTask[];
  createdAt: Date;
  updatedAt: Date;
}

export class WorkOrderManager {
  private workOrders: Map<string, WorkOrder> = new Map();

  async createWorkOrder(id: string, source: URL): Promise<WorkOrder> {
    // TODO: create work order depending on expected outputs
    const workOrder: WorkOrder = {
      id,
      source,
      status: 'OPEN',
      tasks: [
        {
          type: 'ABR_TRANSCODE',
          dependsOn: [],
          status: 'PENDING'
        },
        {
          type: 'VOD_PACKAGE',
          dependsOn: ['ABR_TRANSCODE'],
          status: 'PENDING'
        }
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.workOrders.set(id, workOrder);
    return workOrder;
  }

  async getWorkOrder(id: string): Promise<WorkOrder | undefined> {
    return this.workOrders.get(id);
  }

  async getOpenWorkOrders(): Promise<WorkOrder[]> {
    return Array.from(this.workOrders.values()).filter(
      (workOrder) => workOrder.status === 'OPEN'
    );
  }

  async getWorkOrderTask(
    id: string,
    taskType: WorkOrderTaskType
  ): Promise<WorkOrderTask | undefined> {
    const workOrder = this.workOrders.get(id);
    if (workOrder) {
      return workOrder.tasks.find((task) => task.type === taskType);
    }
    return undefined;
  }

  async updateWorkOrder(
    id: string,
    status: WorkOrderStatus
  ): Promise<WorkOrder | undefined> {
    const workOrder = this.workOrders.get(id);
    if (workOrder) {
      workOrder.status = status;
      workOrder.updatedAt = new Date();
      return workOrder;
    }
    return undefined;
  }

  async updateWorkOrderTask(
    id: string,
    taskType: WorkOrderTaskType,
    status: WorkOrderTaskStatus,
    taskPayload?: WorkOrderTaskPayload
  ): Promise<WorkOrder | undefined> {
    const workOrder = this.workOrders.get(id);
    if (workOrder) {
      const task = workOrder.tasks.find((t) => t.type === taskType);
      if (task) {
        task.status = status;
        task.taskPayload = taskPayload;
        workOrder.updatedAt = new Date();
        return workOrder;
      }
    }
    return undefined;
  }

  async deleteWorkOrder(id: string): Promise<boolean> {
    return this.workOrders.delete(id);
  }
}
