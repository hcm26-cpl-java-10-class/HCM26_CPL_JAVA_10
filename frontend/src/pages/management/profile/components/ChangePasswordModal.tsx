import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Lock, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { profileApi } from "@/api/features/profile.api";
import type { ChangePasswordValues, PasswordFormErrors } from "../types";

interface ChangePasswordModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  open,
  onOpenChange,
}) => {
  const [formValues, setFormValues] = useState<ChangePasswordValues>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [errors, setErrors] = useState<PasswordFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Criteria checks for new password
  const hasMinLength = formValues.newPassword.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(formValues.newPassword);
  const hasNumber = /[0-9]/.test(formValues.newPassword);
  const passwordsMatch =
    formValues.newPassword.length > 0 &&
    formValues.newPassword === formValues.confirmPassword;

  const resetForm = () => {
    setFormValues({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
    setErrors({});
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const validate = (): boolean => {
    const newErrors: PasswordFormErrors = {};

    if (!formValues.currentPassword) {
      newErrors.currentPassword = "Current password is required.";
    }

    if (!formValues.newPassword) {
      newErrors.newPassword = "New password is required.";
    } else if (!hasMinLength || !hasLetter || !hasNumber) {
      newErrors.newPassword = "Password must be at least 8 characters and include both letters and numbers.";
    } else if (formValues.newPassword === formValues.currentPassword) {
      newErrors.newPassword = "New password must be different from current password.";
    }

    if (!formValues.confirmPassword) {
      newErrors.confirmPassword = "Confirm password is required.";
    } else if (formValues.newPassword !== formValues.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      setIsSubmitting(true);
      await profileApi.changePassword({
        currentPassword: formValues.currentPassword,
        newPassword: formValues.newPassword,
        confirmNewPassword: formValues.confirmPassword,
      });

      toast.success("Password updated successfully!", {
        description: "Your account password has been changed.",
      });

      handleClose();
    } catch (err: any) {
      const serverMsg =
        err?.response?.data?.message ||
        (err?.response?.data?.errors
          ? Object.values(err.response.data.errors).flat().join(", ")
          : null) ||
        "Failed to update password. Please check your credentials.";

      if (serverMsg.toLowerCase().includes("current password")) {
        setErrors((prev) => ({ ...prev, currentPassword: serverMsg }));
      } else if (serverMsg.toLowerCase().includes("new password")) {
        setErrors((prev) => ({ ...prev, newPassword: serverMsg }));
      } else {
        toast.error("Password update failed", { description: serverMsg });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => (!isSubmitting ? onOpenChange(val) : null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
            <Lock className="size-5" />
            <DialogTitle className="text-lg font-bold">Change Password</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground pt-1">
            Choose a secure password with at least 8 characters, containing both letters and numbers.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* 1. Current Password */}
          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor="currentPassword"
              className="text-xs font-semibold text-gray-700 dark:text-gray-300"
            >
              Current Password <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Input
                id="currentPassword"
                name="currentPassword"
                type={showCurrentPassword ? "text" : "password"}
                autoComplete="current-password"
                disabled={isSubmitting}
                value={formValues.currentPassword}
                onChange={(e) => {
                  setFormValues((prev) => ({ ...prev, currentPassword: e.target.value }));
                  if (errors.currentPassword) {
                    setErrors((prev) => ({ ...prev, currentPassword: undefined }));
                  }
                }}
                className={`pr-10 ${
                  errors.currentPassword
                    ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                    : ""
                }`}
                placeholder="Enter current password"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                aria-label={showCurrentPassword ? "Hide password" : "Show password"}
              >
                {showCurrentPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {errors.currentPassword && (
              <p className="text-xs text-red-500 mt-0.5">{errors.currentPassword}</p>
            )}
          </div>

          {/* 2. New Password */}
          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor="newPassword"
              className="text-xs font-semibold text-gray-700 dark:text-gray-300"
            >
              New Password <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Input
                id="newPassword"
                name="newPassword"
                type={showNewPassword ? "text" : "password"}
                autoComplete="new-password"
                disabled={isSubmitting}
                value={formValues.newPassword}
                onChange={(e) => {
                  setFormValues((prev) => ({ ...prev, newPassword: e.target.value }));
                  if (errors.newPassword) {
                    setErrors((prev) => ({ ...prev, newPassword: undefined }));
                  }
                }}
                className={`pr-10 ${
                  errors.newPassword
                    ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                    : ""
                }`}
                placeholder="Enter new password"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                aria-label={showNewPassword ? "Hide password" : "Show password"}
              >
                {showNewPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {errors.newPassword && (
              <p className="text-xs text-red-500 mt-0.5">{errors.newPassword}</p>
            )}

            {/* Password strength/rules feedback indicators */}
            <div className="mt-1 space-y-1 rounded-md bg-gray-50 dark:bg-muted/30 p-2.5 border border-gray-100 dark:border-border text-[11px]">
              <div className="flex items-center gap-1.5">
                {hasMinLength ? (
                  <CheckCircle2 className="size-3.5 text-emerald-600" />
                ) : (
                  <XCircle className="size-3.5 text-gray-400" />
                )}
                <span className={hasMinLength ? "text-emerald-700 font-medium" : "text-gray-500"}>
                  At least 8 characters
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {hasLetter && hasNumber ? (
                  <CheckCircle2 className="size-3.5 text-emerald-600" />
                ) : (
                  <XCircle className="size-3.5 text-gray-400" />
                )}
                <span
                  className={
                    hasLetter && hasNumber ? "text-emerald-700 font-medium" : "text-gray-500"
                  }
                >
                  Contains at least one letter and one number
                </span>
              </div>
            </div>
          </div>

          {/* 3. Confirm New Password */}
          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor="confirmPassword"
              className="text-xs font-semibold text-gray-700 dark:text-gray-300"
            >
              Confirm New Password <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                disabled={isSubmitting}
                value={formValues.confirmPassword}
                onChange={(e) => {
                  setFormValues((prev) => ({ ...prev, confirmPassword: e.target.value }));
                  if (errors.confirmPassword) {
                    setErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                  }
                }}
                className={`pr-10 ${
                  errors.confirmPassword
                    ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                    : ""
                }`}
                placeholder="Confirm your new password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              >
                {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="text-xs text-red-500 mt-0.5">{errors.confirmPassword}</p>
            )}
            {formValues.confirmPassword && passwordsMatch && !errors.confirmPassword && (
              <p className="text-xs text-emerald-600 flex items-center gap-1 mt-0.5">
                <CheckCircle2 className="size-3.5" /> Passwords match
              </p>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-3">
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={handleClose}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !hasMinLength || !hasLetter || !hasNumber || !passwordsMatch}
              className="bg-orange-500 hover:bg-orange-600 text-white font-medium cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 mr-1.5 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update Password"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
