import { createBaseApiService } from "@/api/base-service.api";
import type { PermissionDTO, PermissionFilter } from "@/types";

const path = "/permissions";

const base = createBaseApiService<PermissionDTO, PermissionFilter>({
  path: path,
});

export const permissionApi = Object.assign({}, base, {});
