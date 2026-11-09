import type { ClassBudget, ExternalClass, Trainee } from "@/types";

export interface MockTraineeMutationInput {
    fullName: string;
    fptAccount: string;
    personalEmail: string;
    nationalId: string;
    employeeId?: string;
    accessCardId?: string;
    dob?: string;
    gender?: string;
    status?: string;
}

export const MOCK_TRAINING_CLASSES: ExternalClass[] = [
    {
        id: 2,
        code: "HCM26_FR_JAVA_03",
        name: "HCM26_FR_JAVA_03",
        deliveryType: "Class",
        traineeType: "Fresher",
        formatType: "Offline",
        skills: "Java",
        program: "FR_NFP_JAVA_2",
        trainingProgram: "[NFP] Fresher Full-stack Java Developer for SCM 1.0",
        programId: 2,
        site: "TP. Ho Chi Minh",
        location: "Center Building, HCM",
        startDate: "2026-05-23",
        endDate: "2026-11-22",
        plannedSize: 10,
        enrolledTrainees: 10,
        subjectType: "IT Technical",
        plannedRevenue: "0 VND",
        scope: "Unit",
        supplierPartner: "SCM",
        keyProgram: "",
        globalSe: "No",
        jobRecommendation: "No",
        classAdmin: "AnhVNP2, BinhHBB",
        masterTrainer: "NgaTTT45",
        status: "active",
    },
    {
        id: 1,
        code: "HCM26_FR_FU_KS_JAVA_01",
        name: "HCM26_FR_FU_KS_JAVA_01",
        deliveryType: "Class",
        traineeType: "Fresher",
        formatType: "Offline",
        skills: "Java",
        program: "[FSA.HCM] FR_NFP_JAVA_KS",
        trainingProgram: "[FSA.HCM] FR_NFP_JAVA_KS",
        programId: 1,
        site: "TP. Ho Chi Minh",
        location: "Center Building, HCM",
        startDate: "2026-01-23",
        endDate: "2026-07-23",
        plannedSize: 23,
        enrolledTrainees: 7,
        subjectType: "IT Technical",
        plannedRevenue: "0 VND",
        scope: "Unit",
        supplierPartner: "SCM",
        keyProgram: "",
        globalSe: "No",
        jobRecommendation: "No",
        classAdmin: "NhiNLY4, UyenHTM",
        masterTrainer: "NgaTTT45",
        status: "completed",
    },
    {
        id: 3,
        code: "HCM26_FR_JAVA_02",
        name: "HCM26_FR_JAVA_02",
        deliveryType: "Class",
        traineeType: "Fresher",
        formatType: "Offline",
        skills: "Java",
        program: "FR_NFP_JAVA",
        trainingProgram: "[NFP] Fresher Java Developer",
        programId: 3,
        site: "TP. Ho Chi Minh",
        location: "Center Building, HCM",
        startDate: "2026-04-23",
        endDate: "2026-10-23",
        plannedSize: 10,
        enrolledTrainees: 10,
        subjectType: "IT Technical",
        plannedRevenue: "0 VND",
        scope: "Unit",
        supplierPartner: "SCM",
        keyProgram: "",
        globalSe: "No",
        jobRecommendation: "No",
        classAdmin: "AnhLNP2, DuyenNPK3",
        masterTrainer: "NgaTTT45",
        status: "active",
    },
];

