import React, { useState, useEffect, useCallback } from "react";
import { Folder, FolderOpen, MapPin, ChevronRight, Building2, Search, Layers, Plus, Edit2, Trash2, X, AlertTriangle } from "lucide-react";
import type { LocationNode } from "@/types/features/rbac/location";
import { locationApi } from "@/api/features/rbac/location.api";

interface LocationTreeProps {
  selectedLocationId: number | string | null;
  onSelectLocation: (location: LocationNode) => void;
}

const MOCK_LOCATION_TREE: LocationNode[] = [
  {
    id: 1,
    code: "VN",
    name: "Việt Nam (Hệ thống Cơ sở)",
    parentId: null,
    users: [
      { id: 101, username: "GV001", fullName: "GS.TS. Nguyễn Văn A", jobTitle: "Trưởng Ban Đào tạo", email: "nva@edu.vn", phone: "0901234567" },
      { id: 102, username: "NV001", fullName: "ThS. Trần Thị B", jobTitle: "Chuyên viên Khảo thí", email: "ttb@edu.vn", phone: "0909876543" },
    ],
    children: [
      {
        id: 2,
        code: "CAMPUS_HN",
        name: "Cơ sở Hà Nội",
        parentId: 1,
        users: [
          { id: 103, username: "GV002", fullName: "PGS.TS. Lê Văn C", jobTitle: "Giám đốc Cơ sở Hà Nội", email: "lvc@edu.vn", phone: "0912345678" }
        ],
        children: [
          {
            id: 3,
            code: "HOA_LAC",
            name: "Phân hiệu Hòa Lạc",
            parentId: 2,
            users: [
              { id: 104, username: "GV003", fullName: "ThS. Phạm Minh D", jobTitle: "Giảng viên Khoa CNTT", email: "pmd@edu.vn", phone: "0933333333" },
              { id: 105, username: "NV002", fullName: "Hoàng Anh E", jobTitle: "Cán bộ Quản lý Sinh viên", email: "hae@edu.vn", phone: "0944444444" }
            ],
            children: []
          },
          {
            id: 4,
            code: "CAU_GIAY",
            name: "Cơ sở Cầu Giấy (Tòa nhà Đào tạo)",
            parentId: 2,
            users: [
              { id: 106, username: "GV004", fullName: "TS. Đỗ Quốc F", jobTitle: "Trưởng Bộ môn Ngoại ngữ", email: "dqf@edu.vn", phone: "0944444444" }
            ],
            children: []
          }
        ]
      },
      {
        id: 5,
        code: "CAMPUS_HCM",
        name: "Cơ sở TP. Hồ Chí Minh",
        parentId: 1,
        users: [
          { id: 107, username: "GV005", fullName: "TS. Nguyễn Thị G", jobTitle: "Phó Giám đốc Cơ sở HCM", email: "ntg@edu.vn", phone: "0966666666" }
        ],
        children: [
          {
            id: 6,
            code: "KHU_CNCAO",
            name: "Phân hiệu Khu Công nghệ cao (Q9)",
            parentId: 5,
            users: [
              { id: 108, username: "NV003", fullName: "Vũ Văn H", jobTitle: "Giáo vụ Khoa Kỹ thuật", email: "vvh@edu.vn", phone: "0977777777" }
            ],
            children: []
          }
        ]
      },
      {
        id: 7,
        code: "CAMPUS_DN",
        name: "Cơ sở Đà Nẵng",
        parentId: 1,
        users: [],
        children: []
      }
    ]
  }
];

