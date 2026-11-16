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
  Users,
  User as UserIcon,
  Briefcase,
  Mail,
  Phone,
  Building2,
  UserPlus,
  ChevronsDownUp,
  ChevronsUpDown,
  BarChart3,
  Download,
} from "lucide-react";
import { locationApi } from "@/api/features/rbac/location.api";
import { LocationDashboardChart } from "./LocationDashboardChart";
import { LocationFormModal, AssignUserModal, DeleteConfirmModal } from "./LocationModals";
import { findNodeById, filterTreeNodes, exportLocationUsersCsv } from "./locationUtils";

export interface LocationUser {
  id: number | string;
  fullName?: string;
  roleName?: string;
  email?: string;
  phone?: string;
}

export interface LocationNode {
  id: number | string;
  name: string;
  code: string;
  description?: string;
  status?: string;
  parentId?: number | string | null;
  totalUsers?: number;
  users?: LocationUser[];
  children?: LocationNode[];
}

interface LocationTreeProps {
  selectedLocationId?: number | string | null;
  onSelectLocation?: (location: LocationNode) => void;
}

export const LocationTree: React.FC<LocationTreeProps> = ({ onSelectLocation }) => {
  const [treeData, setTreeData] = useState<LocationNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Record<string | number, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [activeNode, setActiveNode] = useState<LocationNode | null>(null);
  const [showChart, setShowChart] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<LocationNode | null>(null);
  const [targetParentId, setTargetParentId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ name: "", code: "", description: "", status: "ACTIVE" });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [nodeToDelete, setNodeToDelete] = useState<LocationNode | null>(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignEmailInput, setAssignEmailInput] = useState("");
  const [assignError, setAssignError] = useState<string | null>(null);

  const loadTreeData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await locationApi.getTree();
      if (Array.isArray(data)) {
        setTreeData(data as LocationNode[]);
        setExpandedIds((prev) => {
          const next = { ...prev };
          data.forEach((n: LocationNode) => {
            if (next[n.id] === undefined) next[n.id] = true;
          });
          return next;
        });
        if (data.length > 0) {
          setActiveNode((curr) =>
            curr ? findNodeById(data as LocationNode[], curr.id) || (data[0] as LocationNode) : (data[0] as LocationNode)
          );
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
    const isSame = activeNode && String(activeNode.id) === String(node.id);
    setActiveNode(node);
    setUserSearchQuery("");
    onSelectLocation?.(node);
    if (node.children?.length || node.users?.length) {
      setExpandedIds((prev) => ({ ...prev, [node.id]: isSame ? !prev[node.id] : true }));
    }
  };

  const handleExpandAll = (expand: boolean) => {
    if (!expand) return setExpandedIds({});
    const allIds: Record<string | number, boolean> = {};
    const collect = (nodes: LocationNode[]) =>
      nodes.forEach((n) => {
        allIds[n.id] = true;
        if (n.children) collect(n.children);
      });
    collect(treeData);
    setExpandedIds(allIds);
  };

  const openModal = (node: LocationNode, isEdit: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingNode(isEdit ? node : null);
    setTargetParentId(isEdit ? (node.parentId ? Number(node.parentId) : null) : Number(node.id));
    setFormData(
      isEdit
        ? {
            name: node.name,
            code: node.code,
            description: node.description || "",
            status: node.status || "ACTIVE",
          }
        : { name: "", code: "", description: "", status: "ACTIVE" }
    );
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const handleSaveLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.code.trim()) {
      return setErrorMessage("Tên và mã vị trí không được để trống!");
    }
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const payload = {
        name: formData.name.trim(),
        code: formData.code.trim().toUpperCase(),
        description: formData.description.trim(),
        status: formData.status,
        parentLocationId: targetParentId,
      };
      if (editingNode) {
        await locationApi.update(editingNode.id as any, payload as any);
      } else {
        await locationApi.create(payload as any);
      }
      await loadTreeData();
      setIsModalOpen(false);
    } catch (err: any) {
      setErrorMessage(
        err?.response?.data?.message ||
          err?.response?.data?.errors?.code ||
          "Lưu vị trí thất bại. Mã Code có thể đã tồn tại!"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!nodeToDelete) return;
    try {
      await locationApi.delete(nodeToDelete.id as any);
      if (activeNode?.id === nodeToDelete.id) setActiveNode(null);
      await loadTreeData();
    } catch (err: any) {
      alert(err?.response?.data?.message || "Không thể xóa vị trí này!");
    } finally {
      setNodeToDelete(null);
    }
  };

  const handleAssignUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignEmailInput.trim() || !activeNode) return;
    try {
      setAssignError(null);
      await (locationApi as any).assignUser?.(activeNode.id, assignEmailInput.trim());
      setAssignEmailInput("");
      setIsAssignModalOpen(false);
      await loadTreeData();
    } catch (err: any) {
      setAssignError(err?.response?.data?.message || "Không tìm thấy User với Email này!");
    }
  };

  const handleUnassignUser = async (userId: number | string) => {
    if (!activeNode || !confirm("Bỏ nhân sự này khỏi vị trí hiện tại?")) return;
    try {
      await (locationApi as any).unassignUser?.(activeNode.id, userId);
      await loadTreeData();
    } catch (err: any) {
      alert(err?.response?.data?.message || "Hủy gán nhân sự thất bại!");
    }
  };

  const filteredTreeData = useMemo(() => filterTreeNodes(treeData, searchQuery), [treeData, searchQuery]);

  const filteredActiveUsers = useMemo(() => {
    const list = activeNode?.users || [];
    if (!userSearchQuery.trim()) return list;
    const q = userSearchQuery.toLowerCase();
    return list.filter(
      (u) =>
        u.fullName?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.roleName?.toLowerCase().includes(q)
    );
  }, [activeNode, userSearchQuery]);

  const renderTreeNodes = (nodes: LocationNode[], depth = 0) => (
    <ul className={depth > 0 ? "pl-3.5 space-y-1 border-l border-border/60 ml-2.5 mt-1" : "space-y-1"}>
      {nodes.map((node) => {
        const userList = node.users || [];
        const userCount = node.totalUsers ?? userList.length ?? 0;
        const hasChildren = Boolean(node.children?.length);
        const isExpanded = Boolean(expandedIds[node.id] || searchQuery.trim());
        const isSelected = activeNode ? String(activeNode.id) === String(node.id) : false;

        return (
          <li key={node.id} className="text-xs select-none">
            <div
              onClick={() => handleNodeClick(node)}
              className={`flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer transition-all group ${
                isSelected
                  ? "bg-primary/15 text-primary font-semibold ring-1 ring-primary/30"
                  : "hover:bg-accent/70 text-foreground"
              }`}
            >
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                {hasChildren || userList.length > 0 ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedIds((p) => ({ ...p, [node.id]: !p[node.id] }));
                    }}
                    className="p-0.5 hover:bg-background/80 rounded text-muted-foreground shrink-0"
                  >
                    <ChevronRight
                      className={`size-3.5 transition-transform duration-200 ${
                        isExpanded ? "rotate-90 text-primary" : ""
                      }`}
                    />
                  </button>
                ) : (
                  <span className="w-4 shrink-0" />
                )}

                {hasChildren ? (
                  isExpanded ? (
                    <FolderOpen className="size-4 text-amber-500 shrink-0" />
                  ) : (
                    <Folder className="size-4 text-amber-500 shrink-0" />
                  )
                ) : (
                  <MapPin className="size-4 text-emerald-500 shrink-0" />
                )}

                <span className="truncate">{node.name}</span>
                <span className="text-[10px] font-mono text-muted-foreground/80 shrink-0">
                  ({node.code})
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0 ml-1">
                {userCount > 0 && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] bg-primary/10 text-primary border border-primary/20 font-medium">
                    <Users className="size-2.5" />
                    {userCount}
                  </span>
                )}
                <div className="hidden group-hover:flex items-center gap-0.5 bg-background/90 border border-border rounded px-1 py-0.5 shadow-xs">
                  <button type="button" onClick={(e) => openModal(node, false, e)} title="Thêm vị trí con" className="p-0.5 hover:text-primary">
                    <Plus className="size-3" />
                  </button>
                  <button type="button" onClick={(e) => openModal(node, true, e)} title="Chỉnh sửa" className="p-0.5 hover:text-blue-500">
                    <Edit2 className="size-3" />
                  </button>
                  <button type="button" onClick={(e) => { e.stopPropagation(); setNodeToDelete(node); }} title="Xóa" className="p-0.5 hover:text-destructive">
                    <Trash2 className="size-3" />
                  </button>
                </div>
              </div>
            </div>

            {isExpanded && userList.length > 0 && (
              <ul className="pl-5 space-y-1 my-1 border-l border-dashed border-primary/30 ml-4 max-h-48 overflow-y-auto pr-1">
                {userList.map((usr) => (
                  <li
                    key={usr.id}
                    className="flex items-center justify-between text-[11px] py-1 px-2 rounded bg-muted/40 hover:bg-muted/80 text-muted-foreground"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <UserIcon className="size-3 text-primary shrink-0" />
                      <span className="font-medium text-foreground truncate">{usr.fullName}</span>
                    </div>
                    {usr.roleName && (
                      <span className="text-[9px] bg-background px-1.5 py-0.5 rounded border border-border text-primary shrink-0 ml-1">
                        {usr.roleName}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {hasChildren && isExpanded && renderTreeNodes(node.children!, depth + 1)}
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-12 gap-4 h-[calc(100vh-200px)] min-h-[560px]">
        {/* Cột trái */}
        <div className="col-span-12 lg:col-span-4 bg-card border border-border rounded-xl p-3.5 shadow-xs flex flex-col h-full overflow-hidden">
          <div className="flex items-center gap-2 mb-3 shrink-0">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Tìm tên hoặc mã vị trí..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-background text-xs rounded-lg pl-8 pr-3 py-1.5 border border-input focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <button type="button" onClick={() => handleExpandAll(true)} title="Mở rộng toàn bộ" className="p-1.5 border border-input rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground shrink-0">
              <ChevronsUpDown className="size-3.5" />
            </button>
            <button type="button" onClick={() => handleExpandAll(false)} title="Thu gọn toàn bộ" className="p-1.5 border border-input rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground shrink-0">
              <ChevronsDownUp className="size-3.5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
            {loading ? (
              <div className="text-xs text-muted-foreground text-center py-8">Đang tải cây cơ sở...</div>
            ) : filteredTreeData.length > 0 ? (
              renderTreeNodes(filteredTreeData)
            ) : (
              <div className="text-xs text-muted-foreground text-center py-8">Không tìm thấy vị trí phù hợp.</div>
            )}
          </div>
        </div>

        {/* Cột phải */}
        <div className="col-span-12 lg:col-span-8 h-full overflow-hidden">
          {activeNode ? (
            <div className="bg-card border border-border rounded-xl p-5 shadow-xs flex flex-col h-full overflow-hidden">
              <div className="flex items-center justify-between border-b border-border pb-4 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-primary/10 rounded-xl text-primary border border-primary/20">
                    <Building2 className="size-6" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold tracking-tight">{activeNode.name}</h2>
                    <p className="text-xs font-mono text-muted-foreground">Mã vị trí: {activeNode.code}</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-medium">
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {activeNode.status || "ACTIVE"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 my-4 shrink-0">
                <div className="p-3.5 bg-muted/30 border border-border/70 rounded-xl flex items-center gap-3.5">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <Users className="size-5" />
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground font-medium">Tổng số nhân sự</p>
                    <p className="text-base font-bold">{activeNode.totalUsers ?? activeNode.users?.length ?? 0} người</p>
                  </div>
                </div>
                <div className="p-3.5 bg-muted/30 border border-border/70 rounded-xl flex items-center gap-3.5">
                  <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
                    <Building2 className="size-5" />
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground font-medium">Vị trí con trực thuộc</p>
                    <p className="text-base font-bold">{activeNode.children?.length || 0} vị trí</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 mb-3 shrink-0">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Users className="size-3.5 text-primary" />
                  Nhân sự trực thuộc ({filteredActiveUsers.length})
                </h3>
                <div className="flex items-center gap-2">
                  {(activeNode.users?.length || 0) > 0 && (
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2 size-3 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Lọc tên, email, role..."
                        value={userSearchQuery}
                        onChange={(e) => setUserSearchQuery(e.target.value)}
                        className="bg-background text-xs rounded-lg pl-7 pr-2.5 py-1 border border-input focus:outline-none focus:ring-1 focus:ring-primary w-44"
                      />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => exportLocationUsersCsv(activeNode)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-background text-foreground border border-input text-xs font-medium rounded-lg hover:bg-accent transition-colors shadow-xs"
                  >
                    <Download className="size-3.5 text-emerald-500" />
                    <span>Xuất báo cáo</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAssignModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-lg hover:bg-primary/90 transition-colors shadow-xs"
                  >
                    <UserPlus className="size-3.5" />
                    <span>Gán nhân sự</span>
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto border border-border rounded-xl custom-scrollbar">
                {filteredActiveUsers.length > 0 ? (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-muted/80 backdrop-blur-xs border-b border-border text-muted-foreground font-semibold sticky top-0 z-10">
                      <tr>
                        <th className="py-2.5 px-3.5">Họ và tên</th>
                        <th className="py-2.5 px-3.5">Chức danh / Role</th>
                        <th className="py-2.5 px-3.5">Email</th>
                        <th className="py-2.5 px-3.5">Số điện thoại</th>
                        <th className="py-2.5 px-3.5 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/70">
                      {filteredActiveUsers.map((usr) => (
                        <tr key={usr.id} className="hover:bg-muted/40 transition-colors">
                          <td className="py-2.5 px-3.5 font-medium">
                            <div className="flex items-center gap-2.5">
                              <div className="size-7 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-[11px] shrink-0">
                                {usr.fullName ? usr.fullName.charAt(0).toUpperCase() : "U"}
                              </div>
                              <span className="truncate">{usr.fullName}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3.5">
                            {usr.roleName ? (
                              <span className="inline-flex items-center gap-1 text-[11px] bg-primary/10 text-primary px-2 py-0.5 rounded-md border border-primary/20 font-medium">
                                <Briefcase className="size-3" />
                                {usr.roleName}
                              </span>
                            ) : (
                              <span className="text-muted-foreground italic">Chưa gán</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3.5 text-muted-foreground">
                            <div className="flex items-center gap-1.5">
                              <Mail className="size-3 text-muted-foreground/70 shrink-0" />
                              <span className="truncate">{usr.email || "—"}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3.5 text-muted-foreground">
                            <div className="flex items-center gap-1.5">
                              <Phone className="size-3 text-muted-foreground/70 shrink-0" />
                              <span>{usr.phone || "—"}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3.5 text-right">
                            <button
                              type="button"
                              onClick={() => handleUnassignUser(usr.id)}
                              title="Bỏ gán khỏi vị trí này"
                              className="p-1.5 rounded-md hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center p-8 text-center text-xs text-muted-foreground gap-2">
                    <Users className="size-8 text-muted-foreground/30" />
                    <p>
                      {userSearchQuery
                        ? "Không tìm thấy nhân sự nào khớp với từ khóa."
                        : "Chưa có nhân sự nào được gán trực tiếp tại vị trí này (nhân sự có thể nằm ở các vị trí con bên dưới)."}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl p-12 text-center text-xs text-muted-foreground h-full flex flex-col items-center justify-center gap-2">
              <Building2 className="size-10 text-muted-foreground/40" />
              <p className="font-medium">Chọn một vị trí ở cây bên trái để xem thông tin chi tiết.</p>
            </div>
          )}
        </div>
      </div>

      {/* Khối Chart phía dưới */}
      <div className="space-y-3 pt-1">
        <div className="flex items-center justify-between bg-card border border-border rounded-xl px-4 py-2.5 shadow-xs">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <BarChart3 className="size-4 text-primary" />
            <span>
              Thống kê trực quan cho:{" "}
              <strong className="text-foreground">{activeNode?.name || "Hệ thống Location"}</strong>
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowChart((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
          >
            <BarChart3 className="size-3.5" />
            <span>{showChart ? "Thu gọn biểu đồ" : "Mở biểu đồ thống kê"}</span>
          </button>
        </div>
        {showChart && <LocationDashboardChart treeData={treeData} activeNode={activeNode} />}
      </div>

      <LocationFormModal
        isOpen={isModalOpen}
        editingNode={editingNode}
        formData={formData}
        setFormData={setFormData}
        errorMessage={errorMessage}
        submitting={submitting}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSaveLocation}
      />
      <AssignUserModal
        isOpen={isAssignModalOpen}
        email={assignEmailInput}
        setEmail={setAssignEmailInput}
        error={assignError}
        onClose={() => setIsAssignModalOpen(false)}
        onSubmit={handleAssignUser}
      />
      <DeleteConfirmModal
        node={nodeToDelete}
        onCancel={() => setNodeToDelete(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};