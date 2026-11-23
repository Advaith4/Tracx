"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      setSigningOut(false);
      toast.error("Couldn't sign out right now. Please try again.");
      return;
    }

    toast.success("Signed out");
    router.push("/login");
    router.refresh();
  }

  return (
    <Button
      size="lg"
      variant="secondary"
      type="button"
      disabled={signingOut}
      onClick={handleSignOut}
      className="w-full sm:w-auto"
    >
      {signingOut ? (
        <>
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Signing out...
        </>
      ) : (
        <>
          <LogOut className="size-4" aria-hidden="true" />
          Sign Out
        </>
      )}
    </Button>
  );
}
