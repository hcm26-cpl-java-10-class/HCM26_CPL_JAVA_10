/** US-ANL-001: read-only Project Analytics workspace shell. */

export type ProjectAnalyticsWidgetState = "PLACEHOLDER" | "READY" | "EMPTY";

export interface ProjectAnalyticsWidget {
  key: string;
  title: string;
  description: string;
  state: ProjectAnalyticsWidgetState;
}

export interface ProjectAnalyticsFilters {
  state: "PLACEHOLDER" | "READY";
  planned: string[];
}

export interface ProjectAnalyticsShell {
  projectId: number;
  projectCode: string | null;
  projectName: string | null;
  projectStatus: string | null;
  readOnly: boolean;
  filters: ProjectAnalyticsFilters;
  widgets: ProjectAnalyticsWidget[];
}

/** One option in the Learning Analytics project selector. */
export interface ProjectAnalyticsProjectOption {
  projectId: number;
  code: string | null;
  name: string | null;
  status: string | null;
}
