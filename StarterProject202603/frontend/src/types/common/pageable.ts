export interface PageResponse<T> {

  content: T[];  // Backend returns 'content' (Spring Boot Page)

  items: T[];    // Alias for compatibility

  page: number;

  size: number;

  totalPages: number;

  totalElements: number;

  hasNext: boolean;

  hasPrevious: boolean;
}

export interface Pagination {

  page?: number;

  size?: number;

  sort?: string | string[];
}

export const DefaultPagination: Pagination = {
  page: 0,
  size: 10,
};

export type SortDirection = "asc" | "desc";

export interface SortEntry {

  field: string;
  
  direction: SortDirection;
}