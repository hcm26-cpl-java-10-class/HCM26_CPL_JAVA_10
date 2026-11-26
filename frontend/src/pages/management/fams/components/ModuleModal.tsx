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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import type { ModuleGroupItem, ModuleItem, ModuleFormData } from "../types";

interface ModuleModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    groups: ModuleGroupItem[];
    defaultGroupId?: string;
    initialData?: ModuleItem | null;
    onSubmit: (data: ModuleFormData) => void;
}

export const ModuleModal: React.FC<ModuleModalProps> = ({
    open,
    onOpenChange,
    groups,
    defaultGroupId,
    initialData,
    onSubmit,
}) => {
    const isEdit = Boolean(initialData);

    const [groupId, setGroupId] = useState("");
    const [code, setCode] = useState("");
    const [name, setName] = useState("");
    const [url, setUrl] = useState("");
    const [linkInfo, setLinkInfo] = useState("");
    const [status, setStatus] = useState<"Active" | "Inactive">("Active");
    const [errors, setErrors] = useState<{
        groupId?: string;
        code?: string;
        name?: string;
        url?: string;
    }>({});

    useEffect(() => {
        if (open) {
            if (initialData) {
                setGroupId(initialData.groupId || defaultGroupId || groups[0]?.id || "");
                setCode(initialData.code || "");
                setName(initialData.name || "");
                setUrl(initialData.url || "");
                setLinkInfo(initialData.linkInfo || "");
                setStatus(initialData.status || "Active");
            } else {
                setGroupId(defaultGroupId || groups[0]?.id || "");
                setCode("");
                setName("");
                setUrl("");
                setLinkInfo("");
                setStatus("Active");
            }
            setErrors({});
        }
    }, [open, initialData, defaultGroupId, groups]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const newErrors: typeof errors = {};
        if (!groupId) newErrors.groupId = "Vui lòng chọn nhóm module";
        if (!code.trim()) newErrors.code = "Mã module không được để trống";
        if (!name.trim()) newErrors.name = "Tên module không được để trống";
        if (!url.trim()) newErrors.url = "URL không được để trống";

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        onSubmit({
            groupId,
            code: code.trim().toUpperCase(),
            name: name.trim(),
            url: url.trim(),
            linkInfo: linkInfo.trim() || "-",
            status,
        });

        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[540px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            {isEdit ? "Chỉnh sửa Module" : "Thêm mới Module"}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="grid gap-1.5">
                            <Label htmlFor="module-group" className="text-sm font-medium text-gray-700">
                                Nhóm Module <span className="text-red-500">*</span>
                            </Label>
                            <Select value={groupId} onValueChange={(val) => {
                                setGroupId(val);
                                if (errors.groupId) setErrors((prev) => ({ ...prev, groupId: undefined }));
                            }}>
                                <SelectTrigger id="module-group" className="w-full">
                                    <SelectValue placeholder="Chọn nhóm module" />
                                </SelectTrigger>
                                <SelectContent>
                                    {groups.map((group) => (
                                        <SelectItem key={group.id} value={group.id}>
                                            {group.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {errors.groupId && (
                                <p className="text-xs text-red-500 font-medium">{errors.groupId}</p>
                            )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="grid gap-1.5">
                                <Label htmlFor="module-code" className="text-sm font-medium text-gray-700">
                                    Mã Module <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="module-code"
                                    value={code}
                                    onChange={(e) => {
                                        setCode(e.target.value);
                                        if (errors.code) setErrors((prev) => ({ ...prev, code: undefined }));
                                    }}
                                    placeholder="ví dụ: IT-HN, JAVA"
                                    className={errors.code ? "border-red-500 focus-visible:ring-red-500 uppercase" : "uppercase"}
                                />
                                {errors.code && (
                                    <p className="text-xs text-red-500 font-medium">{errors.code}</p>
                                )}
                            </div>

                            <div className="grid gap-1.5">
                                <Label htmlFor="module-status" className="text-sm font-medium text-gray-700">
                                    Trạng thái <span className="text-red-500">*</span>
                                </Label>
                                <Select value={status} onValueChange={(val) => setStatus(val as "Active" | "Inactive")}>
                                    <SelectTrigger id="module-status" className="w-full">
                                        <SelectValue placeholder="Chọn trạng thái" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Active">Active</SelectItem>
                                        <SelectItem value="Inactive">Inactive</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid gap-1.5">
                            <Label htmlFor="module-name" className="text-sm font-medium text-gray-700">
                                Tên Module <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="module-name"
                                value={name}
                                onChange={(e) => {
                                    setName(e.target.value);
                                    if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
                                }}
                                placeholder="ví dụ: Information Technology"
                                className={errors.name ? "border-red-500 focus-visible:ring-red-500" : ""}
                            />
                            {errors.name && (
                                <p className="text-xs text-red-500 font-medium">{errors.name}</p>
                            )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="grid gap-1.5">
                                <Label htmlFor="module-url" className="text-sm font-medium text-gray-700">
                                    URL / Phân hệ <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="module-url"
                                    value={url}
                                    onChange={(e) => {
                                        setUrl(e.target.value);
                                        if (errors.url) setErrors((prev) => ({ ...prev, url: undefined }));
                                    }}
                                    placeholder="ví dụ: Hòa Lạc hoặc /fams/module"
                                    className={errors.url ? "border-red-500 focus-visible:ring-red-500" : ""}
                                />
                                {errors.url && (
                                    <p className="text-xs text-red-500 font-medium">{errors.url}</p>
                                )}
                            </div>

                            <div className="grid gap-1.5">
                                <Label htmlFor="module-link" className="text-sm font-medium text-gray-700">
                                    Liên kết / Thống kê
                                </Label>
                                <Input
                                    id="module-link"
                                    value={linkInfo}
                                    onChange={(e) => setLinkInfo(e.target.value)}
                                    placeholder="ví dụ: 128 users, 12 topics"
                                />
                            </div>
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
