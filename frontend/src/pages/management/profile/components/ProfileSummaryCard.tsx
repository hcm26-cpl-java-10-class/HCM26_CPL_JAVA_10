import React from "react";
import { Badge } from "@/components/ui/badge";
import type { UserProfileData } from "../types";

interface ProfileSummaryCardProps {
  profile: UserProfileData;
}

export const ProfileSummaryCard: React.FC<ProfileSummaryCardProps> = ({ profile }) => {
  return (
    <div className="bg-white dark:bg-card rounded-xl border border-gray-100 dark:border-border shadow-xs p-6 transition-all">
      <div className="flex items-center gap-5">
        {/* Avatar with initials or photo */}
        <div className="relative">
          <div className="size-16 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold text-xl flex items-center justify-center tracking-wider select-none shadow-xs border border-blue-200/60 dark:border-blue-900/50">
            {profile.initials || "TA"}
          </div>
        </div>

        {/* Identity Details */}
        <div className="flex flex-col gap-1.5">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {profile.fullName}
          </h2>

          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
            {profile.role} · {profile.department}
          </div>

          <div className="mt-0.5">
            <Badge
              variant="secondary"
              className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/60 font-medium px-2.5 py-0.5 rounded-full text-xs"
            >
              <span className="size-1.5 rounded-full bg-emerald-500 mr-1 inline-block" />
              {profile.status}
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
};
