import { Eye, Pen, Trash2 } from "lucide-react";
import ActionButton from "../common/ActionButton";
import { PermissionGate } from "@/components/PermissionGate";
import { TooltipWrapper } from "../common/TooltipWrapper";
import { Button } from "@/components/ui/button";

interface RowActionsProps {
  row: any;
  onView: (row: any) => void;
  onEdit: (row: any) => void;
  onDelete: (row: any) => void;
  viewPermission?: string;
  editPermission?: string;
  deletePermission?: string;
  deleteDisabled?: boolean;
}

export function RowActions({
  row,
  onView,
  onEdit,
  onDelete,
  viewPermission,
  editPermission,
  deletePermission,
  deleteDisabled = false,
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
        {deleteDisabled ? (
          <TooltipWrapper content="System role cannot be deleted">
            <span className="inline-flex">
              <Button variant="outline" size="icon" disabled aria-label="Delete">
                <Trash2 size={10} className="text-red-500" />
              </Button>
            </span>
          </TooltipWrapper>
        ) : (
          <ActionButton
            onClick={() => onDelete(row)}
            tooltip="Delete"
            icon={<Trash2 size={10} className="text-red-500" />}
          />
        )}
      </PermissionGate>
    </>
  );
}
