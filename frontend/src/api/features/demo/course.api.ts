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
}
export interface CustomizedCourseFromSyllabusRequest {
  course: CourseDTO;
  sections: CourseDraftOutlineSection[];
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
