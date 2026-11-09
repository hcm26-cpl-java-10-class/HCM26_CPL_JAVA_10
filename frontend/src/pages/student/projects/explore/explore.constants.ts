import type { LucideIcon } from "lucide-react";
import {
  Building2,
  HeartPulse,
  Layers,
  Leaf,
  ShoppingBag,
  Truck,
  Wallet,
} from "lucide-react";
import type { ProjectTemplateLevel } from "@/types";

export type LevelFilter = ProjectTemplateLevel | "ALL";
export type DurationFilter = "ALL" | "SHORT" | "MEDIUM" | "LONG";

export interface SelectOption<TValue extends string> {
  value: TValue;
  label: string;
}

export const LEVEL_META: Record<
  ProjectTemplateLevel,
  { label: string; badgeClass: string; dotClass: string }
> = {
  BEGINNER: {
    label: "Beginner",
    badgeClass: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    dotClass: "bg-emerald-500",
  },
  INTERMEDIATE: {
    label: "Intermediate",
    badgeClass: "bg-sky-50 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
    dotClass: "bg-sky-500",
  },
  ADVANCED: {
    label: "Advanced",
    badgeClass: "bg-violet-50 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
    dotClass: "bg-violet-500",
  },
};

export const LEVEL_OPTIONS: SelectOption<LevelFilter>[] = [
  { value: "ALL", label: "All levels" },
  { value: "BEGINNER", label: "Beginner" },
  { value: "INTERMEDIATE", label: "Intermediate" },
  { value: "ADVANCED", label: "Advanced" },
];

export const DURATION_OPTIONS: SelectOption<DurationFilter>[] = [
  { value: "ALL", label: "All durations" },
  { value: "SHORT", label: "4–6 weeks" },
  { value: "MEDIUM", label: "8–10 weeks" },
  { value: "LONG", label: "12+ weeks" },
];

export const matchesDuration = (durationWeeks: number, filter: DurationFilter): boolean => {
  switch (filter) {
    case "SHORT":
      return durationWeeks >= 4 && durationWeeks <= 6;
    case "MEDIUM":
      return durationWeeks >= 8 && durationWeeks <= 10;
    case "LONG":
      return durationWeeks >= 12;
    case "ALL":
    default:
      return true;
  }
};

const DOMAIN_ICONS: Record<string, LucideIcon> = {
  Education: Building2,
  Logistics: Truck,
  Fintech: Wallet,
  Healthcare: HeartPulse,
  "E-commerce": ShoppingBag,
  Sustainability: Leaf,
};

export const resolveDomainIcon = (domain: string): LucideIcon =>
  DOMAIN_ICONS[domain] ?? Layers;

/** "4–5 members" (or "4 members" when min === max). */
export const formatGroupSize = (minMembers: number, maxMembers: number): string =>
  minMembers === maxMembers
    ? `${minMembers} ${minMembers === 1 ? "member" : "members"}`
    : `${minMembers}–${maxMembers} members`;

/** "1–3" (or "2" when the quota is fixed). */
export const formatQuota = (min: number, max: number): string =>
  min === max ? String(min) : `${min}–${max}`;

export const formatMilestoneWeek = (offsetWeeks: number): string =>
  `Week ${offsetWeeks}`;
