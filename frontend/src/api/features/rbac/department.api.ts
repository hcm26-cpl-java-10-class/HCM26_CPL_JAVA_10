import { createBaseApiService } from "@/api/base-service.api";
import type { DepartmentDTO, DepartmentFilter } from "@/types";

// TODO: TV5 (T15) hoàn thiện BE Department; file này chỉ dùng để form User lấy danh sách chọn.
const path = "/departments";

const base = createBaseApiService<DepartmentDTO, DepartmentFilter>({ path });

export const departmentApi = Object.assign({}, base, {});
