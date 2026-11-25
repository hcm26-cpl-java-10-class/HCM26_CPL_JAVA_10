import React from "react";
import { X, AlertTriangle } from "lucide-react";

interface ModalLocationNode {
  id: number | string;
  name: string;
  code: string;
  status?: string;
  parentLocationId?: number | string | null;
}

interface LocationFormModalProps {
  isOpen: boolean;
  editingNode: ModalLocationNode | null;
  formData: {
    name: string;
    code: string;
    description: string;
    status: "ACTIVE" | "INACTIVE";
  };
  setFormData: React.Dispatch<
    React.SetStateAction<{
      name: string;
      code: string;
      description: string;
      status: "ACTIVE" | "INACTIVE";
    }>
  >;
  errorMessage: string | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const LocationFormModal: React.FC<LocationFormModalProps> = ({
  isOpen,
  editingNode,
  formData,
  setFormData,
  errorMessage,
  submitting,
  onClose,
  onSubmit,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl p-5 w-full max-w-md space-y-4 shadow-xl">
        <div className="flex justify-between items-center border-b border-border pb-3">
          <h3 className="font-semibold text-sm">
            {editingNode ? "Chỉnh sửa vị trí" : "Thêm vị trí trực thuộc"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        {errorMessage && (
          <div className="p-2.5 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-lg flex items-center gap-2">
            <AlertTriangle className="size-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block mb-1 font-medium text-muted-foreground">Tên vị trí *</label>
            <input
              type="text"
              required
              placeholder="Ví dụ: Phòng Kế toán"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-background border border-input p-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block mb-1 font-medium text-muted-foreground">
              Mã vị trí (Code) *
            </label>
            <input
              type="text"
              required
              placeholder="Ví dụ: HN_ACC_01"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              className="w-full bg-background border border-input p-2 rounded-lg font-mono uppercase focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block mb-1 font-medium text-muted-foreground">Mô tả vị trí</label>
            <textarea
              rows={2}
              placeholder="Mô tả ngắn gọn về chức năng của vị trí này..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full bg-background border border-input p-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
          </div>
          <div>
            <label className="block mb-1 font-medium text-muted-foreground">Trạng thái</label>
            <select
              value={formData.status}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  status: e.target.value === "INACTIVE" ? "INACTIVE" : "ACTIVE",
                })
              }
              className="w-full bg-background border border-input p-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ACTIVE">Hoạt động (ACTIVE)</option>
              <option value="INACTIVE">Khóa / Ngưng (INACTIVE)</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 border border-input rounded-lg hover:bg-muted"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              {submitting ? "Đang lưu..." : "Lưu thay đổi"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface AssignUserModalProps {
  isOpen: boolean;
  search: string;
  setSearch: (val: string) => void;
  candidates: Array<{
    id: number;
    email: string;
    fullName: string;
    employeeCode?: string | null;
    roleName?: string | null;
  }>;
  selectedUserIds: number[];
  setSelectedUserIds: React.Dispatch<React.SetStateAction<number[]>>;
  error: string | null;
  loadingCandidates: boolean;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const AssignUserModal: React.FC<AssignUserModalProps> = ({
  isOpen,
  search,
  setSearch,
  candidates,
  selectedUserIds,
  setSelectedUserIds,
  error,
  loadingCandidates,
  submitting,
  onClose,
  onSubmit,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl p-5 w-full max-w-sm space-y-4 shadow-xl">
        <div className="flex justify-between items-center border-b border-border pb-3">
          <h3 className="font-semibold text-sm">Gán nhân sự vào vị trí</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        {error && (
          <div className="p-2.5 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-lg flex items-center gap-2">
            <AlertTriangle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block mb-1 font-medium text-muted-foreground">Tìm nhân sự *</label>
            <input
              type="search"
              placeholder="Tên, email hoặc mã nhân viên"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-background border border-input p-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-border p-1">
            {loadingCandidates ? (
              <p className="py-6 text-center text-muted-foreground">Đang tải nhân sự...</p>
            ) : candidates.length === 0 ? (
              <p className="py-6 text-center text-muted-foreground">Không có nhân sự phù hợp.</p>
            ) : (
              candidates.map((candidate) => {
                const checked = selectedUserIds.includes(candidate.id);
                return (
                  <label
                    key={candidate.id}
                    className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 ${
                      checked ? "bg-primary/10" : "hover:bg-muted/60"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) =>
                        setSelectedUserIds((previous) =>
                          e.target.checked
                            ? [...previous, candidate.id]
                            : previous.filter((id) => id !== candidate.id)
                        )
                      }
                      className="size-3.5"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{candidate.fullName}</p>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {candidate.email}
                        {candidate.employeeCode ? ` · ${candidate.employeeCode}` : ""}
                      </p>
                    </div>
                    {candidate.roleName && (
                      <span className="shrink-0 rounded border border-border bg-background px-1.5 py-0.5 text-[9px]">
                        {candidate.roleName}
                      </span>
                    )}
                  </label>
                );
              })
            )}
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 border border-input rounded-lg hover:bg-muted"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting || selectedUserIds.length === 0}
              className="px-4 py-1.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              {submitting ? "Đang gán..." : `Gán ${selectedUserIds.length || ""} nhân sự`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface DeleteConfirmModalProps {
  node: ModalLocationNode | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  node,
  onCancel,
  onConfirm,
}) => {
  if (!node) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl p-5 w-full max-w-xs space-y-3 text-center shadow-xl">
        <AlertTriangle className="size-8 text-destructive mx-auto" />
        <h3 className="font-semibold text-sm">Xóa vị trí này?</h3>
        <p className="text-xs text-muted-foreground">
          Bạn có chắc chắn muốn xóa <b>{node.name}</b>?
        </p>
        <div className="flex justify-center gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3.5 py-1.5 border border-input rounded-lg text-xs hover:bg-muted"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-3.5 py-1.5 bg-destructive text-destructive-foreground rounded-lg text-xs font-medium"
          >
            Xóa ngay
          </button>
        </div>
      </div>
    </div>
  );
};