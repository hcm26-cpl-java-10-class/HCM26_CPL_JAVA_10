import { uploadImage } from "@/api/upload.api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

interface ImageUrlFieldProps {
    value: string;
    onChange: (url: string) => void;
    placeholder?: string;
    className?: string;
}

export function ImageUrlField({ value, onChange, placeholder, className }: ImageUrlFieldProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);

    const handleFile = async (file: File | undefined) => {
        if (!file) return;
        if (!ALLOWED_TYPES.includes(file.type)) {
            toast.error("Only PNG, JPEG, GIF or WebP images are allowed.");
            return;
        }
        if (file.size > MAX_BYTES) {
            toast.error("Image must be 2 MB or smaller.");
            return;
        }
        setUploading(true);
        try {
            onChange(await uploadImage(file));
            toast.success("Image uploaded.");
        } catch (error: any) {
            toast.error(error?.response?.data?.message || "Could not upload the image.");
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    return (
        <div className={`flex items-center gap-2 ${className ?? ""}`}>
            <Input
                className="flex-1"
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
            />
            <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                className="hidden"
                onChange={(event) => void handleFile(event.target.files?.[0])}
            />
            <Button
                type="button"
                variant="outline"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
            >
                {uploading ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                    <Upload className="mr-1 h-4 w-4" />
                )}
                Upload image
            </Button>
        </div>
    );
}