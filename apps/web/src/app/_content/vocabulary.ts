export interface VocabPair {
  id: string;
  raw: string;
  cleaned: string;
  correctedBy: string;
  timestamp: string;
}

export const VOCAB_LIST: VocabPair[] = [
  { id: "v1", raw: "super base migration", cleaned: "Supabase migration", correctedBy: "Backend Team", timestamp: "2 mins ago" },
  { id: "v2", raw: "at miss meet ai", cleaned: "Sonda Note", correctedBy: "Product Lead", timestamp: "14 mins ago" },
  { id: "v3", raw: "figure ma file link", cleaned: "Figma design link", correctedBy: "UI Engineer", timestamp: "1 hour ago" },
  { id: "v4", raw: "raise pay sandbox issue", cleaned: "Razorpay Sandbox API", correctedBy: "DevOps", timestamp: "3 hours ago" },
  { id: "v5", raw: "sounder deploy cheyyanam", cleaned: "Sonda Note deployment", correctedBy: "Tech Lead", timestamp: "Yesterday" },
  { id: "v6", raw: "manglish speech clean aakkanam", cleaned: "Clean Manglish speech", correctedBy: "ASR Pipeline", timestamp: "Yesterday" },
  { id: "v7", raw: "neo n postgres db RLS", cleaned: "Neon Postgres RLS", correctedBy: "DB Admin", timestamp: "2 days ago" },
  { id: "v8", raw: "claude mcp connector setup", cleaned: "Claude MCP Connector", correctedBy: "AI Integrations", timestamp: "3 days ago" },
];

export interface TemplateItem {
  id: string;
  name: string;
  description: string;
  summary: string;
  actionItems: string[];
}

export const TEMPLATES: TemplateItem[] = [
  {
    id: "standup",
    name: "Daily Standup",
    description: "Focuses on yesterday's achievements, today's targets, and active blockers.",
    summary: "Sprint sync focused on API endpoint updates and Supabase RLS migrations. Team resolved sandbox CORS errors.",
    actionItems: [
      "Sarhan to push Supabase RLS migration script",
      "Anjali to complete Figma component review",
      "Deploy staging build to Vercel"
    ],
  },
  {
    id: "sales",
    name: "Sales Pitch & Demo",
    description: "Captures prospect pain points, budget constraints, feature requests, and follow-ups.",
    summary: "Client interested in Enterprise Malayalam ASR + local SQLite storage. Agreed on POC trial period.",
    actionItems: [
      "Send custom security compliance DPA",
      "Schedule follow-up technical architecture call",
      "Provide trial API credentials"
    ],
  },
  {
    id: "client",
    name: "Client Sync",
    description: "Tracks client feedback, scope changes, milestone approvals, and delivery dates.",
    summary: "Reviewed design system tokens and real-time meeting transcription latency. Client approved warm cream theme.",
    actionItems: [
      "Update brand palette documentation",
      "Finalize Q3 milestone scope deliverable",
      "Share recording summary export"
    ],
  },
  {
    id: "discovery",
    name: "Discovery & User Research",
    description: "Surfaces user workflow bottlenecks, quotes, unmet needs, and feature priority.",
    summary: "User highlighted necessity for zero-bot browser tab audio capture and instant jargon auto-correction.",
    actionItems: [
      "Log feature request for Chrome extension shortcut",
      "Share raw audio sample with ASR team"
    ],
  },
  {
    id: "sprint",
    name: "Sprint Retro",
    description: "Analyzes team velocity, what went well, what fell short, and action items for next sprint.",
    summary: "Velocity increased 25%. Improved build optimization and removed heavy glows for 60fps smooth scroll.",
    actionItems: [
      "Audit bundle size for Next.js route",
      "Automate Colab GPU health check cron job"
    ],
  },
];

export interface TranscriptEntry {
  id: string;
  speaker: string;
  avatarInitials: string;
  timestamp: string;
  verified: boolean;
  rawText: string;
  cleanedText: string;
  highlightedTerm?: string;
  tooltipText?: string;
}

export const DEMO_TRANSCRIPT: TranscriptEntry[] = [
  {
    id: "t1",
    speaker: "Sarhan Qadir",
    avatarInitials: "SQ",
    timestamp: "00:14",
    verified: true,
    rawText: "Team, designs for settings page ready aanu. super base migration script push cheythittund.",
    cleanedText: "Team, designs for settings page ready aanu. Supabase migration script push cheythittund.",
    highlightedTerm: "Supabase migration",
    tooltipText: "Jargon corrected: 'super base' → 'Supabase'",
  },
  {
    id: "t2",
    speaker: "Anjali Nair",
    avatarInitials: "AN",
    timestamp: "00:28",
    verified: true,
    rawText: "Great! Yesterday raise pay sandbox issue undarnnu, but today resolve aayi. figure ma file verify cheyyam.",
    cleanedText: "Great! Yesterday Razorpay Sandbox issue undarnnu, but today resolve aayi. Figma file verify cheyyam.",
    highlightedTerm: "Razorpay Sandbox",
    tooltipText: "Jargon corrected: 'raise pay' → 'Razorpay'",
  },
  {
    id: "t3",
    speaker: "Sarhan Qadir",
    avatarInitials: "SQ",
    timestamp: "00:42",
    verified: true,
    rawText: "Awesome. dashboard deploy cheyyanam today. Sonda Note chrome extension live capture test cheyyam.",
    cleanedText: "Awesome. Dashboard deploy cheyyanam today. Sonda Note Chrome extension live capture test cheyyam.",
    highlightedTerm: "Sonda Note",
    tooltipText: "Verified Brand Name",
  },
];
