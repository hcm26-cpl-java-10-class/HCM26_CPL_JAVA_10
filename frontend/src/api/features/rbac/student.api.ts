import { createBaseApiService } from "@/api/base-service.api";
import type { StudentDTO, StudentFilter } from "@/types/features/student";

const base = createBaseApiService<StudentDTO, StudentFilter>({ path: "/students" });

export const studentApi = Object.assign({}, base, {});
