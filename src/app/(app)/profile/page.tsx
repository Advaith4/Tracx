import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { LoadingState } from "@/components/layout/feedback-states";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SignOutButton } from "@/features/auth/components/sign-out-button";
import { ProfileSettingsForm } from "@/features/profile/components/profile-settings-form";
import { createClient } from "@/lib/supabase/server";

async function ProfileContent() {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/profile");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div className="flex flex-col gap-6">
      <ProfileSettingsForm
        userId={user.id}
        email={user.email ?? ""}
        initialProfile={profile}
      />

      <Card>
        <CardHeader>
          <CardTitle>Session</CardTitle>
          <CardDescription>
            Sign out of your Tracx session on this device.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignOutButton />
        </CardContent>
      </Card>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your personal details, timezone, and account session.
        </p>
      </div>

      <Suspense fallback={<LoadingState rows={3} />}>
        <ProfileContent />
      </Suspense>
    </div>
  );
}
