export interface InactiveMember {
  userId: number; userCode: string | null; displayName: string; joinedAt: string | null; lastContributionAt: string | null;
  activityStatus: "INACTIVE" | "ACTIVE" | "NEW_MEMBER" | "JOIN_DATE_UNKNOWN"; inactive: boolean;
  lastReminderAt: string | null; nextReminderAt: string | null; coolingDown: boolean;
}
export interface InactiveMemberPage {
  projectId: string; projectName: string; inactivityHours: number; cooldownSeconds: number; canSend: boolean; content: InactiveMember[];
}
export interface MemberReminderResult {
  batchId: string; eventId: string; projectId: string; recipientCount: number; status: "PENDING" | "PUBLISHED"; createdAt: string; correlationId: string;
}
export interface MemberReminderHistory {
  batchId: string; actorId: number; warningNote: string; status: "PENDING" | "PUBLISHED"; createdAt: string; correlationId: string;
}
