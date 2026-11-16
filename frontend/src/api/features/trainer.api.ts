import axios from "@/api/axios";

export interface TeachingTopic { id: number; code: string; name: string; version: string; active: boolean }
export interface Trainer {
    id: number; trainerCode: string; fullName: string; email: string; specialization: string;
    status: "ACTIVE" | "INACTIVE"; teachingTopics: TeachingTopic[]; source: "INTERNAL";
}
export interface TrainerInput {
    trainerCode: string; fullName: string; email: string; specialization: string;
    status: "ACTIVE" | "INACTIVE"; teachingTopicIds: number[];
}
export interface TrainerPage { content: Trainer[]; totalPages: number; totalElements: number }
export interface TrainerPreview {
    totalRows: number; validRows: number; canImport: boolean;
    rows: Array<{ rowNumber: number; cells: string[]; valid: boolean; errors: string[] }>;
}
const upload = (file: File) => { const body = new FormData(); body.append("file", file); return body; };
export const trainerApi = {
    list: async (params: { search?: string; status?: string; page?: number; size?: number }) =>
        (await axios.get<TrainerPage>("/trainers", { params })).data,
    get: async (id: number) => (await axios.get<Trainer>(`/trainers/${id}`)).data,
    create: async (data: TrainerInput) => (await axios.post<Trainer>("/trainers", data)).data,
    update: async (id: number, data: TrainerInput) => (await axios.put<Trainer>(`/trainers/${id}`, data)).data,
    status: async (id: number, status: Trainer["status"]) => (await axios.patch<Trainer>(`/trainers/${id}/status`, { status })).data,
    delete: async (id: number) => { await axios.delete(`/trainers/${id}`); },
    topics: async () => (await axios.get<TeachingTopic[]>("/trainers/teaching-topics")).data,
    template: async () => (await axios.get<Blob>("/trainers/import/template", { responseType: "blob" })).data,
    preview: async (file: File) => (await axios.post<TrainerPreview>("/trainers/import/preview", upload(file), { headers: { "Content-Type": "multipart/form-data" } })).data,
    import: async (file: File) => (await axios.post<{ imported: number }>("/trainers/import", upload(file), { headers: { "Content-Type": "multipart/form-data" } })).data,
    verifiedOptions: async (): Promise<Trainer[]> => {
        const records: Trainer[] = [];
        for (let page = 0; ; page++) {
            const data = (await axios.get<TrainerPage>("/trainers/options", { params: { page, size: 100 } })).data;
            records.push(...data.content);
            if (page + 1 >= data.totalPages) break;
        }
        // Verify this catalog, not the external source used independently by Study Session.
        const source = (await axios.get<{ source: string; approved: boolean; sampleData: boolean }>("/trainers/data-source")).data;
        if (source.source !== "INTERNAL" || source.approved !== true || source.sampleData !== false)
            throw new Error("BLOCKED: Internal Master Trainer directory is sample or unverified.");
        return records.filter(t => t.source === "INTERNAL" && t.status === "ACTIVE" && Number.isSafeInteger(t.id) && t.id > 0 && t.fullName?.trim());
    },
};
