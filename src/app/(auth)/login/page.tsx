import { Suspense } from "react";
import { LoadingState } from "@/components/layout/feedback-states";
import { LoginForm } from "@/features/auth/components/login-form";

export default function LoginPage() {
  return (
    <Suspense fallback={<LoadingState rows={2} />}>
      <LoginForm />
    </Suspense>
  );
}
