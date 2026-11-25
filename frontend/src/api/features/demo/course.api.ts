import type { LessonContentType } from "@/types/features/demo/lesson";
import axiosInstance from "@/api/axios";
import { createBaseApiService } from "@/api/base-service.api";
import type {
  CatalogCourse,
  CatalogPage,
  CatalogSearchParams,
  CategoryTreeDTO,
  CourseDetail,
  CourseDTO,
  CourseFilter,
  ExamDTO,
} from "@/types";
import type { CourseMyScoresDTO } from "@/types/features/course-my-scores";

/** Source-only preview: the Backend filters inactive Sections and Topics. */
export interface CourseSyllabusSourceTopic {
  id: number;
  title: string;
}
export interface CourseSyllabusSourceSection {
  id: number;
  title: string;
  mission: string | null;
  topics: CourseSyllabusSourceTopic[];
}
export interface CourseSyllabusPreview {
  syllabusId: number;
  syllabusCode: string;
  syllabusName: string;
  syllabusDescription: string | null;
  sections: CourseSyllabusSourceSection[];
}
export interface CourseNameSuggestion { name: string; sequence: number }
export interface CourseNameAvailability { available: boolean }
export interface CourseDraftOutlineSection {
  title: string;
  lessons: string[];
  sourceTopicIds?: (number | null)[];
  /** Actual lesson teaching material, persisted into Lesson.textContent. */
  lessonMaterials?: string[];
  /** Same Lesson types as the Course Manager editor. */
  lessonTypes?: LessonContentType[];
  lessonUrls?: string[];
  lessonDurations?: number[];
  /** Optional assessment shells, aligned by Lesson index. */
  lessonAssessments?: (ExamDTO | null)[];
}
export interface CourseSourceScopeCheck {
  duplicate: boolean;
  existingCourseId: number | null;
  existingCourseName: string | null;
  legacyUnverifiedCourseCount: number;
  sameScopeCourseCount: number;
}
export interface CourseAiResource { title: string; url: string }
export interface CourseAiSuggestion {
  name: string;
  description: string;
  level: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  categoryIds: number[];
  sections: CourseDraftOutlineSection[];
  resources: CourseAiResource[];
  researchStatus: "DISABLED" | "GROUNDED_SOURCES_FOUND" | "NO_GROUNDED_SOURCES";
}
/** One-click Course generation runs on the Backend; this is UNSAVED preview state. */
export interface CourseAiJob {
  jobId: string;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "PARTIAL" | "FAILED";
  done: number;
  total: number;
  stage: string;
  error: string | null;
  suggestion: CourseAiSuggestion | null;
}

export interface CustomizedCourseFromSyllabusRequest {
  course: CourseDTO;
  sections: CourseDraftOutlineSection[];
  selectedTopicIds: number[];
  resources?: CourseAiResource[];
}

const path = "/courses";
const catalogPath = "/catalog/courses";

const base = createBaseApiService<CourseDTO, CourseFilter>({
  path: path,
});

export const courseApi = Object.assign({}, base, {
  suggestFromSyllabusName: async (syllabusId: number, startAt = 1): Promise<CourseNameSuggestion> => {
    const response = await axiosInstance.get<CourseNameSuggestion>(`${path}/from-syllabus/${syllabusId}/suggested-name`, { params: { startAt } });
    return response.data;
  },

  checkFromSyllabusName: async (syllabusId: number, name: string): Promise<CourseNameAvailability> => {
    const response = await axiosInstance.get<CourseNameAvailability>(`${path}/from-syllabus/${syllabusId}/name-availability`, { params: { name } });
    return response.data;
  },

  getFromSyllabusPreview: async (syllabusId: number): Promise<CourseSyllabusPreview> => {
    const response = await axiosInstance.get<CourseSyllabusPreview>(
      `${path}/from-syllabus/${syllabusId}/preview`,
    );
    return response.data;
  },

  checkFromSyllabusScope: async (syllabusId: number, selectedTopicIds: number[]): Promise<CourseSourceScopeCheck> => {
    const response = await axiosInstance.post<CourseSourceScopeCheck>(`${path}/from-syllabus/${syllabusId}/scope-check`, { selectedTopicIds });
    return response.data;
  },

  generateFromSyllabusAi: async (syllabusId: number, selectedTopicIds: number[], instruction: string,
      researchExternal: boolean): Promise<CourseAiSuggestion> => {
    const response = await axiosInstance.post<CourseAiSuggestion>(`${path}/from-syllabus/${syllabusId}/ai-suggestion`, { selectedTopicIds, instruction, researchExternal });
    return response.data;
  },

  startFromSyllabusAiJob: async (syllabusId: number, selectedTopicIds: number[],
      instruction: string): Promise<CourseAiJob> => {
    const response = await axiosInstance.post<CourseAiJob>(`${path}/from-syllabus/${syllabusId}/ai-jobs`,
      { selectedTopicIds, instruction, researchExternal: false });
    return response.data;
  },
  getFromSyllabusAiJob: async (syllabusId: number, jobId: string): Promise<CourseAiJob> => {
    const response = await axiosInstance.get<CourseAiJob>(`${path}/from-syllabus/${syllabusId}/ai-jobs/${encodeURIComponent(jobId)}`);
    return response.data;
  },
  resumeFromSyllabusAiJob: async (syllabusId: number, jobId: string): Promise<CourseAiJob> => {
    const response = await axiosInstance.post<CourseAiJob>(`${path}/from-syllabus/${syllabusId}/ai-jobs/${encodeURIComponent(jobId)}/resume`);
    return response.data;
  },

  createCustomizedFromSyllabus: async (
    data: CustomizedCourseFromSyllabusRequest,
  ): Promise<CourseDTO> => {
    const response = await axiosInstance.post<CourseDTO>(
      `${path}/from-syllabus/customized`, data,
    );
    return response.data;
  },

  createFromSyllabus: async (data: CourseDTO): Promise<CourseDTO> => {
    const response = await axiosInstance.post<CourseDTO>(`${path}/from-syllabus`, data);
    return response.data;
  },

  /** Catalog cho người học: chỉ khóa PUBLISHED, hỗ trợ search / category / level / phân trang. */
  searchCatalog: async (params: CatalogSearchParams = {}): Promise<CatalogPage<CatalogCourse>> => {
    const { search, categoryId, level, page = 0, size = 12, sort } = params;
    const response = await axiosInstance.get<CatalogPage<CatalogCourse>>(catalogPath, {
      params: {
        page,
        size,
        sort,
        search: search?.trim() || undefined,
        categoryId,
        level,
      },
    });
    return response.data;
  },

  /** Chi tiết khóa học + giáo trình. Lesson chưa ghi danh sẽ không có contentUrl/textContent. */
  getCatalogDetail: async (id: number): Promise<CourseDetail> => {
    const response = await axiosInstance.get<CourseDetail>(`${catalogPath}/${id}`);
    return response.data;
  },

  /** Cây danh mục active cho bộ lọc (STUDENT không có CATEGORY_READ nên không gọi /categories/tree). */
  getCatalogCategories: async (): Promise<CategoryTreeDTO[]> => {
    const response = await axiosInstance.get<CategoryTreeDTO[]>(`${catalogPath}/categories`);
    return response.data;
  },

  getMyScores: async (): Promise<CourseMyScoresDTO[]> => {
    const response = await axiosInstance.get<CourseMyScoresDTO[]>(
        `${path}/my-scores`
    );
    return response.data;
  },
});
