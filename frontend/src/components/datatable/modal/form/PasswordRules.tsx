import { Check, Circle } from "lucide-react";
import { PASSWORD_RULES } from "@/utils/password.utils";

interface PasswordRulesProps {
  value: string;
}

/** Live checklist: every rule turns green as soon as the typed password satisfies it. */
export function PasswordRules({ value }: PasswordRulesProps) {
  const password = value ?? "";

  return (
    <ul className="grid gap-1 rounded-md border bg-muted/30 p-2.5 text-xs sm:grid-cols-2">
      {PASSWORD_RULES.map((rule) => {
        const ok = password.length > 0 && rule.test(password);
        return (
          <li
            key={rule.id}
            className={`flex items-center gap-1.5 ${
              ok ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
            }`}
          >
            {ok ? (
              <Check className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <Circle className="h-3 w-3 shrink-0" />
            )}
            {rule.label}
          </li>
        );
      })}
    </ul>
  );
}
