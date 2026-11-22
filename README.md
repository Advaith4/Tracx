# Tracx — Personal Health Tracking Companion

A personalized, voice-first, mobile-first Progressive Web App (PWA) designed to help a pregnant individual conveniently record, monitor, and review daily health measurements with minimal effort.

> **Medical Disclaimer:** This application is a personal health tracking and organization tool. It is **not** a medical device, diagnostic system, treatment recommendation system, or replacement for professional healthcare.

---

## Core Capabilities

- **Voice-First & Manual Logging:** Natural-language voice extraction with explicit user confirmation (`Open → Speak → Confirm → Save`), plus complete manual and historical entry fallbacks.
- **Context-Aware Tracking:**
  - **Blood Glucose:** Fasting, before/after meals (breakfast, lunch, dinner), meal association, and elapsed time.
  - **Blood Pressure:** Systolic, diastolic, and optional pulse.
  - **Weight:** Kilograms (`kg`) or pounds (`lb`).
  - **Custom Metrics:** User-configurable categories, units, contexts, and schedules.
- **Home Dashboard & Daily Progress:** Real-time daily status (`Upcoming`, `Pending`, `Recorded`, `Late`, `Skipped`, `Missed`), quick logging, and recent records.
- **Smart Reminders:** Configurable schedules, quiet hours, snooze, follow-ups, privacy-first lock-screen previews, Web Push, and email delivery.
- **History & Insights:** Chronological history, filtering, and context-preserving charts.
- **AI Health Data Assistant:** Retrieval and explanations backed strictly by authenticated database records and deterministic calculations.
- **Automated Weekly Reports:** Scheduled summaries with deterministic statistics, AI-generated descriptive observations, in-app viewing, PDF export, and optional email delivery.

---

## Planned Technology Stack

| Layer | Technology |
|---|---|
| Framework & Language | Next.js (App Router), React, TypeScript |
| Styling & UI | Tailwind CSS, `shadcn/ui`, Lucide React, Recharts |
| State & Validation | TanStack Query, Zustand, React Hook Form, Zod |
| Backend & Database | Supabase (PostgreSQL + RLS, Auth, Storage, Edge Functions, Cron) |
| AI & Voice | Vercel AI SDK (Gemini / OpenAI), Web Speech API (+ STT fallback) |
| PWA & Delivery | Serwist, Web App Manifest, Web Push API, Resend, `jsPDF`, Vercel |
| Testing | Vitest, Testing Library, Playwright |

---

## Documentation

- [Product Requirements Document (PRD)](./docs/Personal_Health_Tracking_Companion_PRD.md)
- [Technical Architecture & Implementation Documentation](./docs/Personal_Health_Tracking_Companion_Technical_Documentation.md)

---

## Repository Status

- **Current Phase:** Documentation baseline initialized on `main`. Application scaffolding (Phase 0) is next.
