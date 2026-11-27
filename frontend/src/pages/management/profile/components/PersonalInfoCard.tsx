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
  isSaving?: boolean;
  onStartEditing: () => void;
  onCancelEditing: () => void;
  onSaveProfile: (updatedValues: ProfileFormValues) => Promise<void>;
}

// --- Shared input style constants ---
const EDITABLE_INPUT_CLASSES =
  "bg-white dark:bg-zinc-950 border-blue-500/60 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-slate-900 dark:text-zinc-100 disabled:opacity-100";

const LOCKED_INPUT_CLASSES =
  "bg-slate-100/80 dark:bg-zinc-900/80 border-slate-200 dark:border-zinc-800 text-slate-800 dark:text-zinc-200 cursor-not-allowed disabled:opacity-100 read-only:opacity-100";

const VIEW_MODE_INPUT_CLASSES =
  "bg-slate-100/80 dark:bg-zinc-900/80 border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 disabled:text-slate-900 dark:disabled:text-zinc-100 disabled:opacity-100 read-only:opacity-100";

export const PersonalInfoCard: React.FC<PersonalInfoCardProps> = ({
  profile,
  isEditing,
  disabled = false,
  isSaving = false,
  onStartEditing,
  onCancelEditing,
  onSaveProfile,
}) => {
  const [formValues, setFormValues] = useState<ProfileFormValues>({
    fullName: profile.fullName || "",
    email: profile.email || "",
    phoneNumber: profile.phoneNumber || "",
  });

  const [errors, setErrors] = useState<ProfileFormErrors>({});
  const [localSaving, setLocalSaving] = useState(false);
  const saving = isSaving || localSaving;

  // Sync with profile prop when it changes or when toggling edit mode
  useEffect(() => {
    setFormValues({
      fullName: profile.fullName || "",
      email: profile.email || "",
      phoneNumber: profile.phoneNumber || "",
    });
    setErrors({});
  }, [profile, isEditing]);

  const validate = (): boolean => {
    const newErrors: ProfileFormErrors = {};

    // Validate Full Name
    const trimmedName = formValues.fullName.trim();
    if (!trimmedName) {
      newErrors.fullName = "Full name is required.";
    } else if (trimmedName.length < 2) {
      newErrors.fullName = "Full name must be at least 2 characters.";
    } else if (trimmedName.length > 100) {
      newErrors.fullName = "Full name must not exceed 100 characters.";
    }

    // Validate Email
    const trimmedEmail = formValues.email.trim();
    if (!trimmedEmail) {
      newErrors.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      newErrors.email = "Please enter a valid email address.";
    }

    // Validate Phone Number
    const trimmedPhone = formValues.phoneNumber.trim();
    const cleanedPhone = trimmedPhone.replace(/[\s\-().]/g, "");
    if (!trimmedPhone) {
      newErrors.phoneNumber = "Phone number is required.";
    } else if (!/^\+?[0-9]{8,15}$/.test(cleanedPhone)) {
      newErrors.phoneNumber = "Please enter a valid phone number (8–15 digits, e.g. 0903 221 879).";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isFormChanged =
    formValues.fullName.trim() !== (profile.fullName || "").trim() ||
    formValues.email.trim() !== (profile.email || "").trim() ||
    formValues.phoneNumber.trim() !== (profile.phoneNumber || "").trim();

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (!isFormChanged) {
      onCancelEditing();
      return;
    }

    try {
      setLocalSaving(true);
      await onSaveProfile({
        fullName: formValues.fullName.trim(),
        email: formValues.email.trim(),
        phoneNumber: formValues.phoneNumber.trim(),
      });
    } finally {
      setLocalSaving(false);
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

      <form id="profile-form" onSubmit={handleSave}>
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
                disabled={!isEditing || saving}
                value={formValues.fullName}
                onChange={(e) => {
                  setFormValues((prev) => ({ ...prev, fullName: e.target.value }));
                  if (errors.fullName) {
                    setErrors((prev) => ({ ...prev, fullName: undefined }));
                  }
                }}
                className={`${
                  isEditing
                    ? `${EDITABLE_INPUT_CLASSES} ${errors.fullName ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : ""}`
                    : VIEW_MODE_INPUT_CLASSES
                }`}
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

          {/* 2. Email (Editable in edit mode) */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="email" className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                Email {isEditing && <span className="text-red-500">*</span>}
              </Label>
            </div>
            <Input
              id="email"
              name="email"
              type="email"
              disabled
              readOnly
              value={isEditing ? formValues.email : profile.email}
              onChange={(e) => {
                setFormValues((prev) => ({ ...prev, email: e.target.value }));
                if (errors.email) {
                  setErrors((prev) => ({ ...prev, email: undefined }));
                }
              }}
              className={`${
                isEditing
                  ? `${EDITABLE_INPUT_CLASSES} ${errors.email ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : ""}`
                  : VIEW_MODE_INPUT_CLASSES
              }`}
              placeholder="Enter email address"
            />
            {errors.email && (
              <p className="text-xs text-red-500 flex items-center gap-1 mt-0.5">
                <AlertCircle className="size-3.5" />
                {errors.email}
              </p>
            )}
          </div>

          {/* 3. Employee Code (Read-only always) */}
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
              className={LOCKED_INPUT_CLASSES}
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
              disabled={!isEditing || saving}
              value={formValues.phoneNumber}
              onChange={(e) => {
                setFormValues((prev) => ({ ...prev, phoneNumber: e.target.value }));
                if (errors.phoneNumber) {
                  setErrors((prev) => ({ ...prev, phoneNumber: undefined }));
                }
              }}
              className={`${
                isEditing
                  ? `${EDITABLE_INPUT_CLASSES} ${errors.phoneNumber ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : ""}`
                  : VIEW_MODE_INPUT_CLASSES
              }`}
              placeholder="e.g. 0903 221 879"
            />
            {errors.phoneNumber && (
              <p className="text-xs text-red-500 flex items-center gap-1 mt-0.5">
                <AlertCircle className="size-3.5" />
                {errors.phoneNumber}
              </p>
            )}
          </div>

          {/* 5. Role (Read-only always) */}
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
              className={LOCKED_INPUT_CLASSES}
              readOnly
            />
          </div>

          {/* 6. Department (Read-only always) */}
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
              className={LOCKED_INPUT_CLASSES}
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
              disabled={saving}
              className="cursor-pointer"
            >
              <X className="size-4 mr-1" />
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 text-white cursor-pointer font-medium disabled:opacity-50"
            >
              {saving ? (
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
