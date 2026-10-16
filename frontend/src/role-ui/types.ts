export interface Role {
  id: number;
  name: string;
  code: string;
  description: string;
  userCount: number;
  isSystem?: boolean;
}