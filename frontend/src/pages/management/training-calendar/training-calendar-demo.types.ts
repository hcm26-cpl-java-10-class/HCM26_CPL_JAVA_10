// Kiểu dữ liệu riêng cho giao diện demo, chưa phải hợp đồng API backend.
export type DemoVersionStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";

export interface DemoScheduleVersion {
  id: string;
  classId: string;
  versionNumber: number;
  status: DemoVersionStatus;
  note: string;
  updatedAt: string;
  updatedBy: string;
}
