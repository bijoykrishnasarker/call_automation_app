/** API response: GET /api/ai-receptionist/settings */
export interface AiReceptionistSettingsResponse {
  settings: AiReceptionistSettingsRow | null;
  /** Primary org line from `vapi_phone_numbers`; not stored on `ai_receptionists`. */
  connected_phone_number: string | null;
}

/**
 * DB row shape (snake_case) as returned from Supabase.
 * live_transfer_number: blank input is stored as null; valid US input is stored as E.164 (e.g. +15551234567).
 * services: JSON array of strings from `services` jsonb column.
 */
export interface AiReceptionistSettingsRow {
  id: string;
  organization_id: string;
  is_enabled: boolean;
  agent_name: string;
  voice: string;
  speed: number;
  /** null when blank/empty; US E.164 string when set (e.g. +15551234567) */
  live_transfer_number: string | null;
  answer_after_hours_only: boolean;
  business_name: string | null;
  business_type: string | null;
  business_address: string | null;
  business_hours: string | null;
  can_answer_questions: boolean;
  can_take_messages: boolean;
  can_book_appointments: boolean;
  transfer_urgent_calls: boolean;
  /** Stored as jsonb array of strings */
  services: string[];
  additional_business_info: string | null;
  greeting_message: string | null;
  created_at: string;
  updated_at: string;
}

/** Column list for SELECT; use for explicit projection and consistent response shape */
export const AI_RECEPTIONIST_SELECT_COLUMNS = [
  'id',
  'organization_id',
  'is_enabled',
  'agent_name',
  'voice',
  'speed',
  'live_transfer_number',
  'answer_after_hours_only',
  'business_name',
  'business_type',
  'business_address',
  'business_hours',
  'can_answer_questions',
  'can_take_messages',
  'can_book_appointments',
  'transfer_urgent_calls',
  'services',
  'additional_business_info',
  'greeting_message',
  'created_at',
  'updated_at',
] as const;

/** Same as above but without Services & Knowledge / greeting columns (older DBs). */
export const AI_RECEPTIONIST_SELECT_COLUMNS_LEGACY = [
  'id',
  'organization_id',
  'is_enabled',
  'agent_name',
  'voice',
  'speed',
  'live_transfer_number',
  'answer_after_hours_only',
  'business_name',
  'business_type',
  'business_address',
  'business_hours',
  'can_answer_questions',
  'can_take_messages',
  'can_book_appointments',
  'transfer_urgent_calls',
  'created_at',
  'updated_at',
] as const;

/** POST body from frontend */
export interface AiReceptionistSettingsPayload {
  is_enabled: boolean;
  agent_name: string;
  voice: string;
  speed: number;
  live_transfer_number: string;
  answer_after_hours_only: boolean;
  business_name?: string;
  business_type?: string;
  business_address?: string;
  business_hours?: string;
  can_answer_questions?: boolean;
  can_take_messages?: boolean;
  can_book_appointments?: boolean;
  transfer_urgent_calls?: boolean;
  services?: string[];
  additional_business_info?: string | null;
  greeting_message?: string | null;
}

/** Validation result */
export interface ValidationResult {
  valid: true;
  normalized: NormalizedPayload;
}

export interface ValidationError {
  valid: false;
  message: string;
}

export type ValidateSettingsResult = ValidationResult | ValidationError;

/** After validation: live_transfer_number is E.164 string or null */
export interface NormalizedPayload {
  is_enabled: boolean;
  agent_name: string;
  voice: string;
  speed: number;
  live_transfer_number: string | null;
  answer_after_hours_only: boolean;
  business_name: string | null;
  business_type: string | null;
  business_address: string | null;
  business_hours: string | null;
  can_answer_questions: boolean;
  can_take_messages: boolean;
  can_book_appointments: boolean;
  transfer_urgent_calls: boolean;
  services: string[];
  additional_business_info: string | null;
  greeting_message: string | null;
}
