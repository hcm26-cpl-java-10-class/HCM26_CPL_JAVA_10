import { Building2, Check, ChevronDown, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { GitInstallation } from "@/types/features/git-integration";

/** Picks which connected GitHub account/organization to browse; a plain label when there is only one. */
export function InstallationSwitcher({ installations, selectedId, onSelect }: {
  installations: GitInstallation[];
  selectedId: number;
  onSelect: (id: number) => void;
}) {
  const selected = installations.find(item => item.id === selectedId);
  if (!selected) return null;
  const Icon = selected.accountType === "Organization" ? Building2 : User;
  const label = <>
    <Icon className="size-3.5 text-muted-foreground" aria-hidden="true" />
    <span className="font-medium">{selected.accountLogin}</span>
    <span className="text-muted-foreground">· {selected.accountType === "Organization" ? "Organization" : "Personal account"}</span>
  </>;

  if (installations.length < 2) {
    return <p className="flex items-center gap-1.5 text-xs">{label}</p>;
  }
  return <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="outline" size="sm" className="h-8 w-fit gap-1.5 self-start text-xs" aria-label="Choose GitHub account">
        {label}<ChevronDown className="size-3.5" aria-hidden="true" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" className="min-w-56">
      <DropdownMenuLabel className="text-xs">Connected GitHub accounts</DropdownMenuLabel>
      {installations.map(item => <DropdownMenuItem key={item.id} onSelect={() => onSelect(item.id)} className="gap-2 text-xs">
        {item.accountType === "Organization" ? <Building2 className="size-3.5" /> : <User className="size-3.5" />}
        <span className="flex-1">{item.accountLogin}</span>
        {item.id === selectedId && <Check className="size-3.5" aria-hidden="true" />}
      </DropdownMenuItem>)}
    </DropdownMenuContent>
  </DropdownMenu>;
}
