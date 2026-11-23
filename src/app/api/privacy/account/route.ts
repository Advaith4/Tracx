import { accountDeleteSchema } from "@/features/privacy/service";
import { apiError, apiSuccess, requireApiUser } from "@/lib/supabase/api-helpers";
import { createAdminClient } from "@/lib/supabase/server";

export async function DELETE(request: Request) {
  const { supabase, user, unauthorizedResponse } = await requireApiUser();
  if (!user) return unauthorizedResponse;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return apiError(
      "INVALID_JSON",
      "Please send a valid confirmation payload.",
      400
    );
  }

  const parsed = accountDeleteSchema.safeParse(rawBody);
  if (!parsed.success) {
    return apiError(
      "CONFIRMATION_REQUIRED",
      'Type "DELETE" exactly to confirm permanent account removal.',
      400
    );
  }

  try {
    const adminClient = createAdminClient();
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(
      user.id
    );

    if (deleteError) {
      return apiError(
        "DELETE_FAILED",
        deleteError.message || "Could not delete account right now.",
        500
      );
    }

    await supabase.auth.signOut().catch(() => undefined);

    return apiSuccess({ deleted: true });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not delete account right now.";
    return apiError("DELETE_FAILED", message, 500);
  }
}
