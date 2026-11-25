export interface UtilLocationUser {
  id: number | string;
  fullName?: string;
  roleName?: string;
  email?: string;
  phone?: string;
}

export interface UtilLocationNode {
  id: number | string;
  name: string;
  code: string;
  users?: UtilLocationUser[];
  children?: UtilLocationNode[];
}

export const findNodeById = <T extends UtilLocationNode>(
  nodes: T[],
  id: string | number
): T | null => {
  for (const node of nodes) {
    if (String(node.id) === String(id)) return node;
    if (node.children?.length) {
      const found = findNodeById(node.children as T[], id);
      if (found) return found;
    }
  }
  return null;
};

export const filterTreeNodes = <T extends UtilLocationNode>(
  nodes: T[],
  query: string
): T[] => {
  if (!query.trim()) return nodes;
  const q = query.toLowerCase();

  return nodes
    .map((node) => {
      const match =
        node.name.toLowerCase().includes(q) || node.code.toLowerCase().includes(q);
      const children = node.children ? filterTreeNodes(node.children as T[], query) : [];
      return match || children.length > 0 ? { ...node, children } : null;
    })
    .filter(Boolean) as T[];
};

export const exportLocationUsersCsv = (activeNode: UtilLocationNode) => {
  const rows: string[][] = [];

  const collect = (node: UtilLocationNode) => {
    node.users?.forEach((u) => {
      rows.push([
        String(rows.length + 1),
        node.code,
        node.name,
        u.fullName || "",
        u.roleName || "",
        u.email || "",
        u.phone || "",
      ]);
    });
    node.children?.forEach(collect);
  };

  collect(activeNode);

  if (rows.length === 0) {
    toast.error("Vị trí này hiện chưa có nhân sự nào để xuất báo cáo!");
    return;
  }

  const headers = [
    "STT",
    "Mã vị trí",
    "Tên đơn vị / Phòng",
    "Họ và tên",
    "Chức danh (Role)",
    "Email",
    "Số điện thoại",
  ];
  const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = [headers, ...rows].map((row) => row.map(escape).join(",")).join("\n");

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `Bao_cao_nhan_su_${activeNode.code}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  toast.success("Đã xuất báo cáo nhân sự.");
};
import { toast } from "sonner";
