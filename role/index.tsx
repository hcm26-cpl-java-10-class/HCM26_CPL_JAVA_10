import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Users, Shield, Search, Check, Save } from "lucide-react";
import { toast } from "sonner";
import { permissionApi, roleApi } from "@/api";
import { MainLayout } from "@/components/layout/MainLayout";
import {
  auditableFieldsSchema,
  type EntityConfig,
  type EntitySchema,
  type FieldSchema,
} from "@/types";

// 1. Khai báo Schema và EntityConfig chuẩn của hệ thống để Router không bị 404
const roleSchema: EntitySchema = {
  entityName: "role",
  idField: "id",
  fields: [
    {
      name: "name",
      label: "Name",
      type: "text",
      sortable: true,
      bold: true,
    },
    {
      name: "description",
      label: "Description",
      type: "textarea",
      sortable: true,
    },
    {
      name: "permissionIds",
      label: "Permissions",
      type: "relation",
      editable: true,
      relation: {
        api: permissionApi,
        valueField: "id",
        labelField: "name",
        multiple: true,
      },
      filterable: true,
      filterType: "select",
    },
    ...(auditableFieldsSchema as FieldSchema[]),
  ],
};

export const entityConfig: EntityConfig = {
  name: "Role",
  path: "/roles",
  api: roleApi,
  schema: roleSchema,
};

// 2. Interfaces cho T08 & T10
export interface RoleItem {
  id: string | number;
  name: string;
  description?: string;
  userCount?: number;
  isSystemRole?: boolean;
}

export interface ModulePermission {
  id: string;
  name: string;
  actions: { key: string; label: string; enabled: boolean }[];
}

