import type { MeasurementStatus } from "@/components/layout/status-badge";

export interface MetricSummary {
  id: "glucose" | "blood_pressure" | "weight";
  label: string;
  latestValue: string;
  unit: string;
  context: string;
  subtitle: string;
}

export interface ScheduledCheckIn {
  id: string;
  measurementName: string;
  context: string;
  scheduledTime: string;
  status: MeasurementStatus;
  recordedValue?: string;
}

export interface RecentMeasurement {
  id: string;
  type: string;
  value: string;
  context: string;
  measuredAt: string;
  source: "voice" | "manual";
}

export const MOCK_USER_NAME = "Maya";

export const MOCK_PROGRESS = {
  completed: 3,
  total: 5,
};

export const MOCK_METRIC_SUMMARIES: MetricSummary[] = [
  {
    id: "glucose",
    label: "Blood Glucose",
    latestValue: "118",
    unit: "mg/dL",
    context: "After breakfast · 1h",
    subtitle: "2 readings today",
  },
  {
    id: "blood_pressure",
    label: "Blood Pressure",
    latestValue: "118/76",
    unit: "mmHg",
    context: "Morning · Pulse 74 bpm",
    subtitle: "1 reading today",
  },
  {
    id: "weight",
    label: "Weight",
    latestValue: "64.2",
    unit: "kg",
    context: "Morning check-in",
    subtitle: "Latest record",
  },
];

export const MOCK_TODAY_SCHEDULE: ScheduledCheckIn[] = [
  {
    id: "sched-1",
    measurementName: "Blood Glucose",
    context: "Fasting",
    scheduledTime: "7:30 AM",
    status: "recorded",
    recordedValue: "92 mg/dL",
  },
  {
    id: "sched-2",
    measurementName: "Blood Pressure",
    context: "Morning",
    scheduledTime: "8:00 AM",
    status: "recorded",
    recordedValue: "118/76 mmHg",
  },
  {
    id: "sched-3",
    measurementName: "Blood Glucose",
    context: "After breakfast · 1h",
    scheduledTime: "10:00 AM",
    status: "recorded",
    recordedValue: "118 mg/dL",
  },
  {
    id: "sched-4",
    measurementName: "Blood Glucose",
    context: "After lunch · 1h",
    scheduledTime: "2:00 PM",
    status: "pending",
  },
  {
    id: "sched-5",
    measurementName: "Blood Glucose",
    context: "After dinner · 1h",
    scheduledTime: "8:30 PM",
    status: "upcoming",
  },
];

export const MOCK_RECENT_MEASUREMENTS: RecentMeasurement[] = [
  {
    id: "rec-1",
    type: "Blood Glucose",
    value: "118 mg/dL",
    context: "After breakfast (1h)",
    measuredAt: "Today, 10:05 AM",
    source: "voice",
  },
  {
    id: "rec-2",
    type: "Blood Pressure",
    value: "118/76 mmHg",
    context: "Morning · Pulse 74",
    measuredAt: "Today, 8:10 AM",
    source: "voice",
  },
  {
    id: "rec-3",
    type: "Blood Glucose",
    value: "92 mg/dL",
    context: "Fasting",
    measuredAt: "Today, 7:35 AM",
    source: "manual",
  },
  {
    id: "rec-4",
    type: "Weight",
    value: "64.2 kg",
    context: "Morning",
    measuredAt: "Yesterday, 7:45 AM",
    source: "manual",
  },
];
