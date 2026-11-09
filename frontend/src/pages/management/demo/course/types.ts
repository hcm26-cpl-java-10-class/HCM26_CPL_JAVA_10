export interface CourseItem {
  categoryName?: string;
  id: number;
  name: string;
  courseName?: string;
  instructor: string;
  instructorEmail?: string;
  category: string;
  categories?: string[];
  publicationStatus: "Published" | "Draft" | string;
  courseLevel: "Beginner" | "Intermediate" | "Advanced" | string;
  description: string;
  thumbnailUrl: string;
  isActive: boolean;
  status?: boolean;
  createdAt: string;
  updatedAt?: string;
  lessonCount?: number;
  duration?: string;
}

export interface CourseFormData {
  instructorEmail?: string;
  name: string;
  instructor: string;
  category?: string;
  publicationStatus?: string;
  courseLevel?: string;
  description: string;
  thumbnailUrl: string;
  isActive: boolean;
}

export type SortField =
  | "name"
  | "instructor"
  | "createdAt";

export type SortDirection = "asc" | "desc" | null;

export interface SortState {
  field: SortField | null;
  direction: SortDirection;
}

export interface ColumnVisibility {
  name: boolean;
  instructor: boolean;
  category: boolean;
  publicationStatus: boolean;
  courseLevel: boolean;
  description: boolean;
  thumbnailUrl: boolean;
  status: boolean;
  createdAt: boolean;
}
