import { createBaseApiService } from "@/api/base-service.api";
import type { ModuleDTO, ModuleFilter } from "@/types";

const path = "/modules";

const base = createBaseApiService<ModuleDTO, ModuleFilter>({
    path: path,
});

export const moduleApi = Object.assign({}, base, {});
