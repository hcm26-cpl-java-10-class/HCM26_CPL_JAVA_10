import { PermissionAction, SystemModule, RolePermissionMatrix } from './types';

export const MOCK_MODULES: SystemModule[] = [
  { id: '1', code: 'USER', name: 'Quản lý Người dùng', description: 'Quản lý tài khoản, trạng thái và thông tin cá nhân' },
  { id: '2', code: 'ROLE', name: 'Quản lý Vai trò & Phân quyền', description: 'Cấu hình role và ma trận quyền hệ thống' },
  { id: '3', code: 'MODULE_GROUP', name: 'Quản lý Module & Nhóm', description: 'Cấu trúc menu và cây thư mục chức năng' },
  { id: '4', code: 'DEPARTMENT', name: 'Quản lý Phòng ban', description: 'Cơ cấu tổ chức đơn vị và cây phòng ban' },
];

export const MOCK_ACTIONS: PermissionAction[] = [
  { id: 'VIEW', name: 'VIEW', label: 'Xem' },
  { id: 'CREATE', name: 'CREATE', label: 'Thêm' },
  { id: 'UPDATE', name: 'UPDATE', label: 'Sửa' },
  { id: 'DELETE', name: 'DELETE', label: 'Xóa' },
  { id: 'APPROVE', name: 'APPROVE', label: 'Duyệt / Xuất' },
];

export const INITIAL_ROLE_PERMISSIONS: RolePermissionMatrix[] = [
  {
    roleId: 1,
    roleName: 'Administrator',
    isSystem: true,
    permissions: {
      'USER_VIEW': true, 'USER_CREATE': true, 'USER_UPDATE': true, 'USER_DELETE': true, 'USER_APPROVE': true,
      'ROLE_VIEW': true, 'ROLE_CREATE': true, 'ROLE_UPDATE': true, 'ROLE_DELETE': true, 'ROLE_APPROVE': true,
      'MODULE_GROUP_VIEW': true, 'MODULE_GROUP_CREATE': true, 'MODULE_GROUP_UPDATE': true, 'MODULE_GROUP_DELETE': true, 'MODULE_GROUP_APPROVE': true,
      'DEPARTMENT_VIEW': true, 'DEPARTMENT_CREATE': true, 'DEPARTMENT_UPDATE': true, 'DEPARTMENT_DELETE': true, 'DEPARTMENT_APPROVE': true,
    }
  },
  {
    roleId: 2,
    roleName: 'Manager',
    isSystem: false,
    permissions: {
      'USER_VIEW': true, 'USER_CREATE': true, 'USER_UPDATE': true, 'USER_DELETE': false, 'USER_APPROVE': true,
      'ROLE_VIEW': true, 'ROLE_CREATE': false, 'ROLE_UPDATE': false, 'ROLE_DELETE': false, 'ROLE_APPROVE': false,
      'MODULE_GROUP_VIEW': true, 'MODULE_GROUP_CREATE': false, 'MODULE_GROUP_UPDATE': false, 'MODULE_GROUP_DELETE': false, 'MODULE_GROUP_APPROVE': false,
      'DEPARTMENT_VIEW': true, 'DEPARTMENT_CREATE': true, 'DEPARTMENT_UPDATE': true, 'DEPARTMENT_DELETE': false, 'DEPARTMENT_APPROVE': true,
    }
  },
  {
    roleId: 3,
    roleName: 'Staff',
    isSystem: false,
    permissions: {
      'USER_VIEW': true, 'USER_CREATE': false, 'USER_UPDATE': false, 'USER_DELETE': false, 'USER_APPROVE': false,
      'ROLE_VIEW': true, 'ROLE_CREATE': false, 'ROLE_UPDATE': false, 'ROLE_DELETE': false, 'ROLE_APPROVE': false,
      'MODULE_GROUP_VIEW': true, 'MODULE_GROUP_CREATE': false, 'MODULE_GROUP_UPDATE': false, 'MODULE_GROUP_DELETE': false, 'MODULE_GROUP_APPROVE': false,
      'DEPARTMENT_VIEW': true, 'DEPARTMENT_CREATE': false, 'DEPARTMENT_UPDATE': false, 'DEPARTMENT_DELETE': false, 'DEPARTMENT_APPROVE': false,
    }
  }
];