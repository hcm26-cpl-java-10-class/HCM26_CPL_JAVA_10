/** Data owned by the master training system ("hệ thống tổng"), read through /api/external/*. */

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
