import { profileApi, type ProfileDTO } from "@/api/features/profile.api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProfileName } from "@/store/slices/auth/authSlice";
import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { toast } from "sonner";

export default function ProfilePage() {
    const dispatch = useDispatch();
    const [profile, setProfile] = useState<ProfileDTO | null>(null);
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        profileApi
            .getMe()
            .then((data) => {
                setProfile(data);
                setFirstName(data.firstName ?? "");
                setLastName(data.lastName ?? "");
            })
            .catch(() => toast.error("Failed to load profile"))
            .finally(() => setIsLoading(false));
    }, []);

    const isDirty =
        !!profile && (firstName !== (profile.firstName ?? "") || lastName !== (profile.lastName ?? ""));

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!firstName.trim()) {
            setErrors({ firstName: "First name is required" });
            return;
        }

        setErrors({});
        setIsSaving(true);
        try {
            const updated = await profileApi.updateMe({
                firstName: firstName.trim(),
                lastName: lastName.trim(),
            });
            setProfile(updated);
            setFirstName(updated.firstName ?? "");
            setLastName(updated.lastName ?? "");
            // keep the Redux store + localStorage in sync so the header updates instantly
            dispatch(updateProfileName({ firstName: updated.firstName, lastName: updated.lastName ?? "" }));
            toast.success("Profile updated");
        } catch (err: any) {
            const fieldErrors: Record<string, string[]> | undefined = err?.response?.data?.errors;
            if (fieldErrors) {
                setErrors(Object.fromEntries(Object.entries(fieldErrors).map(([k, v]) => [k, v[0]])));
            } else {
                toast.error(err?.response?.data?.message ?? "Failed to update profile");
            }
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <MainLayout pathName={{ profile: "My Profile" }}>
            <div className="mx-auto w-full max-w-xl">
                <Card>
                    <CardHeader>
                        <CardTitle>My Profile</CardTitle>
                        <CardDescription>Update how your name appears across the system.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <p className="text-sm text-muted-foreground">Loading...</p>
                        ) : (
                            <form onSubmit={handleSave} className="space-y-5">
                                <div className="space-y-2">
                                    <Label htmlFor="email">Email</Label>
                                    <Input id="email" value={profile?.email ?? ""} disabled />
                                </div>

                                <div className="space-y-2">
                                    <Label>Roles</Label>
                                    <div className="flex flex-wrap gap-2">
                                        {profile?.roles.map((r) => (
                                            <Badge key={r} variant="secondary">
                                                {r}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="firstName">First name</Label>
                                    <Input
                                        id="firstName"
                                        value={firstName}
                                        maxLength={100}
                                        onChange={(e) => setFirstName(e.target.value)}
                                    />
                                    {errors.firstName && <p className="text-sm text-red-500">{errors.firstName}</p>}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="lastName">Last name</Label>
                                    <Input
                                        id="lastName"
                                        value={lastName}
                                        maxLength={100}
                                        onChange={(e) => setLastName(e.target.value)}
                                    />
                                    {errors.lastName && <p className="text-sm text-red-500">{errors.lastName}</p>}
                                </div>

                                <div className="flex justify-end gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        disabled={!isDirty || isSaving}
                                        onClick={() => {
                                            setFirstName(profile?.firstName ?? "");
                                            setLastName(profile?.lastName ?? "");
                                            setErrors({});
                                        }}
                                    >
                                        Reset
                                    </Button>
                                    <Button type="submit" disabled={!isDirty || isSaving}>
                                        {isSaving ? "Saving..." : "Save changes"}
                                    </Button>
                                </div>
                            </form>
                        )}
                    </CardContent>
                </Card>
            </div>
        </MainLayout>
    );
}