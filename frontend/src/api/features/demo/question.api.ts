import { createBaseApiService } from "@/api/base-service.api";
import type { QuestionDTO, QuestionFilter } from "@/types";

export const questionApi = createBaseApiService<QuestionDTO, QuestionFilter>({
    path: "/questions",
});