export const MOCK_TRAINEES_POOL: Trainee[] = [
    {
        id: 101,
        code: "SE180101",
        fullName: "Hoàng Phương Bình",
        fptAccount: "SE180101",
        personalEmail: "phuongbinh.conan@gmail.com",
        email: "phuongbinh.conan@gmail.com",
        nationalId: "075204005839",
        employeeId: "",
        accessCardId: "",
        dob: "2004-08-23",
        gender: "Male",
        status: "Active",
    },
    {
        id: 102,
        code: "SS180102",
        fullName: "Trần Việt Anh",
        fptAccount: "SS180102",
        personalEmail: "anhviettran357@gmail.com",
        email: "anhviettran357@gmail.com",
        nationalId: "091204006506",
        employeeId: "",
        accessCardId: "",
        dob: "2004-01-28",
        gender: "Male",
        status: "Active",
    },
    {
        id: 103,
        code: "AI180103",
        fullName: "Trần Vũ Gia Bảo",
        fptAccount: "AI180103",
        personalEmail: "baohse321@gmail.com",
        email: "baohse321@gmail.com",
        nationalId: "052203001644",
        employeeId: "",
        accessCardId: "",
        dob: "2003-09-23",
        gender: "Male",
        status: "Active",
    },
    {
        id: 104,
        code: "IA180104",
        fullName: "Đỗ Gia Huy",
        fptAccount: "IA180104",
        personalEmail: "dogiahuy2252004@gmail.com",
        email: "dogiahuy2252004@gmail.com",
        nationalId: "079204001295",
        employeeId: "",
        accessCardId: "",
        dob: "2004-05-22",
        gender: "Male",
        status: "Active",
    },
    {
        id: 105,
        code: "SE180105",
        fullName: "Phan Thành Quang Huy",
        fptAccount: "SE180105",
        personalEmail: "ptqhuy1606@gmail.com",
        email: "ptqhuy1606@gmail.com",
        nationalId: "046204000175",
        employeeId: "",
        accessCardId: "",
        dob: "2004-06-16",
        gender: "Male",
        status: "Active",
    },
    {
        id: 106,
        code: "SS180106",
        fullName: "Lê Đình Khôi",
        fptAccount: "SS180106",
        personalEmail: "koledinleko@gmail.com",
        email: "koledinleko@gmail.com",
        nationalId: "079202004580",
        employeeId: "",
        accessCardId: "",
        dob: "2002-09-27",
        gender: "Male",
        status: "Active",
    },
    {
        id: 107,
        code: "AI180107",
        fullName: "Đặng Xuân Nam",
        fptAccount: "AI180107",
        personalEmail: "dangxuannam32@gmail.com",
        email: "dangxuannam32@gmail.com",
        nationalId: "052204002602",
        employeeId: "",
        accessCardId: "",
        dob: "2004-03-12",
        gender: "Male",
        status: "Active",
    },
    {
        id: 108,
        code: "IA180108",
        fullName: "Nguyễn Thị Minh Thư",
        fptAccount: "IA180108",
        personalEmail: "minhthu.nguyen04@gmail.com",
        email: "minhthu.nguyen04@gmail.com",
        nationalId: "079304008112",
        employeeId: "FPT26081",
        accessCardId: "AC-88201",
        dob: "2004-11-05",
        gender: "Female",
        status: "Active",
    },
    {
        id: 109,
        code: "SE180109",
        fullName: "Phạm Quốc Tuấn",
        fptAccount: "SE180109",
        personalEmail: "quoctuan.pham@gmail.com",
        email: "quoctuan.pham@gmail.com",
        nationalId: "075203009421",
        employeeId: "FPT26082",
        accessCardId: "AC-88202",
        dob: "2003-07-19",
        gender: "Male",
        status: "Active",
    },
    {
        id: 110,
        code: "SS180110",
        fullName: "Võ Ngọc Khánh Linh",
        fptAccount: "SS180110",
        personalEmail: "khanhlinh.vo04@gmail.com",
        email: "khanhlinh.vo04@gmail.com",
        nationalId: "048304003519",
        employeeId: "",
        accessCardId: "",
        dob: "2004-02-14",
        gender: "Female",
        status: "Active",
    },
];

const MOCK_CLASS_TRAINEE_IDS: Record<number, number[]> = {
    1: [101, 102, 103, 104, 105, 106, 107],
    2: [101, 102, 103, 104, 105, 106, 107, 108, 109, 110],
    3: [101, 102, 103, 104, 105, 106, 107, 108, 109, 110],
};

function resolveClassId(idOrCode: string | number): number {
    const classItem = findMockClass(idOrCode);
    return classItem?.id ?? (Number(idOrCode) || 2);
}

function syncMockEnrolledCount(classId: number) {
    const cls = MOCK_TRAINING_CLASSES.find((item) => item.id === classId);
    if (cls && MOCK_CLASS_TRAINEE_IDS[classId]) {
        cls.enrolledTrainees = MOCK_CLASS_TRAINEE_IDS[classId].length;
    }
}

export function findMockClass(idOrCode: string | number): ExternalClass | undefined {
    const raw = String(idOrCode).trim();
    const normalized = raw.toLowerCase();
    return MOCK_TRAINING_CLASSES.find(
        (item) =>
            String(item.id) === raw ||
            (item.code ?? "").toLowerCase() === normalized ||
            (item.name ?? "").toLowerCase() === normalized,
    );
}

export function getMockTraineesByClass(idOrCode: string | number): Trainee[] {
    const classId = resolveClassId(idOrCode);
    const ids = MOCK_CLASS_TRAINEE_IDS[classId];
    if (!ids) {
        return MOCK_TRAINEES_POOL.map((trainee) => ({ ...trainee }));
    }
    const byId = new Map(MOCK_TRAINEES_POOL.map((trainee) => [trainee.id, trainee]));
    return ids
        .map((id) => byId.get(id))
        .filter((trainee): trainee is Trainee => Boolean(trainee))
        .map((trainee) => ({ ...trainee }));
}

