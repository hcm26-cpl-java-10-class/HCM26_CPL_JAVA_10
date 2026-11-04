/** Data owned by the master training system ("hệ thống tổng"), read through /api/external/*. */

// ===================== TRAINEE =====================

export interface Trainee {
    id: number;
    code?: string;
    fullName?: string;
    email?: string;
    phone?: string;
    university?: string;
    gpa?: number;
    /** studying | dropped | graduated */
    status?: string;
    /** attendance % (0-100), null if not calculated yet */
    attendance?: number | null;
    totalSessions?: number;
}

// ===================== CLASS SESSION =====================

export interface ClassCalendarVersion {
    id: number;
    classId: number;
    name: string;
    version: string;
    historyChange: string;
    lastModifiedDate: string;
    lastModifiedBy: string;
    status: "active" | "inactive" | "draft";
}

export interface ClassSession {
    id: number;
    classId: number;
    date: string;
    /** e.g. "Morning (08:30-12:00)" | "Afternoon (13:30-17:30)" */
    slot?: string;
    topic?: string;
    trainer?: string;
    room?: string;
    /** lecture | lab | exam | orientation */
    type?: string;
    /** upcoming | completed | cancelled */
    status?: string;
}

export interface AttendanceRecord {
    traineeId: number;
    traineeName?: string;
    traineeCode?: string;
    /** present | late | absent_permitted | absent | not_marked */
    status: string;
}

// ===================== BUDGET =====================

export interface BudgetItem {
    id: number;
    category: string;
    description?: string;
    amount: number;
    actual?: number;
    type?: string;
}

export interface ClassBudget {
    classId: number;
    plannedRevenue: number;
    totalPlanned: number;
    totalActual: number;
    profitLoss: number;
    items: BudgetItem[];
}

// ===================== AUDIT =====================

export interface AuditActionItem {
    id: number;
    description: string;
    dueDate?: string;
    /** open | done */
    status: string;
}

export interface AuditRecord {
    id: number;
    classId: number;
    classCode?: string;
    auditDate: string;
    auditor: string;
    trainerProfessionalism?: number;
    materialQuality?: number;
    studentsEngagement?: number;
    syllabusCompliance?: number;
    overallScore?: number;
    /** pass | warning | fail */
    result?: string;
    notes?: string;
    actionItems?: AuditActionItem[];
}

// ===================== STATUS LIFECYCLE =====================

export interface StatusTransitionInfo {
    currentStatus: string;
    transitions: string[];
    allowedLabels: { value: string; label: string }[];
    log: StatusLogEntry[];
}

export interface StatusLogEntry {
    from: string;
    to: string;
    reason?: string;
    changedBy?: string;
    changedAt: string;
}

// ===================== ANALYTICS =====================

export interface TrainingAnalytics {
    totalClasses: number;
    activeClasses: number;
    completedClasses: number;
    totalTrainees: number;
    passRate: number;
    byStatus: Record<string, number>;
    bySite: Record<string, number>;
    bySkill: Record<string, number>;
    fillRate: { code: string; enrolled: number; planned: number; pct: number }[];
    auditStats: { total: number; pass: number; warning: number; fail: number };
}

// ===================== CLASS =====================

export interface ExternalClass {
    id: number;
    code?: string;
    name?: string;
    programId?: number;
    startDate?: string;
    endDate?: string;
    /** Free text defined by the master system (e.g. "active", "completed"). */
    status?: string;
    plannedSize?: number;

    site?: string;
    traineeType?: string;
    program?: string;
    trainingProgram?: string;
    classAdmin?: string;
    enrolledTrainees?: number;
    masterTrainer?: string;
    deliveryType?: string;
    formatType?: string;
    skills?: string;
    location?: string;
    subjectType?: string;
    plannedRevenue?: string;
    scope?: string;
    supplierPartner?: string;
    keyProgram?: string;
    globalSe?: string;
    jobRecommendation?: string;
}

export interface ExternalTrainer {
    id: number;
    name?: string;
    email?: string;
    status?: string;
}

export interface ExternalRoom {
    id: number;
    name?: string;
    capacity?: number;
}
