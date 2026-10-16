export interface PermissionAction {
  id: string;
  name: string; // 'VIEW' | 'CREATE' | 'UPDATE' | 'DELETE' | 'APPROVE'
  label: string;
}

export interface SystemModule {
  id: string;
  code: string;
  name: string;
  description: string;
}

export interface RolePermissionMatrix {
  roleId: number;
  roleName: string;
  isSystem: boolean;
  // Map lưu trạng thái: key là `${moduleCode}_${action}`, value là boolean
  permissions: Record<string, boolean>;
}