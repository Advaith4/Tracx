export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type MetricType = "glucose" | "blood_pressure" | "weight" | "custom";
export type GlucoseUnit = "mg/dL" | "mmol/L";
export type WeightUnit = "kg" | "lb";
export type MealContext =
  | "fasting"
  | "breakfast"
  | "lunch"
  | "dinner"
  | "snack"
  | "unknown";
export type MealTiming = "before" | "after" | "unknown";
export type RecordSource = "manual" | "voice" | "import";
export type NotificationChannel = "in_app" | "push" | "email";
export type NotificationStatus = "pending" | "sent" | "failed" | "skipped";
export type WeeklyReportStatus = "pending" | "complete" | "failed";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          timezone: string;
          locale: string;
          date_of_birth: string | null;
          pregnancy_week: number | null;
          expected_due_date: string | null;
          provider_name: string | null;
          provider_contact: string | null;
          personal_notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          timezone?: string;
          locale?: string;
          date_of_birth?: string | null;
          pregnancy_week?: number | null;
          expected_due_date?: string | null;
          provider_name?: string | null;
          provider_contact?: string | null;
          personal_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          timezone?: string;
          locale?: string;
          date_of_birth?: string | null;
          pregnancy_week?: number | null;
          expected_due_date?: string | null;
          provider_name?: string | null;
          provider_contact?: string | null;
          personal_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      tracking_configs: {
        Row: {
          id: string;
          user_id: string;
          metric_type: MetricType;
          custom_label: string | null;
          enabled: boolean;
          schedule: Json;
          provider_targets: Json | null;
          unit: string;
          show_on_dashboard: boolean;
          include_in_reports: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          metric_type: MetricType;
          custom_label?: string | null;
          enabled?: boolean;
          schedule?: Json;
          provider_targets?: Json | null;
          unit: string;
          show_on_dashboard?: boolean;
          include_in_reports?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          metric_type?: MetricType;
          custom_label?: string | null;
          enabled?: boolean;
          schedule?: Json;
          provider_targets?: Json | null;
          unit?: string;
          show_on_dashboard?: boolean;
          include_in_reports?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      glucose_records: {
        Row: {
          id: string;
          user_id: string;
          value: number;
          unit: GlucoseUnit;
          measured_at: string;
          entered_at: string;
          meal_context: MealContext;
          timing: MealTiming;
          elapsed_minutes: number | null;
          notes: string | null;
          source: RecordSource;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          value: number;
          unit: GlucoseUnit;
          measured_at: string;
          entered_at?: string;
          meal_context: MealContext;
          timing: MealTiming;
          elapsed_minutes?: number | null;
          notes?: string | null;
          source?: RecordSource;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          value?: number;
          unit?: GlucoseUnit;
          measured_at?: string;
          entered_at?: string;
          meal_context?: MealContext;
          timing?: MealTiming;
          elapsed_minutes?: number | null;
          notes?: string | null;
          source?: RecordSource;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      blood_pressure_records: {
        Row: {
          id: string;
          user_id: string;
          systolic: number;
          diastolic: number;
          pulse: number | null;
          measured_at: string;
          entered_at: string;
          notes: string | null;
          source: RecordSource;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          systolic: number;
          diastolic: number;
          pulse?: number | null;
          measured_at: string;
          entered_at?: string;
          notes?: string | null;
          source?: RecordSource;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          systolic?: number;
          diastolic?: number;
          pulse?: number | null;
          measured_at?: string;
          entered_at?: string;
          notes?: string | null;
          source?: RecordSource;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      weight_records: {
        Row: {
          id: string;
          user_id: string;
          value: number;
          unit: WeightUnit;
          measured_at: string;
          entered_at: string;
          notes: string | null;
          source: RecordSource;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          value: number;
          unit: WeightUnit;
          measured_at: string;
          entered_at?: string;
          notes?: string | null;
          source?: RecordSource;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          value?: number;
          unit?: WeightUnit;
          measured_at?: string;
          entered_at?: string;
          notes?: string | null;
          source?: RecordSource;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      custom_metric_records: {
        Row: {
          id: string;
          user_id: string;
          metric_config_id: string;
          value_numeric: number | null;
          value_text: string | null;
          unit: string | null;
          measured_at: string;
          entered_at: string;
          notes: string | null;
          source: RecordSource;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          metric_config_id: string;
          value_numeric?: number | null;
          value_text?: string | null;
          unit?: string | null;
          measured_at: string;
          entered_at?: string;
          notes?: string | null;
          source?: RecordSource;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          metric_config_id?: string;
          value_numeric?: number | null;
          value_text?: string | null;
          unit?: string | null;
          measured_at?: string;
          entered_at?: string;
          notes?: string | null;
          source?: RecordSource;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      measurement_skips: {
        Row: {
          id: string;
          user_id: string;
          metric_type: string;
          tracking_config_id: string | null;
          scheduled_date: string;
          context_label: string | null;
          reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          metric_type: string;
          tracking_config_id?: string | null;
          scheduled_date: string;
          context_label?: string | null;
          reason?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          metric_type?: string;
          tracking_config_id?: string | null;
          scheduled_date?: string;
          context_label?: string | null;
          reason?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      daily_notes: {
        Row: {
          id: string;
          user_id: string;
          note_date: string;
          content: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          note_date: string;
          content: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          note_date?: string;
          content?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      reminders: {
        Row: {
          id: string;
          user_id: string;
          metric_type: string;
          label: string;
          scheduled_time: string;
          timezone: string;
          days_of_week: number[];
          channel: NotificationChannel;
          enabled: boolean;
          follow_up_minutes: number | null;
          snooze_minutes: number;
          quiet_hours_start: string | null;
          quiet_hours_end: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          metric_type: string;
          label: string;
          scheduled_time: string;
          timezone?: string;
          days_of_week?: number[];
          channel?: NotificationChannel;
          enabled?: boolean;
          follow_up_minutes?: number | null;
          snooze_minutes?: number;
          quiet_hours_start?: string | null;
          quiet_hours_end?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          metric_type?: string;
          label?: string;
          scheduled_time?: string;
          timezone?: string;
          days_of_week?: number[];
          channel?: NotificationChannel;
          enabled?: boolean;
          follow_up_minutes?: number | null;
          snooze_minutes?: number;
          quiet_hours_start?: string | null;
          quiet_hours_end?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      notification_logs: {
        Row: {
          id: string;
          user_id: string;
          reminder_id: string | null;
          scheduled_for: string;
          sent_at: string | null;
          read_at: string | null;
          channel: NotificationChannel;
          status: NotificationStatus;
          error_message: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          reminder_id?: string | null;
          scheduled_for: string;
          sent_at?: string | null;
          read_at?: string | null;
          channel: NotificationChannel;
          status: NotificationStatus;
          error_message?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          reminder_id?: string | null;
          scheduled_for?: string;
          sent_at?: string | null;
          read_at?: string | null;
          channel?: NotificationChannel;
          status?: NotificationStatus;
          error_message?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          device_label: string | null;
          created_at: string;
          last_used_at: string | null;
          revoked_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          device_label?: string | null;
          created_at?: string;
          last_used_at?: string | null;
          revoked_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          endpoint?: string;
          p256dh?: string;
          auth?: string;
          device_label?: string | null;
          created_at?: string;
          last_used_at?: string | null;
          revoked_at?: string | null;
        };
        Relationships: [];
      };
      weekly_reports: {
        Row: {
          id: string;
          user_id: string;
          period_start: string;
          period_end: string;
          statistics: Json;
          summary: string | null;
          report_data: Json;
          file_path: string | null;
          generated_at: string | null;
          status: WeeklyReportStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          period_start: string;
          period_end: string;
          statistics?: Json;
          summary?: string | null;
          report_data?: Json;
          file_path?: string | null;
          generated_at?: string | null;
          status?: WeeklyReportStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          period_start?: string;
          period_end?: string;
          statistics?: Json;
          summary?: string | null;
          report_data?: Json;
          file_path?: string | null;
          generated_at?: string | null;
          status?: WeeklyReportStatus;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
