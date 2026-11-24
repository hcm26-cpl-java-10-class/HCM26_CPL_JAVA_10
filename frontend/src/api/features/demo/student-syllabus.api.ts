
import api from "@/api/axios";

export type StudentSyllabusItem = {
    id: number;
    code: string;
    name: string;
    description: string | null;
    sectionCount: number;
};

export type StudentSyllabusCatalog = {
    items: StudentSyllabusItem[];
    page: number;
    size: number;
    totalElements: number;
    totalPages: number;
};

export type StudentRelatedCourse = {
    id: number;
    name: string;
};

export type StudentSyllabusDetail = {
    id: number;
    code: string;
    name: string;
    description: string | null;
    teachingMethods: string | null;
    degreeLevel: string | null;
    timeAllocation: string | null;
    studentResponsibilities: string | null;
    requiredTools: string | null;
    scoringScale: number | null;

    sections: Array<{
        id: number;
        title: string;
        orderIndex: number;
        mission: string | null;
        topics: Array<{
            id: number;
            title: string;
            orderIndex: number;
            cloIds: number[];
        }>;
    }>;

    clos: Array<{
        id: number;
        code: string;
        details: string;
        orderIndex: number;
    }>;

    materials: Array<{
        id: number;
        title: string;
        type:
            | "DOCUMENT"
            | "SLIDE"
            | "VIDEO"
            | "BOOK"
            | "LINK";
        url: string;
        author: string | null;
        publisher: string | null;
        mainMaterial: boolean;
        note: string | null;
        topicId: number | null;
    }>;
};

const base = "/student/syllabuses";

export const studentSyllabusApi = {
    list: async (params: {
        search: string;
        searchBy: string;
        sortBy: string;
        page: number;
    }) =>
        (
            await api.get<StudentSyllabusCatalog>(
                base,
                { params }
            )
        ).data,

    downloadArchive: async (id: number): Promise<Blob> =>
        (await api.get(`${base}/${id}/materials.zip`, { responseType: "blob" })).data,

    downloadFile: async (id: number, key: string): Promise<Blob> =>
        (await api.get(`${base}/${id}/material-files/${encodeURIComponent(key)}`, { responseType: "blob" })).data,

    /** On-demand AI translation. Responses are display-only, not stored in the Syllabus. */
    translatePage: async (ids: number[]): Promise<StudentSyllabusItem[]> =>
        (await api.post<StudentSyllabusItem[]>(`${base}/translations`, { ids })).data,

    translateDetail: async (id: number): Promise<StudentSyllabusDetail> =>
        (await api.post<StudentSyllabusDetail>(`${base}/${id}/translation`)).data,

    relatedCourses: async (id: number): Promise<StudentRelatedCourse[]> =>
        (await api.get<StudentRelatedCourse[]>(`${base}/${id}/related-courses`)).data,

    detail: async (id: number) =>
        (
            await api.get<StudentSyllabusDetail>(
                `${base}/${id}`
            )
        ).data,
};
