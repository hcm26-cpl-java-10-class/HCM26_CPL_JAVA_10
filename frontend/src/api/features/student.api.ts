import { createBaseApiService } from "@/api/base-service.api";
import type { StudentDTO, StudentFilter } from "@/types";

const base = createBaseApiService<StudentDTO, StudentFilter>({ path: "/students" });

export const studentApi = Object.assign({}, base, {});
