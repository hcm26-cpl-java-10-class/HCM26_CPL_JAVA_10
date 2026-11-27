import { Languages, LoaderCircle } from "lucide-react";
import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
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
    const { i18n } = useTranslation();
    const language = params.get("lang") === "vi" ? "vi" : "en";

    // Đồng bộ URL param khi global language thay đổi (ví dụ user đổi ngôn ngữ ở LanguageSwitcher).
    useEffect(() => {
        const globalLang = i18n.language;
        const syllabusLang: SyllabusLanguage = globalLang === "vi" ? "vi" : "en";
        if (syllabusLang !== language) {
            const next = new URLSearchParams(params);
            if (syllabusLang === "vi") next.set("lang", "vi");
            else next.delete("lang");
            setParams(next, { replace: true });
        }
        // Chỉ chạy khi global language thay đổi, không phụ thuộc vào language/params
        // để tránh vòng lặp.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [i18n.language]);

    const handleChange = (value: string) => {
        const next = new URLSearchParams(params);
        if (value === "vi") next.set("lang", "vi");
        else next.delete("lang");
        setParams(next, { replace: true });
        // Cập nhật global i18n để LanguageSwitcher và DomTranslator cũng phản ánh ngôn ngữ mới.
        if (value === "en" || value === "vi") {
            void i18n.changeLanguage(value);
        }
    };

    return (
        <div className="flex shrink-0 items-center gap-2">
            {loading && <LoaderCircle className="size-4 animate-spin text-muted-foreground" aria-label="Translating" />}
            <Languages className="hidden size-4 text-muted-foreground sm:block" aria-hidden="true" />
            <Select value={language} onValueChange={handleChange}>
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
