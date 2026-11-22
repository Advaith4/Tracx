import { z } from "zod";

export const profileSchema = z.object({
  display_name: z.string().trim().max(80, "Name is too long.").optional(),
  timezone: z.string().trim().min(1, "Please select a timezone."),
  locale: z.string().trim().min(2, "Please select a language."),
  date_of_birth: z.string().trim().optional(),
  pregnancy_week: z
    .string()
    .trim()
    .refine(
      (val) => {
        if (!val) return true;
        const num = Number(val);
        return Number.isInteger(num) && num >= 1 && num <= 45;
      },
      { message: "Pregnancy week must be between 1 and 45." }
    )
    .optional(),
  expected_due_date: z.string().trim().optional(),
  provider_name: z.string().trim().max(120, "Provider name is too long.").optional(),
  provider_contact: z
    .string()
    .trim()
    .max(120, "Provider contact is too long.")
    .optional(),
  personal_notes: z.string().trim().max(1000, "Notes are too long.").optional(),
});

export type ProfileFormValues = z.infer<typeof profileSchema>;
