import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import { useEffect, useState } from "react";

type Props = {
    /** Từ khóa đang áp dụng (đã xác nhận). */
    value: string;
    /** Gọi khi người dùng bấm nút Search hoặc nhấn Enter. */
    onSearch: (term: string) => void;
    placeholder?: string;
    className?: string;
};

/**
 * Ô tìm kiếm có nút Search.
 *
 * <p>Gõ từ khóa rồi bấm nút "Search" (hoặc nhấn Enter) để áp dụng bộ lọc.
 * Có nút "X" để xoá nhanh.
 */
export function TableSearchBox({
    value,
    onSearch,
    placeholder = "Search...",
    className,
}: Props) {
    const [draft, setDraft] = useState(value);

    // Đồng bộ khi giá trị bên ngoài thay đổi (ví dụ sau khi xoá bộ lọc).
    useEffect(() => {
        setDraft(value);
    }, [value]);

    const submit = () => onSearch(draft.trim());

    return (
        <div className={`flex items-center gap-2 ${className ?? ""}`}>
            <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === "Enter") {
                            event.preventDefault();
                            submit();
                        }
                    }}
                    placeholder={placeholder}
                    className="h-8 w-full max-w-xs pl-8 pr-8 text-xs"
                    aria-label="Search"
                />
                {draft ? (
                    <button
                        type="button"
                        onClick={() => {
                            setDraft("");
                            onSearch("");
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                        aria-label="Clear search"
                    >
                        <X className="size-3.5" />
                    </button>
                ) : null}
            </div>

            <Button size="sm" variant="outline" className="h-8 gap-1.5 px-3 text-xs" onClick={submit}>
                <Search className="size-3.5" />
                Search
            </Button>
        </div>
    );
}
