import { sessionApi } from "@/api/features/demo/session.api";
import type { EntityConfig } from "@/types";
import { sessionSchema } from "./session.schema";

export { default } from "./SessionManagementPage";

export const entityConfig: EntityConfig = {
    name: "Sessions",
    path: "/sessions",
    api: sessionApi,
    schema: sessionSchema,
};
