import { GraduationCap } from "lucide-react";
import { useState } from "react";

export function CourseThumbnail({ src }: { src?: string | null }) {
    const [failedSrc, setFailedSrc] = useState<string | null>(null);
    return (
        <div className="h-44 overflow-hidden bg-gradient-to-br from-blue-100 via-indigo-100 to-violet-100">
            {src && src !== failedSrc ? (
                <img src={src} alt="" className="h-full w-full object-cover" onError={() => setFailedSrc(src)} />
            ) : (
                <div className="flex h-full items-center justify-center">
                    <GraduationCap className="size-16 text-blue-900/25" />
                </div>
            )}
        </div>
    );
}
