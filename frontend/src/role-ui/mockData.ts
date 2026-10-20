import { Role } from './types';

export const initialRoles: Role[] = [
  { id: 1, name: 'Administrator', code: 'ADMIN', description: 'Quản trị viên toàn hệ thống', userCount: 2, isSystem: true },
  { id: 2, name: 'Manager', code: 'MANAGER', description: 'Quản lý cửa hàng / nhân sự', userCount: 5, isSystem: false },
  { id: 3, name: 'Staff', code: 'STAFF', description: 'Nhân viên bán hàng / vận hành', userCount: 12, isSystem: false },
];