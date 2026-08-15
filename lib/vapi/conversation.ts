export function normalizePhone(raw: unknown): string {
  if (raw == null) return '';
  const value = typeof raw === 'string' ? raw : String(raw);
  const trimmed = value.trim();
  if (!trimmed || /[a-zA-Z]/.test(trimmed)) return '';

  const digits = trimmed.replace(/\D/g, '');
  if (!digits || digits.length < 7 || digits.length > 15) return '';
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  // Bangladesh local numbers: 01XXXXXXXXX
  if (digits.length === 11 && digits.startsWith('01')) return `+88${digits}`;
  if (digits.length === 13 && digits.startsWith('880')) return `+${digits}`;
  return `+${digits}`;
}

export function gatherConversationText(message: Record<string, any> | undefined, body: Record<string, any>): string {
  const parts: string[] = [];
  const push = (value: unknown) => {
    if (typeof value === 'string' && value.trim()) {
      parts.push(value.trim());
    }
  };

  const rawMessages = body.message;
  if (Array.isArray(rawMessages)) {
    for (const item of rawMessages) {
      const artifactMessages = item?.artifact?.messages;
      if (Array.isArray(artifactMessages)) {
        for (const row of artifactMessages) push(row?.message);
      }
      push(item?.transcript);
      push(item?.analysis?.summary);
      push(item?.summary);
    }
  }

  const messageArtifact = message?.artifact?.messages;
  if (Array.isArray(messageArtifact)) {
    for (const row of messageArtifact) push(row?.message);
  }

  push(body.transcript);
  push(message?.transcript);
  push(body.analysis?.summary);
  push(message?.analysis?.summary);
  push(body.summary);
  push(message?.summary);

  return parts.join('\n');
}

