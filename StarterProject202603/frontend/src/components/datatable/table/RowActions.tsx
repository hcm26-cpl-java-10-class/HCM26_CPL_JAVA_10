import { Eye, Pen, Trash2 } from "lucide-react";
import ActionButton from "../common/ActionButton";
import { PermissionGate } from "@/components/PermissionGate";

interface RowActionsProps {
  row: any;
  onView: (row: any) => void;
  onEdit: (row: any) => void;
  onDelete: (row: any) => void;
  viewPermission?: string;
  editPermission?: string;
  deletePermission?: string;
}

export function RowActions({
  row,
  onView,
  onEdit,
  onDelete,
  viewPermission,
  editPermission,
  deletePermission,
}: RowActionsProps) {
  return (
    <>
      <PermissionGate permission={viewPermission}>
        <ActionButton
          onClick={() => onView(row)}
          tooltip="View detail"
          icon={<Eye size={10} className="text-gray-500" />}
        />
      </PermissionGate>
      <PermissionGate permission={editPermission}>
        <ActionButton
          onClick={() => onEdit(row)}
          tooltip="Edit"
          icon={<Pen size={10} className="text-gray-500" />}
        />
      </PermissionGate>
      <PermissionGate permission={deletePermission}>
        <ActionButton
          onClick={() => onDelete(row)}
          tooltip="Delete"
          icon={<Trash2 size={10} className="text-red-500" />}
        />
      </PermissionGate>
    </>
  );
}
