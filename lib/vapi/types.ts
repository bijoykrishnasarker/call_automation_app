export interface CanonicalValidationIssue {
  path: string;
  code: string;
  message: string;
}

export interface CanonicalAuthContext {
  mode: 'off' | 'optional' | 'required';
  verified: boolean;
  method: 'shared-secret' | 'signature' | 'none';
  status: 'accepted' | 'skipped' | 'failed';
  reason?: string;
  header_trace: Record<string, string | null>;
}

export interface CanonicalContactProjection {
  external_contact_id: string;
  first_name: string;
  last_name: string;
  middle_name: string | null;
  email: string | null;
  primary_phone: string;
  mobile_phone: string | null;
  company: string | null;
  job_title: string | null;
  source: string;
  notes: string | null;
  created_at: string;
}

export interface CanonicalAppointmentProjection {
  external_appointment_id: string;
  contact_external_id: string;
  start_time_utc: string;
  end_time_utc: string;
  date: string;
  timezone: string;
  duration_minutes: number;
  subject: string;
  location: string | null;
  calendar_id: string | null;
  recurrence: Record<string, unknown> | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CanonicalToolCall {
  id: string;
  name: 'take_message' | 'check_availability' | 'book_appointment' | string;
  arguments: Record<string, unknown>;
  validation_errors: CanonicalValidationIssue[];
  warnings: string[];
  contact: CanonicalContactProjection | null;
  appointment: CanonicalAppointmentProjection | null;
  message_text: string | null;
  availability_request:
    | {
        requested_start_at: string;
        requested_end_at: string | null;
        duration_minutes: number;
        timezone: string;
      }
    | null;
}

export interface CanonicalVapiWebhookEnvelope {
  provider: 'vapi';
  provider_event_type: string;
  provider_delivery_id: string;
  provider_call_id: string | null;
  provider_assistant_id: string | null;
  organization_id: string | null;
  occurred_at: string;
  received_at: string;
  raw_payload: Record<string, unknown>;
  raw_payload_sha256: string;
  auth_context: CanonicalAuthContext;
  contact: CanonicalContactProjection | null;
  appointment: CanonicalAppointmentProjection | null;
  trace: Record<string, string[]>;
  validation_errors: CanonicalValidationIssue[];
  warnings: string[];
  tool_calls: CanonicalToolCall[];
  transcript_text: string | null;
  call_direction: 'inbound' | 'outbound';
  call_status: string | null;
  call_started_at: string | null;
  call_ended_at: string | null;
  from_number: string | null;
  to_number: string | null;
}

export interface VapiWebhookResponse {
  status: number;
  body: Record<string, unknown>;
}

export interface ProjectionDecision {
  outcome: 'created' | 'updated' | 'noop' | 'conflict';
  detail?: Record<string, unknown>;
}