export function createMockTrainee(idOrCode: string | number, input: MockTraineeMutationInput): Trainee {
    const classId = resolveClassId(idOrCode);
    const nextId = MOCK_TRAINEES_POOL.reduce((max, item) => Math.max(max, item.id), 100) + 1;
    const account = input.fptAccount.trim();
    const email = input.personalEmail.trim();
    const created: Trainee = {
        id: nextId,
        code: account,
        fptAccount: account,
        fullName: input.fullName.trim(),
        personalEmail: email,
        email,
        nationalId: input.nationalId.trim(),
        employeeId: (input.employeeId ?? "").trim(),
        accessCardId: (input.accessCardId ?? "").trim(),
        dob: input.dob ?? "",
        gender: input.gender ?? "Male",
        status: input.status ?? "Active",
    };

    MOCK_TRAINEES_POOL.push(created);
    if (!MOCK_CLASS_TRAINEE_IDS[classId]) {
        MOCK_CLASS_TRAINEE_IDS[classId] = [];
    }
    MOCK_CLASS_TRAINEE_IDS[classId].push(nextId);
    syncMockEnrolledCount(classId);
    return { ...created };
}

export function updateMockTrainee(
    _idOrCode: string | number,
    traineeId: number,
    input: Partial<MockTraineeMutationInput>,
): Trainee {
    const target = MOCK_TRAINEES_POOL.find((item) => item.id === traineeId);
    if (!target) {
        throw Object.assign(new Error(`Trainee #${traineeId} not found`), { response: { status: 404 } });
    }

    const account = (input.fptAccount ?? target.fptAccount ?? target.code ?? "").trim();
    const email = (input.personalEmail ?? target.personalEmail ?? target.email ?? "").trim();

    Object.assign(target, {
        fullName: input.fullName !== undefined ? input.fullName.trim() : target.fullName,
        fptAccount: account,
        code: account,
        personalEmail: email,
        email,
        nationalId: input.nationalId !== undefined ? input.nationalId.trim() : target.nationalId,
        employeeId: input.employeeId !== undefined ? input.employeeId.trim() : target.employeeId,
        accessCardId: input.accessCardId !== undefined ? input.accessCardId.trim() : target.accessCardId,
        dob: input.dob !== undefined ? input.dob : target.dob,
        gender: input.gender !== undefined ? input.gender : target.gender,
        status: input.status !== undefined ? input.status : target.status,
    });

    return { ...target };
}

export function deleteMockTrainee(idOrCode: string | number, traineeId: number): void {
    const classId = resolveClassId(idOrCode);
    const current = MOCK_CLASS_TRAINEE_IDS[classId] ?? [];
    MOCK_CLASS_TRAINEE_IDS[classId] = current.filter((id) => id !== traineeId);
    syncMockEnrolledCount(classId);
}

export function batchSaveMockTrainees(
    idOrCode: string | number,
    payload: {
        created: MockTraineeMutationInput[];
        updated: Trainee[];
        deletedIds: number[];
    },
): { message: string; trainees: Trainee[] } {
    const classId = resolveClassId(idOrCode);
    if (!MOCK_CLASS_TRAINEE_IDS[classId]) {
        MOCK_CLASS_TRAINEE_IDS[classId] = [];
    }

    if (payload.deletedIds.length > 0) {
        const deletedSet = new Set(payload.deletedIds);
        MOCK_CLASS_TRAINEE_IDS[classId] = MOCK_CLASS_TRAINEE_IDS[classId].filter((id) => !deletedSet.has(id));
    }

    for (const item of payload.updated) {
        updateMockTrainee(classId, item.id, {
            fullName: item.fullName,
            fptAccount: item.fptAccount ?? item.code,
            personalEmail: item.personalEmail ?? item.email,
            nationalId: item.nationalId,
            employeeId: item.employeeId,
            accessCardId: item.accessCardId,
            dob: item.dob,
            gender: item.gender,
            status: item.status,
        });
    }

    for (const item of payload.created) {
        createMockTrainee(classId, item);
    }

    syncMockEnrolledCount(classId);
    return {
        message: "Trainee changes saved successfully!",
        trainees: getMockTraineesByClass(classId),
    };
}

export function getMockBudgetByClass(idOrCode: string | number): ClassBudget {
    const classId = resolveClassId(idOrCode);
    return {
        classId,
        plannedRevenue: 0,
        totalPlanned: 16_000_000,
        totalActual: 9_600_000,
        profitLoss: -9_600_000,
        items: [
            { id: 1, category: "Trainer Fee", description: "NgaTTT45 - 80 hours", amount: 12_000_000, actual: 7_200_000, type: "expense" },
            { id: 2, category: "Facility", description: "Room rental - Center Building, HCM", amount: 3_000_000, actual: 1_800_000, type: "expense" },
            { id: 3, category: "Materials", description: "Learning materials & lab setup", amount: 1_000_000, actual: 600_000, type: "expense" },
        ],
    };
}
