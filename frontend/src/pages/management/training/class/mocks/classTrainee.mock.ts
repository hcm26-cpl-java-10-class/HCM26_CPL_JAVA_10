import type { ClassBudget, ClassCalendarVersion, ExternalClass, Trainee } from "@/types";

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
        code: "binhhp1",
        fullName: "Hoàng Phương Bình",
        fptAccount: "binhhp1",
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
        code: "anhtv68",
        fullName: "Trần Việt Anh",
        fptAccount: "anhtv68",
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
        code: "baotvg",
        fullName: "Trần Vũ Gia Bảo",
        fptAccount: "baotvg",
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
        code: "huydg15",
        fullName: "Đỗ Gia Huy",
        fptAccount: "huydg15",
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
        code: "huyptq2",
        fullName: "Phan Thành Quang Huy",
        fptAccount: "huyptq2",
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
        code: "khoild3",
        fullName: "Lê Đình Khôi",
        fptAccount: "khoild3",
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
        code: "namdx5",
        fullName: "Đặng Xuân Nam",
        fptAccount: "namdx5",
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
        code: "thuntm12",
        fullName: "Nguyễn Thị Minh Thư",
        fptAccount: "thuntm12",
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
        code: "tuanpq19",
        fullName: "Phạm Quốc Tuấn",
        fptAccount: "tuanpq19",
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
        code: "linhvnk3",
        fullName: "Võ Ngọc Khánh Linh",
        fptAccount: "linhvnk3",
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
    const classItem = findMockClass(idOrCode);
    const classId = classItem?.id ?? Number(idOrCode);
    const ids = MOCK_CLASS_TRAINEE_IDS[classId];
    if (!ids) {
        return MOCK_TRAINEES_POOL;
    }
    const idSet = new Set(ids);
    return MOCK_TRAINEES_POOL.filter((trainee) => idSet.has(trainee.id));
}

export function getMockBudgetByClass(idOrCode: string | number): ClassBudget {
    const classItem = findMockClass(idOrCode);
    const classId = classItem?.id ?? (Number(idOrCode) || 2);
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

export function getMockCalendarsByClass(idOrCode: string | number): ClassCalendarVersion[] {
    const classItem = findMockClass(idOrCode) ?? MOCK_TRAINING_CLASSES[0];
    return [
        {
            id: 1,
            classId: classItem.id,
            name: `${classItem.code ?? "Class"}_Calendar`,
            version: "1.0",
            historyChange: "Initial training calendar",
            lastModifiedDate: "2026-05-20T09:00:00",
            lastModifiedBy: "AnhVNP2",
            status: "active",
            classStartDate: classItem.startDate ?? "2026-05-23",
            actualLearningStartDate: classItem.startDate ?? "2026-05-23",
            overviewItems: [
                {
                    id: "topic-1",
                    label: "Java Core & OOP",
                    name: "Java Core & OOP",
                    version: "1.0",
                    startDate: "2026-05-23",
                    endDate: "2026-06-20",
                    slot: "Morning (08:30-12:00)",
                    lessons: [],
                },
                {
                    id: "topic-2",
                    label: "Spring Boot & REST API",
                    name: "Spring Boot & REST API",
                    version: "1.0",
                    startDate: "2026-06-22",
                    endDate: "2026-08-15",
                    slot: "Morning (08:30-12:00)",
                    lessons: [],
                },
            ],
        },
    ];
}

