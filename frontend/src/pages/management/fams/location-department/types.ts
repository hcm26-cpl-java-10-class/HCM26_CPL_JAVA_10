export interface LocationNode {
  id: string;
  code: string;
  name: string;
  parentId: string | null;
  address?: string;
  description?: string;
  status: "Active" | "Inactive";
  displayOrder?: number;
  children?: LocationNode[];
  departmentCount?: number;
}

export interface DepartmentItem {
  id: string;
  code: string;
  name: string;
  locationId: string;
  locationName: string;
  linkedEntities: string;
  status: "Active" | "Inactive";
  description?: string;
  displayOrder?: number;
}

export interface LocationFormData {
  code: string;
  name: string;
  parentId: string | null;
  address?: string;
  description?: string;
  status: "Active" | "Inactive";
}

export interface DepartmentFormData {
  code: string;
  name: string;
  locationId: string;
  linkedEntities?: string;
  description?: string;
  status: "Active" | "Inactive";
}
