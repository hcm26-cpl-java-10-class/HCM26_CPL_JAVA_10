import React, { useEffect, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ModuleGroupItem, ModuleGroupFormData } from "../types";

interface ModuleGroupModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialData?: ModuleGroupItem | null;
    onSubmit: (data: ModuleGroupFormData) => void;
}

export const ModuleGroupModal: React.FC<ModuleGroupModalProps> = ({
    open,
    onOpenChange,
    initialData,
    onSubmit,
}) => {
    const isEdit = Boolean(initialData);

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [displayOrder, setDisplayOrder] = useState<number>(1);
    const [errors, setErrors] = useState<{ name?: string }>({});

    useEffect(() => {
        if (open) {
            if (initialData) {
                setName(initialData.name || "");
                setDescription(initialData.description || "");
                setDisplayOrder(initialData.displayOrder || 1);
            } else {
                setName("");
                setDescription("");
                setDisplayOrder(1);
            }
            setErrors({});
        }
    }, [open, initialData]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const trimmedName = name.trim();
        if (!trimmedName) {
            setErrors({ name: "Tên nhóm module không được để trống" });
            return;
        }

        onSubmit({
            name: trimmedName,
            description: description.trim(),
            displayOrder: Number(displayOrder) || 1,
        });

        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[480px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            {isEdit ? "Chỉnh sửa nhóm module" : "Thêm nhóm module mới"}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="grid gap-1.5">
                            <Label htmlFor="group-name" className="text-sm font-medium text-gray-700">
                                Tên nhóm module <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="group-name"
                                value={name}
                                onChange={(e) => {
                                    setName(e.target.value);
                                    if (errors.name) setErrors({});
                                }}
                                placeholder="Nhập tên nhóm module (ví dụ: Training Group)"
                                className={errors.name ? "border-red-500 focus-visible:ring-red-500" : ""}
                            />
                            {errors.name && (
                                <p className="text-xs text-red-500 font-medium">{errors.name}</p>
                            )}
                        </div>

                        <div className="grid gap-1.5">
                            <Label htmlFor="group-desc" className="text-sm font-medium text-gray-700">
                                Mô tả
                            </Label>
                            <Textarea
                                id="group-desc"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Mô tả chức năng của nhóm module..."
                                rows={3}
                            />
                        </div>

                        <div className="grid gap-1.5">
                            <Label htmlFor="group-order" className="text-sm font-medium text-gray-700">
                                Thứ tự hiển thị
                            </Label>
                            <Input
                                id="group-order"
                                type="number"
                                min={1}
                                value={displayOrder}
                                onChange={(e) => setDisplayOrder(parseInt(e.target.value, 10) || 1)}
                            />
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            className="cursor-pointer"
                        >
                            Hủy
                        </Button>
                        <Button
                            type="submit"
                            className="bg-orange-500 hover:bg-orange-600 text-white cursor-pointer"
                        >
                            {isEdit ? "Cập nhật" : "Lưu"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};
