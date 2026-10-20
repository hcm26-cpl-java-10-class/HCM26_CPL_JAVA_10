export interface LocationNode {
  id: number;
  code: string;
  name: string;
  parentId?: number | null;
  status: string;
  children?: LocationNode[];
}

export interface LocationTreeProps {
  onSelectLocation?: (location: LocationNode | null) => void;
  selectedLocationId?: number | null;
}