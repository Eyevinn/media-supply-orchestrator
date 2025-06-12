import { createClient, RedisClientType } from '@redis/client';
import { EncoreJob } from './encore';
import { ShakaJob } from './shaka';

export type WorkOrderStatus = 'OPEN' | 'CLOSED';

export type WorkOrderTaskType =
  | 'ABR_TRANSCODE'
  | 'VOD_PACKAGE'
  | 'TRANSCRIBE'
  | 'CLEANUP';
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

export interface WorkOrderManagerOpts {
  redisUrl?: URL;
}

export function serializeWorkOrder(workOrder: WorkOrder): string {
  return JSON.stringify({
    ...workOrder,
    source: workOrder.source.toString(),
    createdAt: workOrder.createdAt.toISOString(),
    updatedAt: workOrder.updatedAt.toISOString()
  });
}

export function deserializeWorkOrder(data: string): WorkOrder {
  const parsed = JSON.parse(data);
  return {
    ...parsed,
    source: new URL(parsed.source),
    createdAt: new Date(parsed.createdAt),
    updatedAt: new Date(parsed.updatedAt)
  };
}

export class WorkOrderManager {
  private workOrders: Map<string, WorkOrder> = new Map();
  private redisClient?: RedisClientType;
  private connected = false;

  constructor(opts?: WorkOrderManagerOpts) {
    // Initialize Redis connection if opts.redisUrl is provided
    if (opts?.redisUrl) {
      this.redisClient = createClient({ url: opts.redisUrl.toString() });
      console.log(`Connecting to Redis at ${opts.redisUrl}`);
    }
  }

  private async connect() {
    if (this.redisClient && !this.connected) {
      this.redisClient.on('error', (err) => {
        console.error('Redis Client Error', err);
      });
      await this.redisClient.connect();
      this.connected = true;
    }
  }

  async createWorkOrder(
    id: string,
    source: URL,
    tasks: WorkOrderTask[]
  ): Promise<WorkOrder> {
    await this.connect();
    const workOrder: WorkOrder = {
      id,
      source,
      status: 'OPEN',
      tasks,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    if (this.redisClient) {
      await this.redisClient.set(id, JSON.stringify(workOrder));
    } else {
      this.workOrders.set(id, workOrder);
    }
    return workOrder;
  }

  async getWorkOrder(id: string): Promise<WorkOrder | undefined> {
    await this.connect();
    if (this.redisClient) {
      const data = await this.redisClient.get(id);
      return data ? deserializeWorkOrder(data) : undefined;
    }
    return this.workOrders.get(id);
  }

  async getOpenWorkOrders(): Promise<WorkOrder[]> {
    await this.connect();
    if (this.redisClient) {
      const keys = await this.redisClient.keys('*');
      const workOrders = await Promise.all(
        keys.map((key) => this.getWorkOrder(key))
      );
      return workOrders.filter(
        (wo) => wo && wo.status === 'OPEN'
      ) as WorkOrder[];
    }
    return Array.from(this.workOrders.values()).filter(
      (workOrder) => workOrder.status === 'OPEN'
    );
  }

  async getWorkOrderTask(
    id: string,
    taskType: WorkOrderTaskType
  ): Promise<WorkOrderTask | undefined> {
    await this.connect();
    const workOrder = await this.getWorkOrder(id);
    if (workOrder) {
      return workOrder.tasks.find((task) => task.type === taskType);
    }
    return undefined;
  }

  async updateWorkOrder(
    id: string,
    status: WorkOrderStatus
  ): Promise<WorkOrder | undefined> {
    const workOrder = await this.getWorkOrder(id);
    if (workOrder) {
      workOrder.status = status;
      workOrder.updatedAt = new Date();
      if (this.redisClient) {
        await this.redisClient.set(id, serializeWorkOrder(workOrder));
        if (status === 'CLOSED') {
          await this.redisClient.expire(id, 60); // Set expiration for 1 minute
        }
      } else {
        this.workOrders.set(id, workOrder);
      }
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
    const workOrder = await this.getWorkOrder(id);
    if (workOrder) {
      const task = workOrder.tasks.find((t) => t.type === taskType);
      if (task) {
        task.status = status;
        if (taskPayload) {
          task.taskPayload = taskPayload;
        }
        workOrder.updatedAt = new Date();
        if (this.redisClient) {
          await this.redisClient.set(id, serializeWorkOrder(workOrder));
        } else {
          this.workOrders.set(id, workOrder);
        }
        return workOrder;
      }
    }
    return undefined;
  }

  async deleteWorkOrder(id: string): Promise<boolean> {
    if (this.redisClient) {
      const result = await this.redisClient.del(id);
      return result > 0;
    }
    return this.workOrders.delete(id);
  }
}
