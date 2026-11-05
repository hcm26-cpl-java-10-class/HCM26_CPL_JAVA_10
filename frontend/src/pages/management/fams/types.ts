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
    code: string;
    name: string;
    url: string;
    linkInfo: string;
    status: "Active" | "Inactive";
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
