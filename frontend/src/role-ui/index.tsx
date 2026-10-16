import React, { useState } from 'react';
import { Role } from './types';
import { initialRoles } from './mockData';
import RoleModal from './components/RoleModal';

export default function RoleManagementPage() {
  const [roles, setRoles] = useState<Role[]>(initialRoles);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [deleteRoleTarget, setDeleteRoleTarget] = useState<Role | null>(null);

  const handleOpenAdd = () => {
    setEditingRole(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (role: Role) => {
    setEditingRole(role);
    setIsModalOpen(true);
  };

  const handleSaveRole = (roleData: { name: string; code: string; description: string }) => {
  if (editingRole) {
    setRoles(roles.map(r => r.id === editingRole.id ? { ...r, ...roleData, code: roleData.code.toUpperCase() } : r));
  } else {
    const newRole: Role = {
      id: roles.length > 0 ? Math.max(...roles.map(r => r.id)) + 1 : 1, // Tự động tăng ID gọn gàng
      name: roleData.name,
      code: roleData.code.toUpperCase(),
      description: roleData.description,
      userCount: 0,
      isSystem: false,
    };
    setRoles([...roles, newRole]);
  }
};

  const handleDelete = () => {
    if (deleteRoleTarget) {
      if (deleteRoleTarget.isSystem) {
        alert('Không thể xóa Role hệ thống!');
        setDeleteRoleTarget(null);
        return;
      }
      setRoles(roles.filter(r => r.id !== deleteRoleTarget.id));
      setDeleteRoleTarget(null);
    }
  };

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Quản lý Vai trò & Danh sách Role (SCR-30)</h1>
          <p className="text-sm text-slate-500 mt-1">Phân quyền quản trị hệ thống và kiểm soát số lượng người dùng theo vai trò</p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm transition-colors flex items-center gap-2"
        >
          <span>+</span> Tạo Role mới
        </button>
      </div>

      {/* Bảng Danh sách Role */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 text-sm font-semibold">
              <th className="p-4">ID</th>
              <th className="p-4">Tên Role</th>
              <th className="p-4">Mã Code</th>
              <th className="p-4">Mô tả</th>
              <th className="p-4 text-center">Số lượng User</th>
              <th className="p-4 text-right">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-sm">
            {roles.map((role) => (
              <tr key={role.id} className="hover:bg-slate-50/80 transition-colors">
                <td className="p-4 font-medium text-slate-600">#{role.id}</td>
                <td className="p-4 font-semibold text-slate-800">
                  {role.name}
                  {role.isSystem && (
                    <span className="ml-2 px-2 py-0.5 text-xs bg-slate-200 text-slate-700 rounded font-normal">
                      Hệ thống
                    </span>
                  )}
                </td>
                <td className="p-4">
                  <code className="px-2 py-1 bg-slate-100 border border-slate-200 text-slate-800 font-mono text-xs rounded">
                    {role.code}
                  </code>
                </td>
                <td className="p-4 text-slate-600 max-w-xs truncate">{role.description}</td>
                <td className="p-4 text-center">
                  <span className="inline-flex items-center justify-center px-2.5 py-1 text-xs font-semibold bg-blue-50 text-blue-700 rounded-full border border-blue-200">
                    {role.userCount} người dùng
                  </span>
                </td>
                <td className="p-4 text-right space-x-2">
                  <button
                    onClick={() => handleOpenEdit(role)}
                    className="px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 border border-blue-200 rounded-md transition-colors"
                  >
                    Sửa
                  </button>
                  <button
                    onClick={() => setDeleteRoleTarget(role)}
                    disabled={role.isSystem}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      role.isSystem
                        ? 'text-slate-400 bg-slate-100 cursor-not-allowed border border-slate-200'
                        : 'text-red-600 hover:bg-red-50 border border-red-200'
                    }`}
                  >
                    Xóa
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Thêm / Sửa */}
      <RoleModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveRole}
        editingRole={editingRole}
      />

      {/* Modal xác nhận xóa */}
      {deleteRoleTarget && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 border border-slate-200">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Xác nhận xóa Role</h3>
            <p className="text-sm text-slate-600 mb-6">
              Bạn có chắc chắn muốn xóa role <strong className="text-slate-800">{deleteRoleTarget.name}</strong> không?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteRoleTarget(null)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}