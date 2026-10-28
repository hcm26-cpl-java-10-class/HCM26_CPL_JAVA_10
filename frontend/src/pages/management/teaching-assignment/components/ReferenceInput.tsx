import { useState, type ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { resolveText, textMatches, type TextOption } from "../assignment-text";

type Props = Omit<ComponentProps<typeof Input>, "value" | "onChange"> & {
  value: string;
  onChange: (value: string) => void;
  options: TextOption[];
};

/** Plain text input: typing a unique code/name/email/ID is sufficient; there is no dropdown. */
export function ReferenceInput({ value, onChange, options, ...props }: Props) {
  const matches = textMatches(value, options);
  const hintId = `${props.id}-hint`;
  const examples = (value.trim() ? matches : options).slice(0, 3);
  return <div className="space-y-1">
    <Input {...props} type="text" maxLength={200} autoComplete="off" value={value} onChange={(event) => onChange(event.target.value)}
      aria-describedby={[props["aria-describedby"], !props.readOnly && !props.disabled ? hintId : undefined].filter(Boolean).join(" ") || undefined} />
    {!props.readOnly && !props.disabled && <p id={hintId} className="text-xs text-muted-foreground">
      {value.trim() && matches.length === 1 ? `Matched: ${matches[0].label}`
        : value.trim() && !matches.length ? "No match. Check the name, code or email."
          : `${value.trim() ? "Matches" : "Examples"}: ${examples.map((option) => option.label).join("; ")}${matches.length > 3 ? "; …" : ""}${value.trim() && matches.length > 1 ? ". Enter the full name, code or email to identify one record." : ""}`}
    </p>}
  </div>;
}

/** Filter text stays local until Enter/blur; only a resolved value reaches the URL/API. */
export function AppliedTextInput({ value, options, onCommit, allowEmpty = true, ...props }:
  Omit<ComponentProps<typeof Input>, "value" | "onChange"> & {
    value: string; options: TextOption[]; onCommit: (value: string) => void; allowEmpty?: boolean;
  }) {
  const [draft, setDraft] = useState<string>();
  const [error, setError] = useState("");
  const text = draft ?? options.find((option) => option.value === value)?.label ?? value;
  function commit() {
    if (draft === undefined) return;
    if (draft.length > 200) { setError("Enter at most 200 characters."); return; }
    const next = !draft.trim() && allowEmpty ? "" : resolveText(draft, options);
    if (next === undefined) { setError("Enter a full name, code or email to identify one record."); return; }
    onCommit(next); setDraft(undefined); setError("");
  }
  return <div className="space-y-1"><Input {...props} value={text} maxLength={200} autoComplete="off" aria-invalid={Boolean(error)}
    aria-describedby={error ? `${props.id}-error` : undefined}
    onChange={(event) => { setDraft(event.target.value); setError(""); }} onBlur={commit}
    onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); commit(); } else if (event.key === "Escape") { setDraft(undefined); setError(""); } }} />
    {error && <p id={`${props.id}-error`} role="alert" className="text-xs text-destructive">{error}</p>}
  </div>;
}

export function AppliedNumberInput({ value, onCommit, ...props }: Omit<ComponentProps<typeof Input>, "value" | "onChange"> & {
  value: number; onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string>();
  const [error, setError] = useState(false);
  function commit() {
    if (draft === undefined) return;
    const number = Number(draft);
    if (!/^\d+$/.test(draft) || number < 1 || number > 100) { setError(true); return; }
    onCommit(number); setDraft(undefined); setError(false);
  }
  return <div className="space-y-1"><Input {...props} type="number" min={1} max={100} step={1} value={draft ?? String(value)}
    aria-invalid={error} aria-describedby={error ? `${props.id}-error` : undefined}
    onChange={(event) => { setDraft(event.target.value); setError(false); }} onBlur={commit}
    onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); commit(); } }} />
    {error && <p id={`${props.id}-error`} role="alert" className="text-xs text-destructive">Enter a whole number from 1 to 100.</p>}
  </div>;
}
