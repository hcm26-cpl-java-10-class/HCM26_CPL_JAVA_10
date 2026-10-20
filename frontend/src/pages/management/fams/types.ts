export interface ModuleGroupItem {
    id: string;
    name: string;
    description?: string;
    displayOrder: number;
    moduleCount?: number;
}

export interface ModuleItem {
    id: string;
    groupId: string;
    code: string; // Mã (e.g. IT-HN, JAVA, REACT)
    name: string; // Tên (e.g. Information Technology)
    url: string; // URL (e.g. Hòa Lạc, Programming, Frontend)
    linkInfo: string; // Liên kết (e.g. 128 users, 12 topics, 8 topics)
    status: "Active" | "Inactive"; // Trạng thái
    displayOrder?: number;
    description?: string;
}

export interface ModuleGroupFormData {
    name: string;
    description: string;
    displayOrder: number;
}

export interface ModuleFormData {
    groupId: string;
    code: string;
    name: string;
    url: string;
    linkInfo: string;
    status: "Active" | "Inactive";
    description?: string;
}
