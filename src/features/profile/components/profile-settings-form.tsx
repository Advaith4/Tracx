"use client";

import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { PrivacyControlsCard } from "@/features/privacy/components/privacy-controls-card";
import type { Tables } from "@/types/database";
import { profileSchema, type ProfileFormValues } from "../schemas";

const COMMON_TIMEZONES = [
  "UTC",
  "Asia/Kolkata",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Australia/Sydney",
];

interface ProfileSettingsFormProps {
  userId: string;
  email: string;
  initialProfile: Tables<"profiles"> | null;
}

export function ProfileSettingsForm({
  userId,
  email,
  initialProfile,
}: ProfileSettingsFormProps) {
  const router = useRouter();
  const initialTz = initialProfile?.timezone || "UTC";
  const timezoneOptions = COMMON_TIMEZONES.includes(initialTz)
    ? COMMON_TIMEZONES
    : [initialTz, ...COMMON_TIMEZONES];

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      display_name: initialProfile?.display_name ?? "",
      timezone: initialTz,
      locale: initialProfile?.locale ?? "en",
      date_of_birth: initialProfile?.date_of_birth ?? "",
      pregnancy_week:
        initialProfile?.pregnancy_week !== null &&
        initialProfile?.pregnancy_week !== undefined
          ? String(initialProfile.pregnancy_week)
          : "",
      expected_due_date: initialProfile?.expected_due_date ?? "",
      provider_name: initialProfile?.provider_name ?? "",
      provider_contact: initialProfile?.provider_contact ?? "",
      personal_notes: initialProfile?.personal_notes ?? "",
    },
  });

  const timezone = useWatch({ control, name: "timezone" });
  const locale = useWatch({ control, name: "locale" });

  async function onSubmit(values: ProfileFormValues) {
    const supabase = createClient();
    const pregnancyWeek = values.pregnancy_week?.trim()
      ? Number(values.pregnancy_week.trim())
      : null;

    const { error } = await supabase.from("profiles").upsert({
      id: userId,
      display_name: values.display_name?.trim() || null,
      timezone: values.timezone,
      locale: values.locale,
      date_of_birth: values.date_of_birth?.trim() || null,
      pregnancy_week: pregnancyWeek,
      expected_due_date: values.expected_due_date?.trim() || null,
      provider_name: values.provider_name?.trim() || null,
      provider_contact: values.provider_contact?.trim() || null,
      personal_notes: values.personal_notes?.trim() || null,
    });

    if (error) {
      toast.error("Couldn't save profile", {
        description: "Please check your connection and try again.",
      });
      return;
    }

    toast.success("Profile saved");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Personal Details</CardTitle>
          <CardDescription>
            Signed in as <strong className="text-foreground">{email}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="profile-name">Display name</Label>
            <Input
              id="profile-name"
              placeholder="How Tracx should greet you"
              className="h-11"
              aria-invalid={Boolean(errors.display_name)}
              {...register("display_name")}
            />
            {errors.display_name ? (
              <p className="text-xs text-destructive">
                {errors.display_name.message}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="profile-timezone">Time zone</Label>
            <Select
              value={timezone}
              onValueChange={(value) => {
                if (value) setValue("timezone", value);
              }}
            >
              <SelectTrigger id="profile-timezone" className="h-11 w-full">
                <SelectValue placeholder="Select timezone" />
              </SelectTrigger>
              <SelectContent>
                {timezoneOptions.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="profile-locale">Language</Label>
            <Select
              value={locale}
              onValueChange={(value) => {
                if (value) setValue("locale", value);
              }}
            >
              <SelectTrigger id="profile-locale" className="h-11 w-full">
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Optional Pregnancy &amp; Care Details</CardTitle>
          <CardDescription>
            All fields below are optional. Share only what helps you organize
            your tracking.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="profile-dob">Date of birth</Label>
            <Input
              id="profile-dob"
              type="date"
              className="h-11"
              {...register("date_of_birth")}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="profile-week">Pregnancy week (1–45)</Label>
            <Input
              id="profile-week"
              type="number"
              inputMode="numeric"
              min={1}
              max={45}
              placeholder="Optional"
              className="h-11"
              aria-invalid={Boolean(errors.pregnancy_week)}
              {...register("pregnancy_week")}
            />
            {errors.pregnancy_week ? (
              <p className="text-xs text-destructive">
                {errors.pregnancy_week.message}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="profile-due-date">Expected due date</Label>
            <Input
              id="profile-due-date"
              type="date"
              className="h-11"
              {...register("expected_due_date")}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="profile-provider-name">Healthcare provider</Label>
            <Input
              id="profile-provider-name"
              placeholder="Optional doctor or clinic name"
              className="h-11"
              {...register("provider_name")}
            />
          </div>

          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="profile-provider-contact">
              Provider contact details
            </Label>
            <Input
              id="profile-provider-contact"
              placeholder="Optional phone or clinic portal note"
              className="h-11"
              {...register("provider_contact")}
            />
          </div>

          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="profile-notes">Personal notes</Label>
            <Textarea
              id="profile-notes"
              placeholder="Optional reminders or instructions from your healthcare provider..."
              rows={3}
              {...register("personal_notes")}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button size="lg" type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Saving...
            </>
          ) : (
            <>
              <Save className="size-4" aria-hidden="true" />
              Save Profile
            </>
          )}
        </Button>
      </div>
    </form>

    <PrivacyControlsCard userId={userId} email={email} />
    </div>
  );
}
