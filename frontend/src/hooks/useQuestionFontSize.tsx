// Font size of the question text on the main exam page (remembered on this device).
import { useCallback, useState } from 'react';
import { Minus, Plus } from 'lucide-react';

const KEY = 'exam-question-font-size';
export const MIN_FONT = 12;
export const MAX_FONT = 32;
export const DEFAULT_FONT = 16;

const read = (): number => {
    try {
        const v = Number(localStorage.getItem(KEY));
        return v >= MIN_FONT && v <= MAX_FONT ? v : DEFAULT_FONT;
    } catch {
        return DEFAULT_FONT;
    }
};

export function useQuestionFontSize() {
    const [size, setSize] = useState<number>(read);
    const update = useCallback((next: number) => {
        const v = Math.min(MAX_FONT, Math.max(MIN_FONT, next));
        setSize(v);
        try { localStorage.setItem(KEY, String(v)); } catch { /* storage unavailable */ }
    }, []);
    return {
        size,
        style: { fontSize: `${size}px` } as const,
        inc: () => update(size + 2),
        dec: () => update(size - 2),
        reset: () => update(DEFAULT_FONT),
    };
}

export function FontSizeControl({ font }: { font: ReturnType<typeof useQuestionFontSize> }) {
    const btn = 'inline-flex size-7 items-center justify-center rounded border bg-background hover:bg-muted disabled:opacity-40';
    return (
        <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
            <span>Text size</span>
            <button type="button" className={btn} onClick={font.dec} disabled={font.size <= MIN_FONT} aria-label="Decrease text size">
                <Minus className="size-4" />
            </button>
            <button type="button" className="min-w-12 text-center tabular-nums hover:underline" onClick={font.reset} title="Reset to default">
                {Math.round((font.size / DEFAULT_FONT) * 100)}%
            </button>
            <button type="button" className={btn} onClick={font.inc} disabled={font.size >= MAX_FONT} aria-label="Increase text size">
                <Plus className="size-4" />
            </button>
        </div>
    );
}
