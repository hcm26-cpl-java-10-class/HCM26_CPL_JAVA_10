export interface LocationUser {
  id: number;
  username: string;
  fullName: string;
  email: string;
  phone: string;
  jobTitle: string;
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