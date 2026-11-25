import { Languages, LoaderCircle } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export type SyllabusLanguage = "en" | "vi";

/** Keep the selected language in the URL, including across refresh and browser history. */
export function useSyllabusLanguage(): SyllabusLanguage {
    const [params] = useSearchParams();
    return params.get("lang") === "vi" ? "vi" : "en";
}

export function translatedSyllabusLink(path: string, language: SyllabusLanguage) {
    return language === "vi" ? `${path}${path.includes("?") ? "&" : "?"}lang=vi` : path;
}

export function SyllabusLanguageSwitcher({ loading = false }: { loading?: boolean }) {
    const [params, setParams] = useSearchParams();
    const language = params.get("lang") === "vi" ? "vi" : "en";
    return (
        <div className="flex shrink-0 items-center gap-2">
            {loading && <LoaderCircle className="size-4 animate-spin text-muted-foreground" aria-label="Translating" />}
            <Languages className="hidden size-4 text-muted-foreground sm:block" aria-hidden="true" />
            <Select value={language} onValueChange={(value) => {
                const next = new URLSearchParams(params);
                if (value === "vi") next.set("lang", "vi");
                else next.delete("lang");
                setParams(next, { replace: true });
            }}>
                <SelectTrigger className="h-8 w-[128px] bg-background text-xs sm:w-[148px]" aria-label="Translate syllabus content">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent align="end">
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="vi">Tiếng Việt</SelectItem>
                </SelectContent>
            </Select>
        </div>
    );
}
