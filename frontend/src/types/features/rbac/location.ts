export interface LocationUser {
  id: number;
  email?: string;
  fullName: string;
  phone?: string;
  roleName?: string; 
}

export interface LocationNode {
  id: number;
  code: string;
  name: string;
  parentId: number | null;
  status?: string;
  isActive?: boolean;
  totalUsers?: number;
  users?: LocationUser[];
  children?: LocationNode[];
}

export interface LocationTreeProps {
  onSelectLocation?: (node: LocationNode) => void;
  selectedLocationId?: number | null;
}

export interface LocationDTO {
  id: number;
  code: string;
  name: string;
  parentLocationId?: number | null;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LocationFilter {
  code?: string;
  name?: string;
  search?: string;
  page?: number;
  size?: number;
}