import React, { useState } from "react";
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

export const AccountSecurityCard: React.FC<AccountSecurityCardProps> = ({ profile }) => {
  const [showSessionModal, setShowSessionModal] = useState(false);

  return (
    <>
      <div className="bg-white dark:bg-card rounded-xl border border-gray-100 dark:border-border shadow-xs p-6 flex flex-col justify-between transition-all">
        <div>
          <div className="flex items-center gap-2 pb-4 border-b border-gray-100 dark:border-border mb-4">
            <Shield className="size-4 text-orange-500" />
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
                {profile.lastLogin}
              </div>
            </div>

            {/* Device */}
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                <Monitor className="size-3.5 text-gray-400" />
                Device
              </div>
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 pl-5">
                {profile.device}
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
            <div className="flex items-center gap-2 text-orange-600">
              <ShieldAlert className="size-5" />
              <DialogTitle>Session Management</DialogTitle>
            </div>
            <DialogDescription className="text-left pt-2 space-y-2">
              <p>
                Multi-device session revocation is currently scheduled for an upcoming system release.
              </p>
              <div className="rounded-lg bg-gray-50 dark:bg-muted/40 p-3 border border-gray-200/60 dark:border-border text-xs text-gray-600 dark:text-gray-300">
                <span className="font-semibold text-gray-800 dark:text-gray-100">Current active session:</span>{" "}
                {profile.device} (Authenticated)
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
