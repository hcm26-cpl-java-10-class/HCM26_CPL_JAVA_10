import ActionButton from "@/components/datatable/common/ActionButton";
import type { RubricListItem } from "@/types";
import { CopyPlus, Eye, Pen, Send, Trash2 } from "lucide-react";
import {
  canCreateDraftFromVersion,
  canDeleteRubricVersion,
  canEditRubricVersion,
  canPublishRubricVersion,
} from "../rubric-version-policy";

interface RubricRowActionsProps {
  rubric: RubricListItem;
  canUpdate: boolean;
  canDelete: boolean;
  canCreate: boolean;
  onView: (rubric: RubricListItem) => void;
  onEdit: (rubric: RubricListItem) => void;
  onPublish: (rubric: RubricListItem) => void;
  onCreateVersion: (rubric: RubricListItem) => void;
  onDelete: (rubric: RubricListItem) => void;
}

export function RubricRowActions({
  rubric,
  canUpdate,
  canDelete,
  canCreate,
  onView,
  onEdit,
  onPublish,
  onCreateVersion,
  onDelete,
}: RubricRowActionsProps) {
  return (
    <>
      <ActionButton
        onClick={() => onView(rubric)}
        tooltip="View detail"
        icon={<Eye size={10} className="text-gray-500" />}
      />
      {canEditRubricVersion(rubric.latestStatus) && canUpdate ? (
        <ActionButton
          onClick={() => onEdit(rubric)}
          tooltip="Edit latest draft"
          icon={<Pen size={10} className="text-gray-500" />}
        />
      ) : null}
      {canPublishRubricVersion(rubric.latestStatus) && canUpdate ? (
        <ActionButton
          onClick={() => onPublish(rubric)}
          tooltip="Publish latest draft"
          icon={<Send size={10} className="text-emerald-600" />}
        />
      ) : null}
      {canDeleteRubricVersion(rubric.latestStatus) && canDelete ? (
        <ActionButton
          onClick={() => onDelete(rubric)}
          tooltip="Delete latest draft"
          icon={<Trash2 size={10} className="text-red-500" />}
        />
      ) : null}
      {canCreateDraftFromVersion(rubric.latestStatus) && canCreate ? (
        <ActionButton
          onClick={() => onCreateVersion(rubric)}
          tooltip="Create new draft version"
          icon={<CopyPlus size={10} className="text-gray-500" />}
        />
      ) : null}
    </>
  );
}
