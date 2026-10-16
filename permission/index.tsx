import React, { useState } from 'react';
import { MOCK_MODULES, MOCK_ACTIONS, INITIAL_ROLE_PERMISSIONS } from './mockData';
import { RolePermissionMatrix } from './types';

export default function PermissionMatrixPage() {
  const [roles, setRoles] = useState<RolePermissionMatrix[]>(INITIAL_ROLE_PERMISSIONS);
  const [selectedRoleId, setSelectedRoleId] = useState<number>(roles[0]?.roleId || 1);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const currentRole = roles.find(r => r.roleId === selectedRoleId) || roles[0];

  const handleCheckboxChange = (moduleCode: string, actionName: string) => {
    if (currentRole.isSystem) {
      alert('⚠️ Cảnh báo: Role hệ thống (System Role) có quyền tối cao cố định, không thể thay đổi trực tiếp!');
      return;
    }

    const key = `${moduleCode}_${actionName}`;
    const updatedPermissions = {
      ...currentRole.permissions,
      [key]: !currentRole.permissions[key]
    };

    setRoles(roles.map(r => r.roleId === currentRole.roleId ? { ...r, permissions: updatedPermissions } : r));
  };

  const handleSave = () => {
    if (currentRole.isSystem) {
      alert('Không thể lưu thay đổi đối với Role hệ thống!');
      return;
    }
    setSuccessMessage(`Đã cập nhật và lưu ma trận quyền thành công cho vai trò: ${currentRole.roleName}!`);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Ma trận Phân quyền (SCR-30)</h1>
          <p className="text-sm text-slate-500 mt-1">Cấu hình quyền hạn chi tiết cho từng Module theo từng Vai trò trong hệ thống</p>
        </div>
        <button
          onClick={handleSave}
          disabled={currentRole.isSystem}
          className={`px-5 py-2.5 text-white font-medium rounded-lg shadow-sm transition-colors ${
            currentRole.isSystem 
              ? 'bg-slate-400 cursor-not-allowed' 
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          💾 Lưu quyền
        </button>
      </div>

      {successMessage && (
        <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-sm shadow-sm">
          {successMessage}
        </div>
      )}

      {currentRole.isSystem && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-sm flex items-center shadow-sm">
          <span className="mr-2 text-lg">🔒</span>
          <span><strong>Vai trò hệ thống ({currentRole.roleName}):</strong> Đây là nhóm quyền mặc định bảo vệ hệ thống. Giao diện chỉ cho phép xem hoặc có cảnh báo khi thao tác.</span>
        </div>
      )}

      <div className="flex items-center space-x-3 mb-6 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <span className="text-sm font-semibold text-slate-700">Chọn Vai trò cần cấu hình:</span>
        <div className="flex space-x-2">
          {roles.map(role => (
            <button
              key={role.roleId}
              onClick={() => setSelectedRoleId(role.roleId)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                selectedRoleId === role.roleId
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {role.roleName} {role.isSystem && '🛡️'}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 text-sm">
              <th className="py-3 px-4 font-semibold w-1/3">Module hệ thống</th>
              {MOCK_ACTIONS.map(action => (
                <th key={action.id} className="py-3 px-4 font-semibold text-center">
                  {action.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
            {MOCK_MODULES.map(module => (
              <tr key={module.id} className="hover:bg-slate-50 transition-colors">
                <td className="py-4 px-4">
                  <div className="font-semibold text-slate-800">{module.name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{module.description}</div>
                </td>
                {MOCK_ACTIONS.map(action => {
                  const key = `${module.code}_${action.name}`;
                  const isChecked = !!currentRole.permissions[key];

                  return (
                    <td key={action.id} className="py-4 px-4 text-center">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleCheckboxChange(module.code, action.name)}
                        disabled={currentRole.isSystem}
                        className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer disabled:opacity-50"
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}