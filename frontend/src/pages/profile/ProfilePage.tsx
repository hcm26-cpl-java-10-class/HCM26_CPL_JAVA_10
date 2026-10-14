import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Loader2, KeyRound } from "lucide-react";

import { MainLayout } from "@/components/layout/MainLayout";
import ChangePasswordDialog from "@/components/auth/ChangePasswordDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authApi, type Profile } from "@/api/features/auth.api";
import { setProfileName } from "@/store/slices/auth/authSlice";
import { formatRoleLabel } from "@/utils/rbac.utils";

const schema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(100, "Max 100 characters"),
  lastName: z.string().trim().max(100, "Max 100 characters"),
});
type FormValues = z.infer<typeof schema>;

export default function ProfilePage() {
  const dispatch = useDispatch();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { firstName: "", lastName: "" },
  });

  useEffect(() => {
    let cancelled = false;
    authApi
      .getProfile()
      .then((data) => {
        if (cancelled) return;
        setProfile(data);
        form.reset({ firstName: data.firstName, lastName: data.lastName ?? "" });
      })
      .catch(() => toast.error("Could not load profile"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = async (values: FormValues) => {
    setSaving(true);
    try {
      const updated = await authApi.updateProfile(values);
      setProfile(updated);
      form.reset({ firstName: updated.firstName, lastName: updated.lastName ?? "" });
      dispatch(setProfileName({ firstName: updated.firstName, lastName: updated.lastName ?? "" }));
      toast.success("Profile updated");
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Could not update profile";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const initials = profile
    ? `${profile.firstName?.[0] ?? ""}${profile.lastName?.[0] ?? ""}`.toUpperCase() || "?"
    : "";

  return (
    <MainLayout>
      <div className="mx-auto w-full max-w-2xl space-y-6">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !profile ? (
          <p className="text-center text-muted-foreground">Profile is unavailable.</p>
        ) : (
          <>
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-xl font-semibold text-primary-foreground">
                {initials}
              </div>
              <div>
                <h1 className="text-2xl font-bold">
                  {profile.firstName} {profile.lastName}
                </h1>
                <p className="text-sm text-muted-foreground">{profile.email}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {profile.roles.map((r) => (
                    <Badge key={r} variant="secondary">
                      {formatRoleLabel(r)}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Personal information</CardTitle>
                <CardDescription>
                  Member since {new Date(profile.createdAt).toLocaleDateString()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input value={profile.email} disabled readOnly />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <Label>First name</Label>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="lastName"
                        render={({ field }) => (
                          <FormItem>
                            <Label>Last name</Label>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!form.formState.isDirty || saving}
                        onClick={() => form.reset()}
                      >
                        Reset
                      </Button>
                      <Button type="submit" disabled={!form.formState.isDirty || saving}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save changes
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Security</CardTitle>
                <CardDescription>Change the password you use to sign in.</CardDescription>
              </CardHeader>
              <CardContent>
                <ChangePasswordDialog
                  trigger={
                    <Button variant="outline">
                      <KeyRound size={16} /> Change password
                    </Button>
                  }
                />
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </MainLayout>
  );
}