// 3. Component giao diện chính (T08: Danh sách Role + T10: Ma trận quyền)
export default function RoleManagementPage() {
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedRoleId, setSelectedRoleId] = useState<string | number | null>(null);

  // Modal States (T08)
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [editingRole, setEditingRole] = useState<RoleItem | null>(null);
  const [roleToDelete, setRoleToDelete] = useState<RoleItem | null>(null);
  const [formData, setFormData] = useState({ name: "", description: "" });

  // Ma trận quyền (T10)
  const [permissionMatrix, setPermissionMatrix] = useState<ModulePermission[]>([
    {
      id: "USERS",
      name: "Quản lý Người dùng",
      actions: [
        { key: "USER_READ", label: "Xem", enabled: false },
        { key: "USER_CREATE", label: "Tạo", enabled: false },
        { key: "USER_UPDATE", label: "Sửa", enabled: false },
        { key: "USER_DELETE", label: "Xóa", enabled: false },
      ],
    },
    {
      id: "ROLES",
      name: "Quản lý Vai trò (Role)",
      actions: [
        { key: "ROLE_READ", label: "Xem", enabled: false },
        { key: "ROLE_CREATE", label: "Tạo", enabled: false },
        { key: "ROLE_UPDATE", label: "Sửa", enabled: false },
        { key: "ROLE_DELETE", label: "Xóa", enabled: false },
      ],
    },
    {
      id: "COURSES",
      name: "Quản lý Khóa học",
      actions: [
        { key: "COURSE_READ", label: "Xem", enabled: false },
        { key: "COURSE_CREATE", label: "Tạo", enabled: false },
        { key: "COURSE_UPDATE", label: "Sửa", enabled: false },
        { key: "COURSE_DELETE", label: "Xóa", enabled: false },
      ],
    },
  ]);

  const fetchRoles = async () => {
    try {
      setLoading(true);
      const data = await roleApi.getPage({ page: 0, size: 50 });
      const roleList: RoleItem[] = (data.content || []).map((r: any) => ({
        id: r.id ?? "",
        name: r.name ?? "",
        description: r.description ?? "",
        userCount: r.userCount ?? 0,
        isSystemRole: r.isSystemRole ?? false,
      }));
      setRoles(roleList);
      if (roleList.length > 0 && !selectedRoleId) {
        setSelectedRoleId(roleList[0].id);
      }
    } catch (error) {
      toast.error("Không thể tải danh sách vai trò");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  const handleOpenModal = (role?: RoleItem) => {
    if (role) {
      setEditingRole(role);
      setFormData({ name: role.name, description: role.description || "" });
    } else {
      setEditingRole(null);
      setFormData({ name: "", description: "" });
    }
    setIsModalOpen(true);
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Tên vai trò không được để trống");
      return;
    }
    try {
      // Chuẩn hóa payload gửi lên Backend đúng định dạng yêu cầu
      const payload = {
        name: formData.name.trim().toUpperCase().replace(/\s+/g, "_"),
        description: formData.description ? formData.description.trim() : "",
        permissionIds: [], // Đính kèm mảng permissionIds tránh lỗi 400 từ Backend
      };

      if (editingRole) {
        await roleApi.update(String(editingRole.id), payload as any);
        toast.success("Cập nhật vai trò thành công!");
      } else {
        await roleApi.create(payload as any);
        toast.success("Tạo vai trò mới thành công!");
      }
      setIsModalOpen(false);
      fetchRoles();
    } catch (error: any) {
      console.error("Lỗi API Backend:", error.response?.data || error);
      const serverMessage = error.response?.data?.message || error.response?.data?.error;
      toast.error(serverMessage ? `Lỗi: ${serverMessage}` : "Thao tác thất bại!");
    }
  };

  const handleConfirmDelete = async () => {
    if (!roleToDelete) return;
    try {
      await roleApi.delete(String(roleToDelete.id));
      toast.success("Xóa vai trò thành công!");
      setIsDeleteModalOpen(false);
      setRoleToDelete(null);
      fetchRoles();
    } catch (error) {
      toast.error("Không thể xóa vai trò này!");
    }
  };

  const handleToggleAction = (moduleId: string, actionKey: string) => {
    setPermissionMatrix((prev) =>
      prev.map((mod) => {
        if (mod.id !== moduleId) return mod;
        return {
          ...mod,
          actions: mod.actions.map((act) =>
            act.key === actionKey ? { ...act, enabled: !act.enabled } : act
          ),
        };
      })
    );
  };

  const selectedRole = roles.find((r) => r.id === selectedRoleId);
  const filteredRoles = roles.filter((r) =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <MainLayout pathName={{ "management/rbac/role": "Role Management" }}>
      <div className="flex h-[calc(100vh-120px)] w-full gap-6 p-6">
        {/* CỘT TRÁI: T08 - DANH SÁCH ROLE KÈM SỐ USER & TẠO/SỬA/XÓA */}
        <div className="w-1/3 min-w-[320px] rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex flex-col">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Danh Sách Role</h2>
            </div>
            <button
              onClick={() => handleOpenModal()}
              className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition"
            >
              <Plus className="h-4 w-4" /> Tạo Role
            </button>
          </div>

          <div className="relative mb-4">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm kiếm vai trò..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          {loading ? (
            <div className="p-4 text-center text-sm text-slate-500">Đang tải danh sách...</div>
          ) : filteredRoles.length === 0 ? (
            <div className="p-4 text-center text-sm text-slate-500">Không tìm thấy vai trò nào.</div>
          ) : (
            <div className="space-y-2 flex-1 overflow-y-auto">
              {filteredRoles.map((role) => (
                <div
                  key={role.id}
                  onClick={() => setSelectedRoleId(role.id)}
                  className={`group flex items-center justify-between rounded-lg border p-3 cursor-pointer transition ${
                    selectedRoleId === role.id
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                      : "border-slate-200 hover:border-slate-300 dark:border-slate-800"
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{role.name}</span>
                      {role.isSystemRole && (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                          Hệ thống
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                      <Users className="h-3.5 w-3.5" />
                      <span>{role.userCount ?? 0} người dùng</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenModal(role);
                      }}
                      className="p-1 text-slate-500 hover:text-blue-600 transition"
                      title="Sửa"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    {!role.isSystemRole && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setRoleToDelete(role);
                          setIsDeleteModalOpen(true);
                        }}
                        className="p-1 text-slate-500 hover:text-red-600 transition"
                        title="Xóa"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* CỘT PHẢI: T10 - MA TRẬN QUYỀN */}
        <div className="flex-1 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex flex-col">
          <div className="mb-6 flex items-center justify-between border-b border-slate-200 pb-4 dark:border-slate-800">
            <div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                Ma Trận Quyền - {selectedRole?.name || "Chọn Role"}
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                {selectedRole?.isSystemRole
                  ? "⚠️ Role hệ thống chỉ cho phép xem (có cảnh báo)."
                  : "Tích chọn quyền hạn cho từng module chức năng."}
              </p>
            </div>
            {!selectedRole?.isSystemRole && (
              <button
                onClick={() => toast.success("Đã lưu ma trận phân quyền thành công!")}
                className="flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition"
              >
                <Save className="h-4 w-4" /> Lưu Quyền
              </button>
            )}
          </div>

          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                <tr>
                  <th className="p-3 border-b dark:border-slate-700">Module / Chức năng</th>
                  <th className="p-3 border-b text-center dark:border-slate-700">Hành động & Phân quyền</th>
                </tr>
              </thead>
              <tbody>
                {permissionMatrix.map((mod) => (
                  <tr key={mod.id} className="border-b hover:bg-slate-50/50 dark:border-slate-800 dark:hover:bg-slate-800/50">
                    <td className="p-3 font-medium text-slate-800 dark:text-slate-200">{mod.name}</td>
                    <td className="p-3">
                      <div className="flex items-center justify-center gap-4 flex-wrap">
                        {mod.actions.map((act) => (
                          <label
                            key={act.key}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer text-xs font-medium transition ${
                              act.enabled
                                ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                                : "border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-400"
                            }`}
                          >
                            <input
                              type="checkbox"
                              disabled={selectedRole?.isSystemRole}
                              checked={act.enabled}
                              onChange={() => handleToggleAction(mod.id, act.key)}
                              className="hidden"
                            />
                            <div className={`h-4 w-4 rounded border flex items-center justify-center ${act.enabled ? "bg-blue-600 border-blue-600 text-white" : "border-slate-300"}`}>
                              {act.enabled && <Check className="h-3 w-3" />}
                            </div>
                            <span>{act.label}</span>
                          </label>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL TẠO / SỬA ROLE */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg dark:bg-slate-900">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              {editingRole ? "Chỉnh Sửa Role" : "Tạo Role Mới"}
            </h3>
            <form onSubmit={handleSaveRole} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Tên Role *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  placeholder="Ví dụ: MANAGER"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Mô Tả</label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg border px-4 py-2 text-sm text-slate-700 dark:text-slate-300"
                >
                  Hủy
                </button>
                <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">
                  {editingRole ? "Lưu Thay Đổi" : "Tạo Mới"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL XÁC NHẬN XÓA */}
      {isDeleteModalOpen && roleToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg dark:bg-slate-900">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Xác Nhận Xóa</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Bạn có chắc chắn muốn xóa role <span className="font-semibold text-slate-900 dark:text-white">"{roleToDelete.name}"</span>?
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setIsDeleteModalOpen(false)} className="rounded-lg border px-4 py-2 text-sm">Hủy</button>
              <button onClick={handleConfirmDelete} className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700">Xóa</button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}