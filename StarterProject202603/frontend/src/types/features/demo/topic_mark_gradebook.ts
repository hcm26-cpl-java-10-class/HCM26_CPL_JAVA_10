export interface TopicMarkGradebookColumnDTO {
  key: string;
  label: string;
  componentId?: string | null;
  componentIndex?: number | null;
  componentType?: string | null;
  weight?: number | null;
  isGraded?: boolean | null;
}

export interface TopicMarkGradebookRowDTO {
  userId: string;
  fullName: string;
  email: string;
  values: Record<string, unknown>;
}

export interface TopicMarkPageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  sort?: string;
}

export interface TopicMarkGradebookSearchResponseDTO {
  columns: TopicMarkGradebookColumnDTO[];
  rows: TopicMarkPageResponse<TopicMarkGradebookRowDTO>;
}

export interface TopicMarkGradebookTableRow {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  values: Record<string, unknown>;
  finalScore: number | null;
  isPassed: boolean;
  __dynamicMeta: {
    values: {
      keyOrder: string[];
      keyLabelMap: Record<string, string>;
    };
  };
}
