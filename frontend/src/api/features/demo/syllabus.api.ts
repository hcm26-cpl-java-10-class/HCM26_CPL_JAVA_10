
import api from "@/api/axios";

// ==========================================
// SYLLABUS TYPES
// ==========================================

export type SyllabusStatus = "DRAFT" | "PUBLISHED";

export type SyllabusInput = {
    code: string;
    name: string;
    description: string;
};

export type SyllabusSummary = SyllabusInput & {
    id: number;
    sectionCount: number;
    isActive: boolean;
    status: SyllabusStatus;
    completionPercent: number;
};

export type Topic = {
    id: number;
    title: string;
    orderIndex: number;
};

export type SyllabusSection = {
    id: number;
    title: string;
    orderIndex: number;
    mission: string | null;
    topics: Topic[];
};

export type SyllabusDetail = SyllabusInput & {
    id: number;
    sections: SyllabusSection[];
    isActive: boolean;
    status: SyllabusStatus;
    completionPercent: number;
};

export type SyllabusValidation = {
    valid: boolean;
    errors: string[];
};

// ==========================================
// COMPLETION PROGRESS / WORKFLOW
// ==========================================

export type SyllabusProgressCheck = {
    key: string;
    label: string;
    complete: boolean;
};

export type SyllabusProgress = {
    syllabusId: number;
    status: SyllabusStatus;
    completionPercent: number;
    canPublish: boolean;
    checks: SyllabusProgressCheck[];
    missing: string[];
};

// ==========================================
// GENERAL INFORMATION
// ==========================================

export type SyllabusInformationInput = {
    code: string;
    name: string;
    description: string;
    teachingMethods: string;
    degreeLevel: string;
    timeAllocation: string;
    studentResponsibilities: string;
    requiredTools: string;
    scoringScale: number | null;
};

export type SyllabusInformation = SyllabusInformationInput & {
    id: number;
};

// ==========================================
// CLO
// ==========================================

export type SyllabusClo = {
    id: number;
    code: string;
    details: string;
    orderIndex: number;
};

// ==========================================
// LEARNING MATERIALS
// ==========================================

export type SyllabusMaterialType =
    | "DOCUMENT"
    | "SLIDE"
    | "VIDEO"
    | "BOOK"
    | "LINK";

export type SyllabusMaterialInput = {
    title: string;
    type: SyllabusMaterialType;
    url: string;
    author: string;
    publisher: string;
    mainMaterial: boolean;
    note: string;
    topicId: number | null;
};

export type SyllabusMaterial = SyllabusMaterialInput & {
    id: number;
};

// ==========================================
// EXCEL IMPORT
// ==========================================

export type SyllabusImportSummary = {
    syllabuses: number;
    clos: number;
    sections: number;
    topics: number;
    materials: number;
};

const root = "/syllabuses";

// ==========================================
// API METHODS
// ==========================================

