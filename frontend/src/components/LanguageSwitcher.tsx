import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { SUPPORTED_LANGUAGES, type Language } from "@/i18n/translator";
import { Check, Languages } from "lucide-react";
import { useTranslation } from "react-i18next";

/** Switches the language of the whole system (placed next to the notification bell). */
export function LanguageSwitcher({ className }: { className?: string }) {
  const { t, i18n } = useTranslation();
  const current = SUPPORTED_LANGUAGES.find((language) => language.code === i18n.language)
    ?? SUPPORTED_LANGUAGES[0];

  const select = (code: Language) => {
    if (code !== i18n.language) {
      void i18n.changeLanguage(code);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          title={t("Change language")}
          aria-label={t("Change language")}
          className={cn("relative rounded-full border-border/70 focus-visible:ring-1", className)}
        >
          <Languages className="size-[1.1rem]" />
          <span
            data-no-translate
            className="absolute -right-1 -bottom-1 rounded-full border border-border bg-background px-1 text-[9px] font-semibold leading-4 text-muted-foreground"
          >
            {current.shortLabel}
          </span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-40 rounded-xl p-1.5" data-no-translate>
        {SUPPORTED_LANGUAGES.map((language) => (
          <DropdownMenuItem
            key={language.code}
            onSelect={() => select(language.code)}
            className={cn("gap-2 rounded-lg px-2 py-2 cursor-pointer", language.code === current.code && "bg-accent")}
          >
            <span className="w-6 text-xs font-semibold text-muted-foreground">{language.shortLabel}</span>
            <span className="flex-1 font-medium">{language.label}</span>
            {language.code === current.code && <Check className="size-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default LanguageSwitcher;
