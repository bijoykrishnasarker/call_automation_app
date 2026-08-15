/**
 * Client-side API for AI receptionist settings.
 * Requires Supabase session access_token for Authorization header.
 */

export interface AiReceptionistSettingsRow {
  id: string;
  organization_id: string;
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
  created_at: string;
  updated_at: string;
}

export interface GetSettingsResponse {
  settings: AiReceptionistSettingsRow | null;
  /** Primary line from `vapi_phone_numbers` (read-only display). */
  connected_phone_number: string | null;
  vapi_assistant_id: string | null;
  webhook_url: string | null;
  calendar_tools_connected: boolean;
  last_synced_at: string | null;
}

export interface PostSettingsBody {
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

export async function fetchAiReceptionistSettings(
  accessToken: string
): Promise<GetSettingsResponse> {
  const res = await fetch('/api/ai-receptionist/settings', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { message?: string }).message ?? res.statusText);
  }
  return res.json();
}

export async function saveAiReceptionistSettings(
  accessToken: string,
  body: PostSettingsBody
): Promise<{ settings: AiReceptionistSettingsRow }> {
  const res = await fetch('/api/ai-receptionist/settings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { message?: string }).message ?? res.statusText);
  }
  return data as { settings: AiReceptionistSettingsRow };
}
