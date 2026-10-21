import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Shield, ShieldAlert, Monitor, Clock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import type { UserProfileData } from "../types";

interface AccountSecurityCardProps {
  profile: UserProfileData;
}

const formatAbsoluteDateTime = (dateStr: string | null | undefined): string | null => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(d);
};

const computeRelativeTime = (dateStr: string | null | undefined): string => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";

  const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);

  if (diffSec < 0 || diffSec < 45) return "Just now";
  if (diffSec < 90) return "1 minute ago";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} minutes ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return diffHour === 1 ? "1 hour ago" : `${diffHour} hours ago`;
  const diffDays = Math.floor(diffHour / 24);
  if (diffDays < 30) return diffDays === 1 ? "1 day ago" : `${diffDays} days ago`;
  return "";
};

export const AccountSecurityCard: React.FC<AccountSecurityCardProps> = ({ profile }) => {
  const [showSessionModal, setShowSessionModal] = useState(false);

  const rawLastLogin = profile.lastLoginAt || profile.lastLogin;
  const formattedLastLogin = formatAbsoluteDateTime(rawLastLogin);

  const [relativeTime, setRelativeTime] = useState<string>(() =>
    computeRelativeTime(rawLastLogin)
  );

  useEffect(() => {
    setRelativeTime(computeRelativeTime(rawLastLogin));
    if (!rawLastLogin) return;

    const timer = setInterval(() => {
      setRelativeTime(computeRelativeTime(rawLastLogin));
    }, 30000);

    return () => clearInterval(timer);
  }, [rawLastLogin]);

  return (
    <>
      <div className="bg-white dark:bg-card rounded-xl border border-gray-100 dark:border-border shadow-xs p-6 flex flex-col justify-between transition-all">
        <div>
          <div className="flex items-center gap-2 pb-4 border-b border-gray-100 dark:border-border mb-4">
            <Shield className="size-4 text-blue-600 dark:text-blue-400" />
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
              Account Security
            </h3>
          </div>

          <div className="space-y-4">
            {/* Last Login */}
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                <Clock className="size-3.5 text-gray-400" />
                Last Login
              </div>
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 pl-5">
                {formattedLastLogin ? (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                    <span>{formattedLastLogin}</span>
                    {relativeTime && (
                      <span className="text-xs font-normal text-muted-foreground">
                        ({relativeTime})
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-xs font-normal text-muted-foreground italic">
                    Not available
                  </span>
                )}
              </div>
            </div>

            {/* Device */}
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                <Monitor className="size-3.5 text-gray-400" />
                Device
              </div>
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 pl-5">
                {profile.device || (
                  <span className="text-xs font-normal text-muted-foreground italic">
                    Not available
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Manage Sessions Action */}
        <div className="pt-6 mt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowSessionModal(true)}
            className="w-full bg-white hover:bg-gray-50 text-gray-700 dark:bg-card dark:text-gray-200 dark:border-border dark:hover:bg-muted shadow-xs transition-colors cursor-pointer text-sm font-medium"
          >
            Manage Sessions
          </Button>
        </div>
      </div>

      {/* Session Management Placeholder Modal */}
      <Dialog open={showSessionModal} onOpenChange={setShowSessionModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
              <ShieldAlert className="size-5" />
              <DialogTitle>Session Management</DialogTitle>
            </div>
            <DialogDescription className="text-left pt-2 space-y-2">
              <p>
                Multi-device session revocation is currently scheduled for an upcoming system release.
              </p>
              <div className="rounded-lg bg-gray-50 dark:bg-muted/40 p-3 border border-gray-200/60 dark:border-border text-xs text-gray-600 dark:text-gray-300">
                <span className="font-semibold text-gray-800 dark:text-gray-100">Current active session:</span>{" "}
                {profile.device || "Current browser session"} (Authenticated)
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowSessionModal(false)}
              className="cursor-pointer"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
