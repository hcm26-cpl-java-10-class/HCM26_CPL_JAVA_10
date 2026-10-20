import type { EntitySchema } from "@/types/common/datatable";
import type { FieldSchema } from "@/types/common/datatable";
import type { ComponentType, ReactNode } from "react";

export type EntityActionPage = "create" | "edit" | "detail";

export interface EntityActionPageConfig {
    path: string;
    component: ComponentType<any>;
    requiredPermission?: string;
}

export type EntityActionPagesConfig = Partial<Record<EntityActionPage, EntityActionPageConfig>>;

export interface EntityCardRendererProps {
    row: any;
    index: number;
    idField: string;
    isSelected: boolean;
    showActions?: boolean;
    visibleFields: FieldSchema[];
    relationOptions: Record<string, any[]>;
    selectable?: boolean;
    showIndex?: boolean;
    onSelect: (id: any) => void;
    onRowClick?: (row: any) => void;
    renderRowActions?: (row: any) => ReactNode;
    onView: (row: any) => void;
    onEdit: (row: any) => void;
    onDelete: (row: any) => void;
    onBooleanToggle: (id: any, fieldName: string, newValue: boolean) => void;
    disableBooleanToggle?: boolean;
    isRowProtected?: (row: any) => boolean;
}

export interface EntityConfig {
    name: string;
    path: string;
    api: any;
    schema: EntitySchema;
    isRowProtected?: (row: any) => boolean;
    renderSelectionActions?: (table: any) => ReactNode;
    actionPages?: EntityActionPagesConfig;
    cardRenderer?: (props: EntityCardRendererProps) => ReactNode;
}

const registry: EntityConfig[] = [];

export function registerEntity(entity: EntityConfig) {
    const existingIndex = registry.findIndex((item) => item.path === entity.path);

    if (existingIndex >= 0) {
        registry[existingIndex] = entity;
        return;
    }

    registry.push(entity);
}

export function getEntities() {
    return registry;
}