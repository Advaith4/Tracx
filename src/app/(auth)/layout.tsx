import Link from "next/link";
import { HeartPulse } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="mb-6 flex items-center justify-center gap-2.5 text-foreground"
        >
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/12 text-primary">
            <HeartPulse className="size-5" aria-hidden="true" />
          </div>
          <span className="text-xl font-semibold tracking-tight">Tracx</span>
        </Link>

        {children}

        <p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground">
          Personal tracking tool only — not a medical device or diagnostic
          system.
        </p>
      </div>
    </div>
  );
}
