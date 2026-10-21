import React from "react";
import { Button } from "@/components/ui/button";
import { KeyRound, UserCheck } from "lucide-react";

interface ProfileHeaderProps {
  isEditing: boolean;
  onOpenChangePassword: () => void;
  onTriggerUpdateProfile: () => void;
}

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  isEditing,
  onOpenChangePassword,
  onTriggerUpdateProfile,
}) => {
  return (
    <div className="flex flex-col gap-4 pb-6">
      {/* Breadcrumb matching SCR-27 screenshot */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="hover:text-foreground transition-colors">FAMS & LMS</span>
        <span>/</span>
        <span className="hover:text-foreground transition-colors">Identity</span>
        <span>/</span>
        <span className="text-foreground font-medium">Personal Profile & Password</span>
      </nav>

      {/* Title & Actions Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Personal Profile & Password
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage your personal information and account security.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onOpenChangePassword}
            className="bg-white hover:bg-gray-50 border-gray-200 text-gray-700 dark:bg-card dark:text-gray-200 dark:border-border dark:hover:bg-muted shadow-xs transition-colors cursor-pointer"
          >
            <KeyRound className="h-4 w-4 mr-1 text-gray-500" />
            Change Password
          </Button>

          <Button
            type="button"
            onClick={onTriggerUpdateProfile}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-xs transition-colors cursor-pointer"
          >
            <UserCheck className="h-4 w-4 mr-1" />
            {isEditing ? "Editing Profile..." : "Update Profile"}
          </Button>
        </div>
      </div>
    </div>
  );
};
