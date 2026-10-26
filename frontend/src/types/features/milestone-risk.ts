export interface MilestoneRiskProgress { doneTasks: number; totalTasks: number; completionRate: number; eligible: boolean }
export interface MilestoneRiskItem {
  id: string; title: string; status: "PLANNED" | "OPEN" | "CLOSED" | "CANCELLED"; deadline: string; version: number;
  atRisk: boolean; progress: MilestoneRiskProgress; canSend: boolean;
}
export interface MilestoneRiskPage {
  projectId: string; projectName: string; actorId: number; tenantId: number; canSend: boolean;
  warningWindowHours: number; completionThreshold: number; content: MilestoneRiskItem[];
}
export interface MilestoneRiskResult {
  alertId: string; eventId: string; milestoneId: string; atRisk: boolean; recipientCount: number;
  status: "PENDING" | "PUBLISHED"; createdAt: string; correlationId: string;
}
export interface MilestoneRiskHistory {
  alertId: string; actorId: number; warningNote: string; status: "PENDING" | "PUBLISHED"; createdAt: string; correlationId: string;
}
