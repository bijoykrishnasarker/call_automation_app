export function normalizeSpokenEmail(input: string | null | undefined): string | null {
  if (!input) return null;

  let str = input.toLowerCase().trim();

  // convert spoken "@" alternatives
  str = str.replace(/\s+at\s+/g, '@');
  str = str.replace(/\(at\)/g, '@');
  str = str.replace(/\[at\]/g, '@');

  // convert spoken "." alternatives
  str = str.replace(/\s+dot\s+/g, '.');
  str = str.replace(/\(dot\)/g, '.');
  str = str.replace(/\[dot\]/g, '.');

  // normalize common spoken domains
  str = str.replace(/\bg\s*mail\b/g, 'gmail');
  str = str.replace(/\bgee\s*mail\b/g, 'gmail');
  str = str.replace(/\bhot\s*mail\b/g, 'hotmail');
  str = str.replace(/\bout\s*look\b/g, 'outlook');

  // remove spaces around @ and .
  str = str.replace(/\s*@\s*/g, '@');
  str = str.replace(/\s*\.\s*/g, '.');

  // reject if missing @ or domain
  if (!str.includes('@')) return null;
  
  const parts = str.split('@');
  if (parts.length > 2) return null; // reject if multiple @

  const [username, domain] = parts;
  if (!username || !domain) return null;
  if (!domain.includes('.')) return null; // reject if missing domain extension

  if (!isValidEmail(str)) return null;

  return str;
}

export function isValidEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  // Practical email regex
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;

  let str = input.trim();
  str = str.replace(/plus/gi, '+');

  // Strip spaces, hyphens, parentheses, but keep leading + and digits
  let cleaned = '';
  if (str.startsWith('+')) {
    cleaned = '+';
  }
  
  cleaned += str.replace(/[^0-9]/g, '');

  // return null if too short (e.g., less than 7 digits)
  const digitsOnly = cleaned.replace(/\D/g, '');
  if (digitsOnly.length < 7) return null;

  return cleaned;
}

export function extractVapiStructuredData(payload: any): any | null {
  if (!payload || typeof payload !== 'object') return null;

  const candidates = [
    payload.message?.call?.analysis?.structuredData,
    payload.message?.call?.artifact?.structuredOutputs,
    payload.message?.artifact?.structuredOutputs,
    payload.message?.analysis?.structuredData,
    payload.call?.analysis?.structuredData,
    payload.call?.artifact?.structuredOutputs,
    payload.analysis?.structuredData,
    payload.artifact?.structuredOutputs,
  ];

  for (const candidate of candidates) {
    if (candidate && typeof candidate === 'object') {
      if (candidate.result && typeof candidate.result === 'object') {
        return candidate.result;
      }
      return candidate;
    }
  }

  return null;
}

export function buildContactFromVapiPayload(payload: any) {
  const structuredData = extractVapiStructuredData(payload) || {};
  const message = payload.message || {};
  
  // Try to find missing fields either from payload or calculate from structured data
  const emailSpoken = structuredData.emailSpoken || structuredData.customerEmailSpoken || null;
  const rawEmail = structuredData.email || structuredData.customerEmail || emailSpoken;
  
  const normalizedEmail = normalizeSpokenEmail(rawEmail);
  const fullName = structuredData.fullName || structuredData.customerName || null;
  const rawPhone = structuredData.phone || structuredData.customerPhone || message.customer?.number || null;
  const phone = normalizePhone(rawPhone);
  
  const emailConfirmed = Boolean(structuredData.emailConfirmed);
  
  const requestedService = structuredData.requestedService || null;
  const preferredDate = structuredData.preferredDate || null;
  const preferredTime = structuredData.preferredTime || null;
  const msg = structuredData.message || null;
  const callReason = structuredData.callReason || null;

  let missingFields: string[] = [];
  if (Array.isArray(structuredData.missingFields)) {
    missingFields = structuredData.missingFields;
  }

  if (!fullName) missingFields.push('fullName');
  if (!phone) missingFields.push('phone');
  if (!normalizedEmail) missingFields.push('email');
  if (!emailConfirmed) missingFields.push('emailConfirmed');

  missingFields = Array.from(new Set(missingFields));

  const needsHumanReview = missingFields.length > 0 || !emailConfirmed;
  const contactComplete = Boolean(fullName && phone && normalizedEmail && emailConfirmed);

  return {
    fullName,
    phone,
    email:   needsHumanReview && !normalizedEmail ? null : normalizedEmail,
    emailSpoken,
    emailConfirmed,
    requestedService,
    preferredDate,
    preferredTime,
    message: msg,
    callReason,
    contactComplete,
    needsHumanReview,
    missingFields,
    rawStructuredData: structuredData
  };
}
