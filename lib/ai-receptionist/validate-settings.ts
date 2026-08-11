import type { ValidateSettingsResult, NormalizedPayload } from './types';

const AGENT_NAME_MAX_LENGTH = 128;
const VOICE_MAX_LENGTH = 64;
const SPEED_MIN = 0.5;
const SPEED_MAX = 2;

const SERVICES_MAX_ITEMS = 50;
const SERVICE_ITEM_MAX_LENGTH = 200;
const ADDITIONAL_BUSINESS_INFO_MAX = 10000;
const GREETING_MESSAGE_MAX = 2000;

/**
 * Normalize US phone to E.164: +1 + 10 digits.
 * Returns null if input is blank. Throws if invalid (non-numeric or wrong length).
 */
function normalizeLiveTransferNumber(value: string | null | undefined): string | null {
  if (value == null || value === '') return null;
  const trimmed = String(value).trim();
  if (trimmed === '') return null;
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 0) return null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null; // invalid length -> treat as validation error below
}

/**
 * Normalize services for storage (settings API and Vapi sync).
 * Returns an error message if the shape is invalid; otherwise the trimmed list.
 */
export function normalizeServicesInput(raw: unknown): { ok: true; services: string[] } | { ok: false; message: string } {
  if (raw === undefined || raw === null) {
    return { ok: true, services: [] };
  }
  if (!Array.isArray(raw)) {
    return { ok: false, message: 'services must be an array of strings' };
  }
  if (raw.length > SERVICES_MAX_ITEMS) {
    return { ok: false, message: `services must have at most ${SERVICES_MAX_ITEMS} items` };
  }
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') {
      return { ok: false, message: 'each service must be a string' };
    }
    const t = item.trim();
    if (!t) continue;
    if (t.length > SERVICE_ITEM_MAX_LENGTH) {
      return { ok: false, message: `each service must be at most ${SERVICE_ITEM_MAX_LENGTH} characters` };
    }
    out.push(t);
  }
  return { ok: true, services: out };
}

export function validateSettings(body: unknown): ValidateSettingsResult {
  if (body == null || typeof body !== 'object') {
    return { valid: false, message: 'Request body must be a JSON object' };
  }

  const b = body as Record<string, unknown>;

  // Booleans: accept only true/false
  if (typeof b.is_enabled !== 'boolean') {
    return { valid: false, message: 'is_enabled must be a boolean' };
  }
  if (typeof b.answer_after_hours_only !== 'boolean') {
    return { valid: false, message: 'answer_after_hours_only must be a boolean' };
  }

  // agent_name: required, non-empty after trim, max 128
  const agentName = typeof b.agent_name === 'string' ? b.agent_name.trim() : '';
  if (!agentName) {
    return { valid: false, message: 'agent_name is required' };
  }
  if (agentName.length > AGENT_NAME_MAX_LENGTH) {
    return { valid: false, message: `agent_name must be at most ${AGENT_NAME_MAX_LENGTH} characters` };
  }

  // voice: required, non-empty, max 64
  const voice = typeof b.voice === 'string' ? b.voice.trim() : '';
  if (!voice) {
    return { valid: false, message: 'voice is required' };
  }
  if (voice.length > VOICE_MAX_LENGTH) {
    return { valid: false, message: `voice must be at most ${VOICE_MAX_LENGTH} characters` };
  }

  // speed: required number, 0.5–2
  const speed = Number(b.speed);
  if (Number.isNaN(speed) || typeof b.speed === 'string') {
    return { valid: false, message: 'speed must be a number' };
  }
  if (speed < SPEED_MIN || speed > SPEED_MAX) {
    return { valid: false, message: `speed must be between ${SPEED_MIN} and ${SPEED_MAX}` };
  }

  // live_transfer_number: optional; if provided, normalize to US E.164 or fail
  const rawPhone = b.live_transfer_number;
  const phoneValue =
    rawPhone == null ? null : typeof rawPhone === 'string' ? rawPhone : String(rawPhone);
  const liveTransferNumber = normalizeLiveTransferNumber(phoneValue);
  if (phoneValue != null && phoneValue !== '' && (phoneValue as string).trim() !== '' && liveTransferNumber === null) {
    return { valid: false, message: 'live_transfer_number must be a valid US phone number (10 or 11 digits)' };
  }

  // Extended fields — all optional, with safe defaults
  const businessName = typeof b.business_name === 'string' ? b.business_name.trim() || null : null;
  const businessType = typeof b.business_type === 'string' ? b.business_type.trim() || null : null;
  const businessAddress = typeof b.business_address === 'string' ? b.business_address.trim() || null : null;
  const businessHours = typeof b.business_hours === 'string' ? b.business_hours.trim() || null : null;
  const canAnswerQuestions = b.can_answer_questions !== false;
  const canTakeMessages = b.can_take_messages !== false;
  const canBookAppointments = Boolean(b.can_book_appointments);
  const transferUrgentCalls = Boolean(b.transfer_urgent_calls);

  const servicesResult = normalizeServicesInput(b.services);
  if (servicesResult.ok === false) {
    return { valid: false, message: servicesResult.message };
  }
  const services = servicesResult.services;

  let additionalBusinessInfo: string | null = null;
  if (b.additional_business_info != null) {
    if (typeof b.additional_business_info !== 'string') {
      return { valid: false, message: 'additional_business_info must be a string' };
    }
    const t = b.additional_business_info.trim();
    if (t.length > ADDITIONAL_BUSINESS_INFO_MAX) {
      return {
        valid: false,
        message: `additional_business_info must be at most ${ADDITIONAL_BUSINESS_INFO_MAX} characters`,
      };
    }
    additionalBusinessInfo = t || null;
  }

  let greetingMessage: string | null = null;
  if (b.greeting_message != null) {
    if (typeof b.greeting_message !== 'string') {
      return { valid: false, message: 'greeting_message must be a string' };
    }
    const t = b.greeting_message.trim();
    if (t.length > GREETING_MESSAGE_MAX) {
      return { valid: false, message: `greeting_message must be at most ${GREETING_MESSAGE_MAX} characters` };
    }
    greetingMessage = t || null;
  }

  const normalized: NormalizedPayload = {
    is_enabled: b.is_enabled,
    agent_name: agentName,
    voice,
    speed,
    live_transfer_number: liveTransferNumber,
    answer_after_hours_only: b.answer_after_hours_only,
    business_name: businessName,
    business_type: businessType,
    business_address: businessAddress,
    business_hours: businessHours,
    can_answer_questions: canAnswerQuestions,
    can_take_messages: canTakeMessages,
    can_book_appointments: canBookAppointments,
    transfer_urgent_calls: transferUrgentCalls,
    services,
    additional_business_info: additionalBusinessInfo,
    greeting_message: greetingMessage,
  };

  return { valid: true, normalized };
}
