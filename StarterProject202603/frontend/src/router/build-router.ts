import { AutoCrudPage } from "@/pages/management/AutoCrudPage";
import type { EntityConfig } from "@/types";
import { createElement, type ComponentType } from "react";
import { normalizeEntityActionPath } from "./entity-action.utils";

type EntityModule = {
    entityConfig?: EntityConfig;
};

const entityModules = import.meta.glob("../pages/management/**/index.tsx", {
    eager: true,
}) as Record<string, EntityModule>;

type EntityRoute = {
    path: string;
    component: ComponentType<any>;
    isModuleDriven: boolean;
    requiredPermission?: string;
};

const DEFAULT_ACTION_PERMISSION: Record<"create" | "edit" | "detail", "CREATE" | "UPDATE" | "READ"> = {
    create: "CREATE",
    edit: "UPDATE",
    detail: "READ",
};

const resolvePermissionResource = (entityName: string) => {
    const normalizedName = (entityName || "").trim().toLowerCase();

    if (normalizedName === "module" || normalizedName === "module-group" || normalizedName === "module_group") {
        return "MENU";
    }

    return normalizedName.replace(/[-\s]+/g, "_").toUpperCase();
};

function buildDefaultActionPermission(entity: EntityConfig, action: "create" | "edit" | "detail") {
    const resource = resolvePermissionResource(entity.schema.entityName);
    return `${resource}_${DEFAULT_ACTION_PERMISSION[action]}`;
}

function buildEntityActionRoutes(entity: EntityConfig): EntityRoute[] {
    const actionPages = entity.actionPages;

    if (!actionPages) {
        return [];
    }

    const actions: Array<"create" | "edit" | "detail"> = ["create", "edit", "detail"];

    return actions.flatMap((action) => {
        const config = actionPages[action];

        if (!config) {
            return [];
        }

        return [
            {
                path: normalizeEntityActionPath(entity.path, config.path),
                component: () => createElement(config.component, { entity }),
                requiredPermission: config.requiredPermission || buildDefaultActionPermission(entity, action),
                isModuleDriven: false,
            },
        ];
    });
}

function getEntityConfigs(): EntityConfig[] {
    const entitiesByPath = new Map<string, EntityConfig>();

    for (const moduleExports of Object.values(entityModules)) {
        const config = moduleExports.entityConfig;

        if (!config) {
            continue;
        }

        entitiesByPath.set(config.path, config);
    }

    return [...entitiesByPath.values()];
}

export function buildEntityRoutes(): EntityRoute[] {
    const entities = getEntityConfigs();
    const routesByPath = new Map<string, EntityRoute>();

    for (const entity of entities) {
        routesByPath.set(entity.path, {
            path: entity.path,
            component: () => createElement(AutoCrudPage, { entity }),
            isModuleDriven: true,
        });

        for (const actionRoute of buildEntityActionRoutes(entity)) {
            routesByPath.set(actionRoute.path, actionRoute);
        }
    }

    return [...routesByPath.values()];
}