import { createBaseApiService } from "@/api/base-service.api";
import type { DepartmentDTO, DepartmentFilter } from "@/types";

const path = "/departments";

const base = createBaseApiService<DepartmentDTO, DepartmentFilter>({ path });

export const departmentApi = Object.assign({}, base, {});