export const LocationTree: React.FC<LocationTreeProps> = ({
  selectedLocationId,
  onSelectLocation,
}) => {
  const [treeData, setTreeData] = useState<LocationNode[]>(MOCK_LOCATION_TREE);
  const [expandedIds, setExpandedIds] = useState<Record<string | number, boolean>>({ 1: true, 2: true, 5: true });
  const [searchQuery, setSearchQuery] = useState("");

  // States cho Form Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<LocationNode | null>(null);
  const [targetParentId, setTargetParentId] = useState<number | string | null>(null);
  const [formData, setFormData] = useState({ name: "", code: "" });

  // States cho Delete Confirmation Modal chuẩn UI
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [nodeToDelete, setNodeToDelete] = useState<LocationNode | null>(null);

  const loadTreeData = useCallback(async () => {
    try {
      const data = await locationApi.getLocationTree();
      if (data && Array.isArray(data) && data.length > 0) {
        setTreeData(data);
      } else {
        setTreeData(MOCK_LOCATION_TREE);
      }
    } catch (error) {
      setTreeData(MOCK_LOCATION_TREE);
    }
  }, []);

  useEffect(() => {
    loadTreeData();
  }, [loadTreeData]);

  useEffect(() => {
    if (!selectedLocationId && MOCK_LOCATION_TREE.length > 0) {
      onSelectLocation(MOCK_LOCATION_TREE[0]);
    }
  }, [selectedLocationId, onSelectLocation]);

  const toggleExpand = (id: number | string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleExpandAll = () => {
    const allIds: Record<string | number, boolean> = {};
    const traverse = (nodes: LocationNode[]) => {
      nodes.forEach((n) => {
        allIds[n.id] = true;
        if (n.children) traverse(n.children);
      });
    };
    traverse(treeData);
    setExpandedIds(allIds);
  };

  const handleAddChild = (node: LocationNode, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingNode(null);
    setTargetParentId(node.id);
    setFormData({ name: "", code: "" });
    setIsModalOpen(true);
  };

  const handleEditNode = (node: LocationNode, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingNode(node);
    setTargetParentId(node.parentId);
    setFormData({ name: node.name, code: node.code });
    setIsModalOpen(true);
  };

  // Trigger mở Confirm Delete Modal
  const handleOpenDeleteModal = (node: LocationNode, e: React.MouseEvent) => {
    e.stopPropagation();
    setNodeToDelete(node);
    setIsDeleteModalOpen(true);
  };

  // Thực thi xóa nút khỏi cây
  const handleConfirmDelete = () => {
    if (!nodeToDelete) return;
    const deleteFromTree = (nodes: LocationNode[]): LocationNode[] => {
      return nodes
        .filter((n) => String(n.id) !== String(nodeToDelete.id))
        .map((n) => ({
          ...n,
          children: n.children ? deleteFromTree(n.children) : [],
        }));
    };
    setTreeData((prev) => deleteFromTree(prev));
    setIsDeleteModalOpen(false);
    setNodeToDelete(null);
  };

  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.code) return;

    if (editingNode) {
      const updateTree = (nodes: LocationNode[]): LocationNode[] => {
        return nodes.map((n) => {
          if (n.id === editingNode.id) {
            return { ...n, name: formData.name, code: formData.code };
          }
          if (n.children) {
            return { ...n, children: updateTree(n.children) };
          }
          return n;
        });
      };
      setTreeData((prev) => updateTree(prev));
    } else {
      const newNode: LocationNode = {
        id: Date.now(),
        name: formData.name,
        code: formData.code,
        parentId: targetParentId as any,
        users: [],
        children: [],
      };

      const insertTree = (nodes: LocationNode[]): LocationNode[] => {
        return nodes.map((n) => {
          if (String(n.id) === String(targetParentId)) {
            return { ...n, children: [...(n.children || []), newNode] };
          }
          if (n.children) {
            return { ...n, children: insertTree(n.children) };
          }
          return n;
        });
      };

      if (!targetParentId) {
        setTreeData((prev) => [...prev, newNode]);
      } else {
        setTreeData((prev) => insertTree(prev));
        setExpandedIds((prev) => ({ ...prev, [targetParentId]: true }));
      }
    }

    setIsModalOpen(false);
  };

  const filterTree = (nodes: LocationNode[], query: string): LocationNode[] => {
    if (!query) return nodes;
    return nodes.reduce<LocationNode[]>((acc, node) => {
      const matches =
        node.name.toLowerCase().includes(query.toLowerCase()) ||
        node.code.toLowerCase().includes(query.toLowerCase());
      const filteredChildren = node.children ? filterTree(node.children, query) : [];

      if (matches || filteredChildren.length > 0) {
        acc.push({
          ...node,
          children: filteredChildren,
        });
      }
      return acc;
    }, []);
  };

  const displayedData = searchQuery ? filterTree(treeData, searchQuery) : treeData;

  const renderTreeNode = (node: LocationNode, depth: number = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = !!expandedIds[node.id] || searchQuery.length > 0;
    const isSelected = selectedLocationId === node.id;

    return (
      <div key={node.id} className="flex flex-col text-xs select-none">
        <div
          onClick={() => onSelectLocation(node)}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          className={`group flex items-center gap-1.5 py-1.5 pr-2 rounded-lg cursor-pointer transition-all duration-200 border border-transparent ${
            isSelected
              ? "bg-blue-500/15 text-blue-500 dark:text-blue-400 font-semibold border-blue-500/30 shadow-xs"
              : "hover:bg-accent/70 text-muted-foreground hover:text-foreground"
          }`}
        >
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => toggleExpand(node.id, e)}
              className="p-1 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground shrink-0 transition-transform duration-200 cursor-pointer"
            >
              <ChevronRight
                className={`size-3.5 transition-transform duration-200 ${
                  isExpanded ? "rotate-90 text-blue-500" : ""
                }`}
              />
            </button>
          ) : (
            <span className="w-5 shrink-0" />
          )}

          {depth === 0 ? (
            <Building2 className={`size-4 shrink-0 transition-colors ${isSelected ? "text-blue-500" : "text-blue-400/80"}`} />
          ) : isExpanded ? (
            <FolderOpen className="size-4 text-amber-500 shrink-0 transition-transform duration-200" />
          ) : (
            <Folder className="size-4 text-amber-500/80 shrink-0 transition-transform duration-200" />
          )}

          <span className="truncate flex-1 tracking-tight">{node.name}</span>

          <span
            className={`text-[10px] font-mono px-1.5 py-0.5 rounded border transition-colors shrink-0 ${
              isSelected
                ? "bg-blue-500/20 text-blue-600 dark:text-blue-300 border-blue-500/30"
                : "bg-muted/70 text-muted-foreground border-border/60 group-hover:border-border"
            }`}
          >
            {node.code}
          </span>

          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 ml-1 transition-opacity">
            <button
              type="button"
              onClick={(e) => handleAddChild(node, e)}
              className="p-1 hover:bg-muted text-muted-foreground hover:text-blue-500 rounded cursor-pointer"
              title="Add Sub-location"
            >
              <Plus className="size-3" />
            </button>
            <button
              type="button"
              onClick={(e) => handleEditNode(node, e)}
              className="p-1 hover:bg-muted text-muted-foreground hover:text-amber-500 rounded cursor-pointer"
              title="Edit Location"
            >
              <Edit2 className="size-3" />
            </button>
            <button
              type="button"
              onClick={(e) => handleOpenDeleteModal(node, e)}
              className="p-1 hover:bg-muted text-muted-foreground hover:text-rose-500 rounded cursor-pointer"
              title="Delete Location"
            >
              <Trash2 className="size-3" />
            </button>
          </div>
        </div>

        {hasChildren && (
          <div
            className={`grid transition-all duration-300 ease-in-out ${
              isExpanded ? "grid-rows-[1fr] opacity-100 mt-1" : "grid-rows-[0fr] opacity-0"
            }`}
          >
            <div className="overflow-hidden flex flex-col gap-0.5">
              {node.children!.map((child) => renderTreeNode(child, depth + 1))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="rounded-xl border border-border bg-card p-3.5 shadow-xs flex flex-col gap-3">
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <h3 className="text-xs font-bold text-card-foreground flex items-center gap-2">
          <div className="p-1.5 bg-blue-500/10 text-blue-500 rounded-md">
            <MapPin className="size-4" />
          </div>
          <span>Sơ đồ Địa điểm</span>
        </h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleExpandAll}
            className="p-1 hover:bg-muted text-[10px] text-muted-foreground hover:text-foreground rounded transition-colors cursor-pointer"
            title="Expand All"
          >
            <Layers className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
        <input
          type="text"
          placeholder="Filter tree..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-background text-xs rounded-lg pl-8 pr-3 py-1.5 border border-input focus:outline-none focus:ring-1 focus:ring-blue-500 text-foreground placeholder:text-muted-foreground"
        />
      </div>

      <div className="flex flex-col gap-0.5 max-h-[520px] overflow-y-auto pr-1 custom-scrollbar">
        {displayedData.length > 0 ? (
          displayedData.map((node) => renderTreeNode(node, 0))
        ) : (
          <div className="py-8 text-center text-xs text-muted-foreground">
            No location data
          </div>
        )}
      </div>

      {/* Form Modal (Add/Edit Node) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl shadow-lg w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-3.5 border-b border-border flex items-center justify-between">
              <h4 className="text-xs font-bold text-foreground">
                {editingNode ? "Edit Location Node" : "Add Sub-location Node"}
              </h4>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-muted-foreground hover:text-foreground rounded-md cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="p-3.5 flex flex-col gap-3 text-xs">
              <div>
                <label className="block text-muted-foreground font-medium mb-1">
                  Location Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Cơ sở Cầu Giấy"
                  className="w-full bg-background border border-input rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 outline-none text-foreground"
                />
              </div>

              <div>
                <label className="block text-muted-foreground font-medium mb-1">
                  Location Code *
                </label>
                <input
                  type="text"
                  required
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="e.g. CAU_GIAY"
                  className="w-full bg-background border border-input rounded-lg px-3 py-1.5 text-xs font-mono focus:ring-1 focus:ring-blue-500 outline-none text-foreground"
                />
              </div>

              <div className="flex justify-end gap-2 mt-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-border hover:bg-accent text-muted-foreground text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
                >
                  Save Node
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Delete Modal Chuẩn UI (Y hệt ảnh chụp mẫu) */}
      {isDeleteModalOpen && nodeToDelete && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 flex items-center justify-between border-b border-border/50">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-rose-500/10 text-rose-500 rounded-md">
                  <Trash2 className="size-4" />
                </div>
                <h4 className="text-xs font-bold text-foreground">Delete Confirmation</h4>
              </div>
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="p-1 text-muted-foreground hover:text-foreground rounded-md cursor-pointer transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="p-4 text-xs text-muted-foreground">
              <p>
                Are you sure you want to delete <strong className="text-foreground">{nodeToDelete.name}</strong> ({nodeToDelete.code})? This action cannot be undone.
              </p>
            </div>

            <div className="p-3 bg-muted/20 border-t border-border/50 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-3.5 py-1.5 rounded-lg border border-border hover:bg-accent text-foreground text-xs font-medium transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <Trash2 className="size-3.5" />
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LocationTree;