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

const path = "/courses";
const catalogPath = "/catalog/courses";

const base = createBaseApiService<CourseDTO, CourseFilter>({
  path: path,
});

export const courseApi = Object.assign({}, base, {
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
});
