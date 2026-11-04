import React from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface DeleteConfirmDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description: string;
    itemName?: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
}

export const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps> = ({
    open,
    onOpenChange,
    title,
    description,
    itemName,
    confirmText = "Xóa",
    cancelText = "Hủy",
    onConfirm,
}) => {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader className="gap-2">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400">
                            <AlertTriangle className="h-5 w-5" />
                        </div>
                        <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            {title}
                        </DialogTitle>
                    </div>
                    <DialogDescription className="text-sm text-gray-500 pt-1">
                        {description}
                        {itemName && (
                            <span className="mt-2 block font-medium text-gray-900 dark:text-gray-200">
                                "{itemName}"
                            </span>
                        )}
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="mt-4 gap-2 sm:gap-0">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        className="text-gray-700 hover:bg-gray-100 cursor-pointer"
                    >
                        {cancelText}
                    </Button>
                    <Button
                        type="button"
                        variant="destructive"
                        onClick={() => {
                            onConfirm();
                            onOpenChange(false);
                        }}
                        className="bg-red-600 hover:bg-red-700 text-white cursor-pointer"
                    >
                        {confirmText}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
