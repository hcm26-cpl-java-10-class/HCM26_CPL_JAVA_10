import api from "@/api/axios";

export type SyllabusInput = {
    code: string;
    name: string;
    description: string;
};

export type SyllabusSummary = SyllabusInput & {
    id: number;
    sectionCount: number;
    isActive: boolean;
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
    topics: Topic[];
};

export type SyllabusDetail = SyllabusInput & {
    id: number;
    sections: SyllabusSection[];
    isActive: boolean;
};

export type SyllabusValidation = {
    valid: boolean;
    errors: string[];
};

const root = "/syllabuses";

export const syllabusApi = {
    list: async (search = "") =>
        (
            await api.get<SyllabusSummary[]>(root, {
                params: { search },
            })
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

    addSection: async (
        id: number,
        title: string,
        orderIndex: number
    ) =>
        (
            await api.post<SyllabusDetail>(
                `${root}/${id}/sections`,
                { title, orderIndex }
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

    editSection: async (
        id: number,
        sectionId: number,
        title: string,
        orderIndex: number
    ) =>
        (
            await api.put<SyllabusDetail>(
                `${root}/${id}/sections/${sectionId}`,
                { title, orderIndex }
            )
        ).data,

    deleteSection: async (
        id: number,
        sectionId: number
    ) =>
        api.delete(
            `${root}/${id}/sections/${sectionId}`
        ),

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