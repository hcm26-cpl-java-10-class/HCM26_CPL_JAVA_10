import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Folder,
  FolderOpen,
  MapPin,
  ChevronRight,
  Search,
  Plus,
  Edit2,
  Trash2,
  X,
  AlertTriangle,
  Users,
  User as UserIcon,
  Briefcase,
  Mail,
  Phone,
  Building2,
  UserPlus,
} from "lucide-react";
import type { LocationNode, LocationUser } from "@/types/features/rbac/location";
import { locationApi } from "@/api/features/rbac/location.api";

interface LocationTreeProps {
  selectedLocationId?: number | string | null;
  onSelectLocation?: (location: LocationNode) => void;
}

export const LocationTree: React.FC<LocationTreeProps> = ({
  selectedLocationId = null,
  onSelectLocation,
}) => {
  const [treeData, setTreeData] = useState<LocationNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Record<string | number, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [activeNode, setActiveNode] = useState<LocationNode | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<LocationNode | null>(null);
  const [targetParentId, setTargetParentId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
    status: "ACTIVE",
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [nodeToDelete, setNodeToDelete] = useState<LocationNode | null>(null);

  const [isAssignUserModalOpen, setIsAssignUserModalOpen] = useState(false);
  const [assignEmailInput, setAssignEmailInput] = useState("");
  const [assignError, setAssignError] = useState<string | null>(null);

  const loadTreeData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await locationApi.getTree();
      if (data && Array.isArray(data)) {
        setTreeData(data);
        const defaultExpanded: Record<string | number, boolean> = {};
        data.forEach((node) => {
          defaultExpanded[node.id] = true;
        });
        setExpandedIds((prev) => ({ ...defaultExpanded, ...prev }));

        if (data.length > 0) {
          setActiveNode((currentActive) => {
            if (!currentActive) return data[0];

            const findNodeInTree = (nodes: LocationNode[], id: string | number): LocationNode | null => {
              for (const n of nodes) {
                if (String(n.id) === String(id)) return n;
                if (n.children) {
                  const found = findNodeInTree(n.children, id);
                  if (found) return found;
                }
              }
              return null;
            };

            const updatedActive = findNodeInTree(data, currentActive.id);
            return updatedActive || data[0];
          });
        }
      }
    } catch (error) {
      console.error("Failed to load location tree:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTreeData();
  }, [loadTreeData]);

  const handleNodeClick = (node: LocationNode) => {
    setActiveNode(node);
    if (onSelectLocation) {
      onSelectLocation(node);
    }
  };

  const toggleExpand = (id: number | string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleAddChild = (node: LocationNode, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingNode(null);
    setTargetParentId(Number(node.id));
    setFormData({ name: "", code: "", description: "", status: "ACTIVE" });
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const handleEditNode = (node: LocationNode, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingNode(node);
    setTargetParentId(node.parentId ? Number(node.parentId) : null);
    setFormData({
      name: node.name,
      code: node.code,
      description: (node as any).description || "",
      status: node.status || "ACTIVE",
    });
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const handleOpenDeleteModal = (node: LocationNode, e: React.MouseEvent) => {
    e.stopPropagation();
    setNodeToDelete(node);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!nodeToDelete) return;
    try {
      await locationApi.delete(nodeToDelete.id as any);
      if (activeNode?.id === nodeToDelete.id) {
        setActiveNode(null);
      }
      await loadTreeData();
    } catch (error: any) {
      alert(error?.response?.data?.message || "Không thể xóa vị trí này!");
    } finally {
      setIsDeleteModalOpen(false);
      setNodeToDelete(null);
    }
  };

  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.code.trim()) {
      setErrorMessage("Tên và mã vị trí không được để trống!");
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const payload: Record<string, any> = {
        name: formData.name.trim(),
        code: formData.code.trim().toUpperCase(),
        description: formData.description.trim(),
        status: formData.status,
        parentLocationId: targetParentId ? Number(targetParentId) : null,
      };

      if (editingNode) {
        await locationApi.update(editingNode.id as any, payload as any);
      } else {
        await locationApi.create(payload as any);
      }
      await loadTreeData();
      setIsModalOpen(false);
    } catch (error: any) {
      console.error("Failed to save location:", error);
      const apiError =
        error?.response?.data?.message ||
        error?.response?.data?.errors?.code ||
        "Lưu vị trí thất bại. Vui lòng kiểm tra lại mã Code (không trùng lặp)!";
      setErrorMessage(apiError);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignEmailInput.trim() || !activeNode) return;

    try {
      setAssignError(null);
      if ((locationApi as any).assignUser) {
        await (locationApi as any).assignUser(activeNode.id, assignEmailInput.trim());
      }
      setAssignEmailInput("");
      setIsAssignUserModalOpen(false);
      await loadTreeData();
    } catch (err: any) {
      setAssignError(err?.response?.data?.message || "Không tìm thấy User với Email này!");
    }
  };

  const handleUnassignUser = async (userId: number | string) => {
    if (!activeNode) return;
    if (!confirm("Bạn có chắc chắn muốn bỏ nhân sự này khỏi vị trí hiện tại?")) return;

    try {
      if ((locationApi as any).unassignUser) {
        await (locationApi as any).unassignUser(activeNode.id, userId);
      }
      await loadTreeData();
    } catch (err: any) {
      alert(err?.response?.data?.message || "Hủy gán nhân sự thất bại!");
    }
  };

  const filterTree = (nodes: LocationNode[], query: string): LocationNode[] => {
    if (!query) return nodes;
    const lowerQuery = query.toLowerCase();

    return nodes
      .map((node) => {
        const matchesSelf =
          node.name.toLowerCase().includes(lowerQuery) ||
          node.code.toLowerCase().includes(lowerQuery);
        const filteredChildren = node.children ? filterTree(node.children, query) : [];

        if (matchesSelf || filteredChildren.length > 0) {
          return { ...node, children: filteredChildren };
        }
        return null;
      })
      .filter(Boolean) as LocationNode[];
  };

  const filteredTreeData = useMemo(() => filterTree(treeData, searchQuery), [treeData, searchQuery]);

  const renderTree = (nodes: LocationNode[]) => {
    return (
      <ul className="pl-3 space-y-1 border-l border-border/50 ml-2">
        {nodes.map((node) => {
          const userList: LocationUser[] = node.users || [];
          const userCount = node.totalUsers ?? userList.length ?? 0;
          const hasChildren = Boolean(node.children && node.children.length > 0);
          const canExpand = hasChildren || userCount > 0;

          const isExpanded = expandedIds[node.id] || Boolean(searchQuery);
          const isSelected = activeNode ? String(activeNode.id) === String(node.id) : false;

          return (
            <li key={node.id} className="text-xs space-y-1">
              <div
                onClick={() => handleNodeClick(node)}
                className={`flex items-center justify-between p-1.5 rounded-md cursor-pointer transition-colors group ${
                  isSelected ? "bg-primary/15 text-primary font-semibold" : "hover:bg-accent text-foreground"
                }`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  {canExpand ? (
                    <button
                      type="button"
                      onClick={(e) => toggleExpand(node.id, e)}
                      className="p-0.5 hover:bg-muted rounded text-muted-foreground"
                    >
                      <ChevronRight className={`size-3.5 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                    </button>
                  ) : (
                    <span className="w-4" />
                  )}

                  {hasChildren ? (
                    isExpanded ? <FolderOpen className="size-4 text-amber-500 shrink-0" /> : <Folder className="size-4 text-amber-500 shrink-0" />
                  ) : (
                    <MapPin className="size-4 text-emerald-500 shrink-0" />
                  )}

                  <span className="truncate">{node.name}</span>
                  <span className="text-[10px] font-mono text-muted-foreground ml-1">({node.code})</span>

                  {userCount > 0 && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[10px] bg-primary/10 text-primary border border-primary/20 font-medium ml-1 shrink-0">
                      <Users className="size-2.5" />
                      <span>{userCount}</span>
                    </span>
                  )}
                </div>

                <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1">
                  <button type="button" onClick={(e) => handleAddChild(node, e)} title="Thêm vị trí con" className="p-1 hover:text-primary">
                    <Plus className="size-3" />
                  </button>
                  <button type="button" onClick={(e) => handleEditNode(node, e)} title="Chỉnh sửa" className="p-1 hover:text-blue-500">
                    <Edit2 className="size-3" />
                  </button>
                  <button type="button" onClick={(e) => handleOpenDeleteModal(node, e)} title="Xóa" className="p-1 hover:text-destructive">
                    <Trash2 className="size-3" />
                  </button>
                </div>
              </div>

              {isExpanded && userList.length > 0 && (
                <ul className="pl-6 space-y-1 my-1 border-l border-dashed border-primary/30 ml-4">
                  {userList.map((usr) => (
                    <li
                      key={usr.id}
                      className="flex items-center justify-between text-[11px] py-1 px-2.5 rounded bg-muted/40 hover:bg-muted/70 text-muted-foreground"
                    >
                      <div className="flex items-center gap-1.5">
                        <UserIcon className="size-3 text-primary shrink-0" />
                        <span className="font-medium text-foreground">{usr.fullName}</span>
                      </div>
                      {usr.roleName && (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-background px-1.5 py-0.5 rounded border border-border text-primary font-normal">
                          <Briefcase className="size-2.5" />
                          {usr.roleName}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {hasChildren && isExpanded && renderTree(node.children!)}
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <div className="grid grid-cols-12 gap-4 items-start">
      <div className="col-span-12 lg:col-span-4 bg-card border border-border rounded-lg p-3 shadow-xs">
        <div className="mb-3 relative">
          <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-background text-xs rounded-md pl-8 pr-3 py-1.5 border border-input focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="max-h-[550px] overflow-y-auto">
          {loading ? (
            <div className="text-xs text-muted-foreground text-center py-4">Loading tree...</div>
          ) : filteredTreeData.length > 0 ? (
            renderTree(filteredTreeData)
          ) : (
            <div className="text-xs text-muted-foreground text-center py-4">No locations found.</div>
          )}
        </div>
      </div>

      <div className="col-span-12 lg:col-span-8">
        {activeNode ? (
          <div className="bg-card border border-border rounded-lg p-5 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-primary/10 rounded-lg text-primary">
                  <Building2 className="size-6" />
                </div>
                <div>
                  <h2 className="text-base font-semibold">{activeNode.name}</h2>
                  <p className="text-xs font-mono text-muted-foreground">Mã vị trí: {activeNode.code}</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 font-medium">
                <MapPin className="size-3" />
                {activeNode.status || "ACTIVE"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-muted/40 border border-border/60 rounded-md flex items-center gap-3">
                <Users className="size-5 text-primary" />
                <div>
                  <p className="text-[11px] text-muted-foreground">Tổng số nhân sự</p>
                  <p className="text-sm font-bold">{activeNode.totalUsers ?? activeNode.users?.length ?? 0} người</p>
                </div>
              </div>
              <div className="p-3 bg-muted/40 border border-border/60 rounded-md flex items-center gap-3">
                <Building2 className="size-5 text-amber-500" />
                <div>
                  <p className="text-[11px] text-muted-foreground">Vị trí con trực thuộc</p>
                  <p className="text-sm font-bold">{activeNode.children?.length || 0} vị trí</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Users className="size-3.5 text-primary" />
                  Danh sách nhân sự thuộc vị trí này
                </h3>
                <button
                  type="button"
                  onClick={() => setIsAssignUserModalOpen(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary text-primary-foreground text-xs font-medium rounded hover:bg-primary/90 transition-colors"
                >
                  <UserPlus className="size-3.5" />
                  <span>+ Gán nhân sự</span>
                </button>
              </div>

              {activeNode.users && activeNode.users.length > 0 ? (
                <div className="border border-border rounded-md overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/50 border-b border-border text-muted-foreground font-medium">
                      <tr>
                        <th className="py-2.5 px-3">Họ và tên</th>
                        <th className="py-2.5 px-3">Chức danh / Role</th>
                        <th className="py-2.5 px-3">Email</th>
                        <th className="py-2.5 px-3">Số điện thoại</th>
                        <th className="py-2.5 px-3 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {activeNode.users.map((usr) => (
                        <tr key={usr.id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-2.5 px-3 font-medium flex items-center gap-2">
                            <div className="size-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-[10px]">
                              {usr.fullName ? usr.fullName.charAt(0) : "U"}
                            </div>
                            <span>{usr.fullName}</span>
                          </td>
                          <td className="py-2.5 px-3">
                            {usr.roleName ? (
                              <span className="inline-flex items-center gap-1 text-[11px] bg-primary/10 text-primary px-2 py-0.5 rounded border border-primary/20 font-medium">
                                <Briefcase className="size-3" />
                                {usr.roleName}
                              </span>
                            ) : (
                              <span className="text-muted-foreground italic">Chưa gán</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Mail className="size-3 text-muted-foreground/70" />
                              {usr.email || "—"}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Phone className="size-3 text-muted-foreground/70" />
                              {usr.phone || "—"}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleUnassignUser(usr.id)}
                              title="Bỏ gán khỏi vị trí này"
                              className="p-1 hover:text-destructive text-muted-foreground transition-colors"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 border border-dashed border-border rounded-md text-center text-xs text-muted-foreground">
                  Không có nhân sự nào được gán trực tiếp vào vị trí này.
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-lg p-12 text-center text-xs text-muted-foreground h-full flex flex-col items-center justify-center gap-2">
            <Building2 className="size-10 text-muted-foreground/40" />
            <p className="font-medium">Vui lòng chọn một vị trí ở cây bên trái để xem thông tin chi tiết.</p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-lg p-5 w-full max-w-md space-y-4 shadow-lg">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-semibold text-sm">
                {editingNode ? "Chỉnh sửa vị trí" : "Thêm vị trí trực thuộc"}
              </h3>
              <button type="button" onClick={() => setIsModalOpen(false)}>
                <X className="size-4" />
              </button>
            </div>

            {errorMessage && (
              <div className="p-2.5 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-md flex items-center gap-2">
                <AlertTriangle className="size-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSaveModal} className="space-y-3 text-xs">
              <div>
                <label className="block mb-1 font-medium text-muted-foreground">Tên vị trí *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Phòng Kế toán"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-background border border-input p-2 rounded focus:outline-none focus:ring-1 focus:ring-primary text-xs"
                />
              </div>

              <div>
                <label className="block mb-1 font-medium text-muted-foreground">Mã vị trí (Code) *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: HN_ACC_01"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="w-full bg-background border border-input p-2 rounded font-mono uppercase focus:outline-none focus:ring-1 focus:ring-primary text-xs"
                />
              </div>

              <div>
                <label className="block mb-1 font-medium text-muted-foreground">Mô tả vị trí</label>
                <textarea
                  rows={2}
                  placeholder="Mô tả ngắn gọn về chức năng của vị trí này..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-background border border-input p-2 rounded focus:outline-none focus:ring-1 focus:ring-primary text-xs resize-none"
                />
              </div>

              <div>
                <label className="block mb-1 font-medium text-muted-foreground">Trạng thái</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full bg-background border border-input p-2 rounded focus:outline-none focus:ring-1 focus:ring-primary text-xs"
                >
                  <option value="ACTIVE">Hoạt động (ACTIVE)</option>
                  <option value="INACTIVE">Khóa / Ngưng (INACTIVE)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 border rounded text-xs hover:bg-muted"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 bg-primary text-primary-foreground rounded text-xs font-medium hover:bg-primary/90 disabled:opacity-50"
                >
                  {submitting ? "Đang lưu..." : "Lưu thay đổi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isAssignUserModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-lg p-5 w-full max-w-sm space-y-4 shadow-lg">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-semibold text-sm">Gán nhân sự vào vị trí</h3>
              <button type="button" onClick={() => setIsAssignUserModalOpen(false)}>
                <X className="size-4" />
              </button>
            </div>

            {assignError && (
              <div className="p-2.5 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-md flex items-center gap-2">
                <AlertTriangle className="size-4 shrink-0" />
                <span>{assignError}</span>
              </div>
            )}

            <form onSubmit={handleAssignUser} className="space-y-3 text-xs">
              <div>
                <label className="block mb-1 font-medium text-muted-foreground">Email Nhân sự (User Email) *</label>
                <input
                  type="email"
                  required
                  placeholder="Ví dụ: student@example.com"
                  value={assignEmailInput}
                  onChange={(e) => setAssignEmailInput(e.target.value)}
                  className="w-full bg-background border border-input p-2 rounded focus:outline-none focus:ring-1 focus:ring-primary text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsAssignUserModalOpen(false)}
                  className="px-3 py-1.5 border rounded text-xs hover:bg-muted"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-primary text-primary-foreground rounded text-xs font-medium hover:bg-primary/90"
                >
                  Gán nhân sự
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-lg p-4 w-full max-w-xs space-y-3 text-center">
            <AlertTriangle className="size-8 text-destructive mx-auto" />
            <h3 className="font-semibold text-sm">Xóa vị trí này?</h3>
            <p className="text-xs text-muted-foreground">
              Bạn có chắc chắn muốn xóa <b>{nodeToDelete?.name}</b>?
            </p>
            <div className="flex justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-3 py-1 border rounded text-xs"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-3 py-1 bg-destructive text-destructive-foreground rounded text-xs"
              >
                Xóa ngay
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};