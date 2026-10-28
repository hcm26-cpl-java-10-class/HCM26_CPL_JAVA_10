import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Check, X, Lock, AlertCircle, Loader2 } from "lucide-react";
import type { UserProfileData, ProfileFormValues, ProfileFormErrors } from "../types";

interface PersonalInfoCardProps {
  profile: UserProfileData;
  isEditing: boolean;
  disabled?: boolean;
  onStartEditing: () => void;
  onCancelEditing: () => void;
  onSaveProfile: (updatedValues: ProfileFormValues) => Promise<void>;
}

export const PersonalInfoCard: React.FC<PersonalInfoCardProps> = ({
  profile,
  isEditing,
  disabled = false,
  onStartEditing,
  onCancelEditing,
  onSaveProfile,
}) => {
  const [formValues, setFormValues] = useState<ProfileFormValues>({
    fullName: profile.fullName,
    phoneNumber: profile.phoneNumber,
  });

  const [errors, setErrors] = useState<ProfileFormErrors>({});
  const [isSaving, setIsSaving] = useState(false);

  // Sync with profile prop when it changes or when cancelling
  useEffect(() => {
    setFormValues({
      fullName: profile.fullName,
      phoneNumber: profile.phoneNumber,
    });
    setErrors({});
  }, [profile, isEditing]);

  const validate = (): boolean => {
    const newErrors: ProfileFormErrors = {};

    // Validate Full Name
    if (!formValues.fullName.trim()) {
      newErrors.fullName = "Full name is required.";
    } else if (formValues.fullName.trim().length < 2) {
      newErrors.fullName = "Full name must be at least 2 characters.";
    }

    // Validate Phone Number (supports Vietnamese & international formats, spaces, dashes)
    const cleanedPhone = formValues.phoneNumber.replace(/[\s\-().]/g, "");
    if (!formValues.phoneNumber.trim()) {
      newErrors.phoneNumber = "Phone number is required.";
    } else if (!/^(0|\+84)?[0-9]{9,11}$/.test(cleanedPhone)) {
      newErrors.phoneNumber = "Please enter a valid phone number (9–11 digits, e.g. 0903 221 879).";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isFormChanged =
    formValues.fullName.trim() !== profile.fullName.trim() ||
    formValues.phoneNumber.trim() !== profile.phoneNumber.trim();

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (!isFormChanged) {
      onCancelEditing();
      return;
    }

    try {
      setIsSaving(true);
      await onSaveProfile(formValues);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white dark:bg-card rounded-xl border border-gray-100 dark:border-border shadow-xs p-6 transition-all">
      <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-border mb-5">
        <div>
          <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
            Personal Information
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            View and manage your personal contact details.
          </p>
        </div>

        {!isEditing && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={onStartEditing}
            className="text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/40 cursor-pointer font-medium"
          >
            Edit Information
          </Button>
        )}
      </div>

      <form onSubmit={handleSave}>
        {/* 6 fields in a 2-column grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          {/* 1. Full Name (Editable) */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fullName" className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              Full Name <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Input
                id="fullName"
                name="fullName"
                type="text"
                disabled={!isEditing || isSaving}
                value={formValues.fullName}
                onChange={(e) => {
                  setFormValues((prev) => ({ ...prev, fullName: e.target.value }));
                  if (errors.fullName) {
                    setErrors((prev) => ({ ...prev, fullName: undefined }));
                  }
                }}
                className={`bg-white dark:bg-card ${
                  !isEditing ? "bg-gray-50/50 text-gray-700 dark:bg-muted/20" : "focus:border-blue-500 focus:ring-blue-500/20"
                } ${errors.fullName ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : ""}`}
                placeholder="Enter full name"
              />
            </div>
            {errors.fullName && (
              <p className="text-xs text-red-500 flex items-center gap-1 mt-0.5">
                <AlertCircle className="size-3.5" />
                {errors.fullName}
              </p>
            )}
          </div>

          {/* 2. Email (Read-only) */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="email" className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                Email
              </Label>
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Lock className="size-3 text-gray-400" /> Read-only
              </span>
            </div>
            <Input
              id="email"
              type="email"
              disabled
              value={profile.email}
              className="bg-gray-50/70 text-gray-500 dark:bg-muted/30 dark:text-gray-400 cursor-not-allowed select-none"
              readOnly
            />
          </div>

          {/* 3. Employee Code (Read-only) */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="employeeCode" className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                Employee Code
              </Label>
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Lock className="size-3 text-gray-400" /> Read-only
              </span>
            </div>
            <Input
              id="employeeCode"
              type="text"
              disabled
              value={profile.employeeCode}
              className="bg-gray-50/70 text-gray-500 dark:bg-muted/30 dark:text-gray-400 cursor-not-allowed select-none"
              readOnly
            />
          </div>

          {/* 4. Phone Number (Editable) */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="phoneNumber" className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              Phone Number <span className="text-red-500">*</span>
            </Label>
            <Input
              id="phoneNumber"
              name="phoneNumber"
              type="tel"
              disabled={!isEditing || isSaving}
              value={formValues.phoneNumber}
              onChange={(e) => {
                setFormValues((prev) => ({ ...prev, phoneNumber: e.target.value }));
                if (errors.phoneNumber) {
                  setErrors((prev) => ({ ...prev, phoneNumber: undefined }));
                }
              }}
              className={`bg-white dark:bg-card ${
                !isEditing ? "bg-gray-50/50 text-gray-700 dark:bg-muted/20" : "focus:border-blue-500 focus:ring-blue-500/20"
              } ${errors.phoneNumber ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : ""}`}
              placeholder="e.g. 0903 221 879"
            />
            {errors.phoneNumber && (
              <p className="text-xs text-red-500 flex items-center gap-1 mt-0.5">
                <AlertCircle className="size-3.5" />
                {errors.phoneNumber}
              </p>
            )}
          </div>

          {/* 5. Role (Read-only for ordinary users) */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="role" className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                Role
              </Label>
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Lock className="size-3 text-gray-400" /> Managed by Admin
              </span>
            </div>
            <Input
              id="role"
              type="text"
              disabled
              value={profile.role}
              className="bg-gray-50/70 text-gray-500 dark:bg-muted/30 dark:text-gray-400 cursor-not-allowed select-none"
              readOnly
            />
          </div>

          {/* 6. Department (Read-only for ordinary users) */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="department" className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                Department
              </Label>
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Lock className="size-3 text-gray-400" /> Managed by Admin
              </span>
            </div>
            <Input
              id="department"
              type="text"
              disabled
              value={profile.department}
              className="bg-gray-50/70 text-gray-500 dark:bg-muted/30 dark:text-gray-400 cursor-not-allowed select-none"
              readOnly
            />
          </div>
        </div>

        {/* Action buttons visible during Edit Mode */}
        {isEditing && (
          <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-gray-100 dark:border-border">
            <Button
              type="button"
              variant="outline"
              onClick={onCancelEditing}
              disabled={isSaving}
              className="cursor-pointer"
            >
              <X className="size-4 mr-1" />
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSaving || !isFormChanged}
              className="bg-blue-600 hover:bg-blue-700 text-white cursor-pointer font-medium disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="size-4 mr-1.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="size-4 mr-1" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        )}
      </form>
    </div>
  );
};
