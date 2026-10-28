import { createBaseApiService } from "@/api/base-service.api";
import type { RoleDTO, RoleFilter } from "@/types";

const path = "/roles";

const base = createBaseApiService<RoleDTO, RoleFilter>({
  path: path,
});

export const roleApi = Object.assign({}, base, {});
