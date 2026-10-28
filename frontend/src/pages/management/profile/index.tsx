import { usePermissions } from "@/hooks/usePermissions";
import React, { useState, useMemo, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";
import { MainLayout } from "@/components/layout/MainLayout";
import { store } from "@/store/store";
import type { RootState } from "@/store/store";
import { initialProfileData } from "./mockData";
import { ProfileHeader } from "./components/ProfileHeader";
import { ProfileSummaryCard } from "./components/ProfileSummaryCard";
import { PersonalInfoCard } from "./components/PersonalInfoCard";
import { LearningOverviewCard } from "./components/LearningOverviewCard";
import { AccountSecurityCard } from "./components/AccountSecurityCard";
import { SkillsCard } from "./components/SkillsCard";
import { ChangePasswordModal } from "./components/ChangePasswordModal";
import type { UserProfileData, ProfileFormValues } from "./types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, ShieldX, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { profileApi } from "@/api/features/profile.api";
import { updateUserProfile } from "@/store/slices/auth/authSlice";

export const PersonalProfilePage: React.FC = () => {
  const { canLearn } = usePermissions();
  const dispatch = useDispatch();
  const auth = useSelector((state: RootState) => state.auth);

  // Compute initials helper
  const computeInitials = (name: string): string => {
    if (!name) return "TA";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  };

  // Combine auth user data with realistic defaults
  const initialData: UserProfileData = useMemo(() => {
    const authFullName =
      auth.firstName && auth.lastName
        ? `${auth.firstName} ${auth.lastName}`
        : auth.firstName || "";

    const fullName = authFullName.trim() || initialProfileData.fullName;
    const email = auth.email || initialProfileData.email;
    const role = auth.role || initialProfileData.role;

    return {
      ...initialProfileData,
      fullName,
      email,
      role: role.toUpperCase(),
      initials: computeInitials(fullName),
    };
  }, [auth.firstName, auth.lastName, auth.email, auth.role]);

  // Profile data state
  const [profile, setProfile] = useState<UserProfileData>(initialData);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [profileError, setProfileError] = useState(false);
  const [reload, setReload] = useState(0);
  const displayedProfile = profile.email === auth.email ? profile : initialData;

  // Optional preview states for edge-case verification requested by SRS note
  // (normal, loading, empty, permission_denied, conflict)
  const [demoState, setDemoState] = useState<"normal" | "loading" | "empty" | "permission_denied" | "conflict">("normal");

  // Fetch real profile from backend when authenticated
  useEffect(() => {
    let cancelled = false;
    const fetchProfile = async () => {
      if (!auth.isAuthenticated && !localStorage.getItem("token")) {
        return;
      }
      try {
        setIsLoading(true);
        setProfileError(false);
        const data = await profileApi.getProfile();
        if (cancelled) return;
        if (data.email !== auth.email) throw new Error("Profile identity does not match the session");
        setProfile(data);
        // Synchronize Redux user name with backend profile
        dispatch(
          updateUserProfile({
            fullName: data.fullName,
            firstName: data.firstName,
            lastName: data.lastName,
          })
        );
      } catch (err: any) {
        if (!cancelled) setProfileError(true);
        // Fallback to initial local profile if backend is not reachable or unauthenticated
        console.warn("Could not fetch profile from backend, using current session profile:", err?.message);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    setProfile(initialData);
    setIsEditing(false);
    setIsChangePasswordOpen(false);
    fetchProfile();
    return () => { cancelled = true; };
  }, [auth.isAuthenticated, auth.email, dispatch, reload]);

  // Save profile handler
  const handleSaveProfile = async (values: ProfileFormValues) => {
    if (demoState === "conflict") {
      toast.error("Update Conflict Detected", {
        description: "Your profile was modified from another session. Please reload to view latest changes.",
      });
      return;
    }

    try {
      if (auth.isAuthenticated || localStorage.getItem("token")) {
        const updated = await profileApi.updateProfile({
          fullName: values.fullName.trim(),
          phoneNumber: values.phoneNumber.trim(),
        });
        if (store.getState().auth.email !== auth.email) return;
        if (updated.email !== auth.email) throw new Error("Profile identity does not match the session");
        setProfile(updated);
        // Synchronize Redux user and header with updated name
        dispatch(
          updateUserProfile({
            fullName: updated.fullName,
            firstName: updated.firstName,
            lastName: updated.lastName,
          })
        );
      } else {
        throw new Error("Please sign in before updating your profile.");
      }

      setIsEditing(false);
      toast.success("Profile updated successfully!", {
        description: "Your personal information has been saved.",
      });
    } catch (err: any) {
      const serverMsg =
        err?.response?.data?.message ||
        (err?.response?.data?.errors
          ? Object.values(err.response.data.errors).flat().join(", ")
          : null) ||
        "Failed to update profile. Please try again.";

      toast.error("Profile update failed", { description: serverMsg });
      throw err;
    }
  };

  return (
    <MainLayout
      pathName={{
        "/fams/ho-so-ca-nhan-oi-mat-khau": "Personal Profile & Password",
        "/fams/ho-so-ca-nhan-doi-mat-khau": "Personal Profile & Password",
        "/fams/profile": "Personal Profile & Password",
        "/profile": "Personal Profile & Password",
        fams: "FAMS & LMS",
        identity: "Identity",
      }}
    >
      <div className="flex-1 w-full max-w-7xl mx-auto space-y-6">
        {/* Header with Breadcrumb, Title & Top Action Buttons */}
        <ProfileHeader
          isEditing={isEditing}
          disabled={isLoading || profileError}
          onOpenChangePassword={() => setIsChangePasswordOpen(true)}
          onTriggerUpdateProfile={() => setIsEditing(true)}
        />

        {profileError && <Alert variant="destructive">
          <AlertTitle>Profile could not be loaded</AlertTitle>
          <AlertDescription>Your session information is shown. Retry before editing your profile.
            <Button variant="outline" size="sm" onClick={() => setReload(value => value + 1)}>Retry</Button>
          </AlertDescription>
        </Alert>}
        {/* Permission Denied Demo State */}
        {demoState === "permission_denied" && (
          <Alert variant="destructive" className="bg-red-50 border-red-200 text-red-900 dark:bg-red-950/40 dark:border-red-900">
            <ShieldX className="size-5 text-red-600" />
            <AlertTitle className="font-bold">Access Restricted</AlertTitle>
            <AlertDescription className="text-sm">
              You do not have permission to view or manage personal profile settings in this session.
            </AlertDescription>
          </Alert>
        )}

        {/* Concurrency Conflict Notice */}
        {demoState === "conflict" && (
          <Alert className="bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/40 dark:border-amber-900">
            <AlertTriangle className="size-5 text-amber-600" />
            <AlertTitle className="font-bold">Simulated Concurrency Conflict</AlertTitle>
            <AlertDescription className="text-sm flex items-center justify-between">
              <span>A concurrent update conflict will be triggered when submitting profile changes.</span>
              <Button
                size="xs"
                variant="outline"
                onClick={() => setDemoState("normal")}
                className="ml-4 cursor-pointer text-xs"
              >
                Reset State
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Loading State Skeleton */}
        {isLoading || demoState === "loading" ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-pulse">
            <div className="lg:col-span-8 space-y-6">
              <div className="h-32 bg-gray-200 dark:bg-muted rounded-xl" />
              <div className="h-80 bg-gray-200 dark:bg-muted rounded-xl" />
            </div>
            <div className="lg:col-span-4 space-y-6">
              <div className="h-44 bg-gray-200 dark:bg-muted rounded-xl" />
              <div className="h-32 bg-gray-200 dark:bg-muted rounded-xl" />
            </div>
          </div>
        ) : demoState === "empty" ? (
          <div className="bg-white dark:bg-card rounded-xl border border-dashed border-gray-300 dark:border-border p-12 text-center space-y-3">
            <p className="text-gray-500 text-sm">No profile data could be retrieved for this account.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDemoState("normal")}
              className="cursor-pointer"
            >
              <RefreshCw className="size-3.5 mr-1.5" />
              Reload Profile
            </Button>
          </div>
        ) : demoState !== "permission_denied" ? (
          /* Main Two-Column Layout (Matching SCR-27 Reference) */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Profile Summary & Personal Information */}
            <div className="lg:col-span-8 flex flex-col gap-6">
              <ProfileSummaryCard profile={displayedProfile} />
              <PersonalInfoCard
                key={auth.email}
                disabled={isLoading || profileError}
                profile={displayedProfile}
                isEditing={isEditing}
                onStartEditing={() => { if (!profileError) setIsEditing(true); }}
                onCancelEditing={() => setIsEditing(false)}
                onSaveProfile={handleSaveProfile}
              />
              {canLearn && <LearningOverviewCard />}
            </div>

            {/* Right Column: Account Security & Skills */}
            <div className="lg:col-span-4 flex flex-col gap-6">
              <AccountSecurityCard profile={displayedProfile} />
              <SkillsCard skills={displayedProfile.skills} />
            </div>
          </div>
        ) : null}

        {/* Change Password Modal */}
        <ChangePasswordModal
          key={auth.email}
          open={isChangePasswordOpen}
          onOpenChange={setIsChangePasswordOpen}
        />
      </div>
    </MainLayout>
  );
};

export default PersonalProfilePage;