export const syllabusApi = {

    // --------------------------------------
    // COMPLETION PROGRESS / PUBLISH
    // --------------------------------------

    progress: async (
        id: number
    ): Promise<SyllabusProgress> =>
        (
            await api.get<SyllabusProgress>(
                `${root}/${id}/progress`
            )
        ).data,

    publish: async (
        id: number
    ): Promise<SyllabusProgress> =>
        (
            await api.post<SyllabusProgress>(
                `${root}/${id}/publish`
            )
        ).data,

    returnToDraft: async (
        id: number
    ): Promise<SyllabusProgress> =>
        (
            await api.post<SyllabusProgress>(
                `${root}/${id}/return-to-draft`
            )
        ).data,

    // --------------------------------------
    // EXCEL IMPORT
    // --------------------------------------

    importExcel: async (
        file: File
    ): Promise<SyllabusImportSummary> => {
        const formData = new FormData();

        formData.append("file", file);

        const response = await api.post<SyllabusImportSummary>(
            `${root}/import`,
            formData,
            {
                headers: {
                    "Content-Type": "multipart/form-data",
                },
            }
        );

        return response.data;
    },

    // --------------------------------------
    // CLO MANAGEMENT
    // --------------------------------------

    listClos: async (syllabusId: number) =>
        (
            await api.get<SyllabusClo[]>(
                `${root}/${syllabusId}/clos`
            )
        ).data,

    createClo: async (
        syllabusId: number,
        details: string
    ) =>
        (
            await api.post<SyllabusClo>(
                `${root}/${syllabusId}/clos`,
                { details }
            )
        ).data,

    updateClo: async (
        syllabusId: number,
        cloId: number,
        details: string
    ) =>
        (
            await api.put<SyllabusClo>(
                `${root}/${syllabusId}/clos/${cloId}`,
                { details }
            )
        ).data,

    deleteClo: async (
        syllabusId: number,
        cloId: number
    ) =>
        api.delete(
            `${root}/${syllabusId}/clos/${cloId}`
        ),

    // --------------------------------------
    // LEARNING MATERIALS
    // --------------------------------------

    listMaterials: async (syllabusId: number) =>
        (
            await api.get<SyllabusMaterial[]>(
                `${root}/${syllabusId}/materials`
            )
        ).data,

    createMaterial: async (
        syllabusId: number,
        body: SyllabusMaterialInput
    ) =>
        (
            await api.post<SyllabusMaterial>(
                `${root}/${syllabusId}/materials`,
                body
            )
        ).data,

    updateMaterial: async (
        syllabusId: number,
        materialId: number,
        body: SyllabusMaterialInput
    ) =>
        (
            await api.put<SyllabusMaterial>(
                `${root}/${syllabusId}/materials/${materialId}`,
                body
            )
        ).data,

    deleteMaterial: async (
        syllabusId: number,
        materialId: number
    ) =>
        api.delete(
            `${root}/${syllabusId}/materials/${materialId}`
        ),

    // --------------------------------------
    // GENERAL INFORMATION
    // --------------------------------------

    getInformation: async (id: number) =>
        (
            await api.get<SyllabusInformation>(
                `${root}/${id}/information`
            )
        ).data,

    updateInformation: async (
        id: number,
        body: SyllabusInformationInput
    ) =>
        (
            await api.put<SyllabusInformation>(
                `${root}/${id}/information`,
                body
            )
        ).data,

    // --------------------------------------
    // SYLLABUS CRUD
    // --------------------------------------

    list: async (search = "") =>
        (
            await api.get<SyllabusSummary[]>(
                root,
                {
                    params: { search },
                }
            )
        ).data,

    get: async (id: number) =>
        (
            await api.get<SyllabusDetail>(
                `${root}/${id}`
            )
        ).data,

    create: async (body: SyllabusInput) =>
        (
            await api.post<SyllabusDetail>(
                root,
                body
            )
        ).data,

    update: async (
        id: number,
        body: SyllabusInput
    ) =>
        (
            await api.put<SyllabusDetail>(
                `${root}/${id}`,
                body
            )
        ).data,

    delete: async (id: number) =>
        api.delete(`${root}/${id}`),

    validate: async (id: number) =>
        (
            await api.get<SyllabusValidation>(
                `${root}/${id}/validate`
            )
        ).data,

    // --------------------------------------
    // SECTIONS
    // --------------------------------------

    addSection: async (
        id: number,
        title: string,
        orderIndex: number,
        mission = ""
    ) =>
        (
            await api.post<SyllabusDetail>(
                `${root}/${id}/sections`,
                { title, orderIndex, mission }
            )
        ).data,

    editSection: async (
        id: number,
        sectionId: number,
        title: string,
        orderIndex: number,
        mission = ""
    ) =>
        (
            await api.put<SyllabusDetail>(
                `${root}/${id}/sections/${sectionId}`,
                { title, orderIndex, mission }
            )
        ).data,

    bulkSections: async (
        id: number,
        titles: string[]
    ) =>
        (
            await api.post<SyllabusDetail>(
                `${root}/${id}/sections/bulk`,
                { titles }
            )
        ).data,

    deleteSection: async (
        id: number,
        sectionId: number
    ) =>
        api.delete(
            `${root}/${id}/sections/${sectionId}`
        ),

    // --------------------------------------
    // TOPICS
    // --------------------------------------

    addTopic: async (
        id: number,
        sectionId: number,
        title: string
    ) =>
        (
            await api.post<SyllabusDetail>(
                `${root}/${id}/sections/${sectionId}/topics`,
                { title }
            )
        ).data,

    editTopic: async (
        id: number,
        sectionId: number,
        topicId: number,
        title: string
    ) =>
        (
            await api.put<SyllabusDetail>(
                `${root}/${id}/sections/${sectionId}/topics/${topicId}`,
                { title }
            )
        ).data,

    deleteTopic: async (
        id: number,
        sectionId: number,
        topicId: number
    ) =>
        api.delete(
            `${root}/${id}/sections/${sectionId}/topics/${topicId}`
        ),
};