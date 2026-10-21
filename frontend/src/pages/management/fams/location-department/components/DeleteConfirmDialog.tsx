import React from "react";
import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  itemName?: string;
  warningNote?: string;
  onConfirm: () => void;
  isLoading?: boolean;
}

export const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps> = ({
  open,
  onOpenChange,
  title,
  description,
  itemName,
  warningNote,
  onConfirm,
  isLoading = false,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] p-6 bg-white">
        <DialogHeader className="flex flex-col items-center text-center gap-2">
          <div className="h-12 w-12 rounded-full bg-red-50 flex items-center justify-center text-red-600 mb-1">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <DialogTitle className="text-lg font-bold text-gray-900">
            {title}
          </DialogTitle>
          <p className="text-sm text-gray-500">{description}</p>
          {itemName && (
            <div className="mt-1 px-3 py-1.5 rounded-md bg-gray-100 font-semibold text-gray-800 text-sm">
              "{itemName}"
            </div>
          )}
          {warningNote && (
            <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2.5 text-left w-full">
              <strong>Warning:</strong> {warningNote}
            </div>
          )}
        </DialogHeader>

        <DialogFooter className="mt-5 flex items-center justify-center sm:justify-end gap-2 pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-sm font-medium text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            {isLoading ? "Deleting..." : "Confirm Delete"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
