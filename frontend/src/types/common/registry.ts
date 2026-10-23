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
}

/** Card view layout: responsive grid (default) or full-width stacked rows. */
export type EntityCardLayout = "grid" | "list";

export interface EntityConfig {
    name: string;
    path: string;
    api: any;
    schema: EntitySchema;
    actionPages?: EntityActionPagesConfig;
    cardRenderer?: (props: EntityCardRendererProps) => ReactNode;
    /** Layout used by the card view. Defaults to "grid". */
    cardLayout?: EntityCardLayout;
    /**
     * Keep the read-only browse view for the student role, but still expose the
     * "Create" action (opened in the inline form modal) when the user holds the
     * `<RESOURCE>_CREATE` permission. Used by entities whose use case is owned by
     * the student persona (e.g. Sprints).
     */
    browseModeCreate?: boolean;
    /**
     * Also keep row actions (edit / delete / active toggle) available in the
     * student browse view, when the user holds the matching
     * `<RESOURCE>_UPDATE` / `<RESOURCE>_DELETE` permissions. Used by entities
     * fully owned by the student persona (e.g. Sprints).
     */
    browseModeActions?: boolean;
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