import { createBaseApiService } from "@/api/base-service.api";
import type { ModuleGroupDTO, ModuleGroupFilter } from "@/types";

const path = "/module-groups";

const base = createBaseApiService<ModuleGroupDTO, ModuleGroupFilter>({
    path: path,
});

export const moduleGroupApi = Object.assign({}, base, {});