export function extractNameFromConversation(text: string): string | undefined {
  const patterns = [
    /\bmy name is\s+([A-Za-z][A-Za-z\s'.\-]*)/i,
    /\bI am\s+([A-Za-z][A-Za-z\s'.\-]*)/i,
    /\bI'm\s+([A-Za-z][A-Za-z\s'.\-]*)/i,
    /\bthis is\s+([A-Za-z][A-Za-z\s'.\-]*)/i,
    /\bcustomer(?:'s)?\s+name(?:\s+is)?:?\s+([A-Za-z][A-Za-z\s'.\-]*)/i,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (!match?.[1]) continue;
    const cleaned = match[1].trim().replace(/\s+/g, ' ').replace(/[.!?,;:]+$/, '');
    if (cleaned.length >= 2) return cleaned;
  }

  return undefined;
}

export function extractEmailFromConversation(text: string): string | undefined {
  const directMatch = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/.exec(text);
  if (directMatch?.[0]) return directMatch[0].toLowerCase();

  const spokenPatterns = [
    /\b([a-zA-Z0-9._%+\-]+)\s+(?:at\s+the\s+rate\s+of|at)\s+([a-zA-Z0-9.\-]+)\s+dot\s+([a-zA-Z]{2,})/i,
    /\bemail[,:]?\s+([a-zA-Z0-9._%+\-]+)\s+at\s+([a-zA-Z0-9.\-]+)\s+dot\s+([a-zA-Z]{2,})/i,
  ];

  for (const pattern of spokenPatterns) {
    const match = pattern.exec(text);
    if (!match) continue;
    const email = `${match[1]!.trim().toLowerCase()}@${match[2]!.trim().toLowerCase()}.${match[3]!.trim().toLowerCase()}`;
    if (/^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/.test(email)) return email;
  }

  return undefined;
}

export function extractPhoneFromConversation(text: string): string | undefined {
  const patterns = [
    /phone\s*(?:number)?\s*(?:is)?[,:]?\s*(\+?[\d\s\-().]{7,20})/i,
    /(?:my|the)\s+(?:phone\s+)?number\s+is\s*(\+?[\d\s\-().]{7,20})/i,
    /(?:call|reach|contact)\s+(?:me\s+)?(?:at|on)\s*(\+?[\d\s\-().]{7,20})/i,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (!match?.[1]) continue;
    const digitsOnly = match[1].trim().replace(/[^\d+]/g, '');
    if (digitsOnly.length >= 7 && digitsOnly.length <= 15) return digitsOnly;
  }

  const standaloneMatch = /\b(\d{10,15})\b/.exec(text.replace(/\s+/g, ''));
  return standaloneMatch?.[1];
}

export interface TranscriptAppointmentGuess {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  durationMinutes: number;
}

export function parseAppointmentFromConversation(
  text: string,
  referenceDate: Date
): TranscriptAppointmentGuess | null {
  const lower = text.replace(/\s+/g, ' ').toLowerCase();
  if (!/\b(appointment|book|booking|schedule|scheduled|reservation)\b/i.test(lower)) return null;

  const monthNames: Record<string, number> = {
    january: 1, jan: 1,
    february: 2, feb: 2,
    march: 3, mar: 3,
    april: 4, apr: 4,
    may: 5,
    june: 6, jun: 6,
    july: 7, jul: 7,
    august: 8, aug: 8,
    september: 9, sep: 9, sept: 9,
    october: 10, oct: 10,
    november: 11, nov: 11,
    december: 12, dec: 12,
  };

  const monthPattern = Object.keys(monthNames).sort((a, b) => b.length - a.length).join('|');
  const monthDay = new RegExp(`\\b(${monthPattern})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`, 'i');
  const dayMonth = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${monthPattern})\\b`, 'i');

  let month: number | null = null;
  let day: number | null = null;

  const monthDayMatch = monthDay.exec(text);
  if (monthDayMatch) {
    month = monthNames[monthDayMatch[1]!.toLowerCase()] ?? null;
    day = Number(monthDayMatch[2]);
  }

  if (month === null || day === null) {
    const dayMonthMatch = dayMonth.exec(text);
    if (dayMonthMatch) {
      day = Number(dayMonthMatch[1]);
      month = monthNames[dayMonthMatch[2]!.toLowerCase()] ?? null;
    }
  }

  if (month === null || day === null || day < 1 || day > 31) return null;

  let year = referenceDate.getUTCFullYear();
  const candidate = Date.UTC(year, month - 1, day);
  if (candidate < referenceDate.getTime() - 2 * 24 * 60 * 60 * 1000) {
    year += 1;
  }

  let hour = 9;
  let minute = 0;
  const atHour = /\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?/i.exec(text);
  if (atHour) {
    hour = Number(atHour[1]);
    minute = Number(atHour[2] ?? '0');
    const suffix = atHour[3]?.replace(/\./g, '').toLowerCase();
    if (suffix?.startsWith('p') && hour < 12) hour += 12;
    if (suffix?.startsWith('a') && hour === 12) hour = 0;
    if (!suffix && hour >= 1 && hour <= 7) hour += 12;
  } else {
    const timeMeridiem = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)/i.exec(text);
    if (timeMeridiem) {
      hour = Number(timeMeridiem[1]);
      minute = Number(timeMeridiem[2] ?? '0');
      const meridiem = timeMeridiem[3]!.replace(/\./g, '').toLowerCase();
      if (meridiem.startsWith('p') && hour < 12) hour += 12;
      if (meridiem.startsWith('a') && hour === 12) hour = 0;
    } else {
      const time24h = /\b(1\d|2[0-3]|\d):(\d{2})\b/.exec(text);
      if (time24h) {
        hour = Number(time24h[1]);
        minute = Number(time24h[2]);
      }
    }
  }

  const durationMatch = /\b(\d{1,3})\s*(minute|minutes|min)\b/i.exec(text);
  const durationMinutes = durationMatch ? Number(durationMatch[1]) : 60;

  return { year, month, day, hour, minute, durationMinutes };
}

export function splitFullName(name: string | undefined): {
  firstName: string;
  lastName: string;
  middleName: string | null;
} {
  const safe = (name ?? '').trim().replace(/\s+/g, ' ');
  if (!safe) {
    return {
      firstName: 'Unknown',
      lastName: 'Caller',
      middleName: null,
    };
  }

  const parts = safe.split(' ');
  if (parts.length === 1) {
    return {
      firstName: parts[0]!,
      lastName: 'Caller',
      middleName: null,
    };
  }

  if (parts.length === 2) {
    return {
      firstName: parts[0]!,
      lastName: parts[1]!,
      middleName: null,
    };
  }

  return {
    firstName: parts[0]!,
    lastName: parts[parts.length - 1]!,
    middleName: parts.slice(1, -1).join(' ') || null,
  };
}

export function pickFirstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}
