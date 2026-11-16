import React from "react";
import { X, AlertTriangle } from "lucide-react";

interface ModalLocationNode {
  id: number | string;
  name: string;
  code: string;
  status?: string;
  parentId?: number | string | null;
}

interface LocationFormModalProps {
  isOpen: boolean;
  editingNode: ModalLocationNode | null;
  formData: { name: string; code: string; description: string; status: string };
  setFormData: React.Dispatch<
    React.SetStateAction<{ name: string; code: string; description: string; status: string }>
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
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
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
  email: string;
  setEmail: (val: string) => void;
  error: string | null;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const AssignUserModal: React.FC<AssignUserModalProps> = ({
  isOpen,
  email,
  setEmail,
  error,
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
            <label className="block mb-1 font-medium text-muted-foreground">Email Nhân sự *</label>
            <input
              type="email"
              required
              placeholder="Ví dụ: student01@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-background border border-input p-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
            />
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
              className="px-4 py-1.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90"
            >
              Gán nhân sự
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