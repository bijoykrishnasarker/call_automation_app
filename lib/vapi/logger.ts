type LogLevel = 'info' | 'warn' | 'error';

function write(level: LogLevel, event: string, fields: Record<string, unknown>) {
  const payload = {
    event,
    level,
    timestamp: new Date().toISOString(),
    ...fields,
  };

  if (level === 'error') {
    console.error(JSON.stringify(payload));
    return;
  }

  if (level === 'warn') {
    console.warn(JSON.stringify(payload));
    return;
  }

  console.info(JSON.stringify(payload));
}

export function logVapiInfo(event: string, fields: Record<string, unknown>) {
  write('info', event, fields);
}

export function logVapiWarn(event: string, fields: Record<string, unknown>) {
  write('warn', event, fields);
}

export function logVapiError(event: string, fields: Record<string, unknown>) {
  write('error', event, fields);
}

export function recordVapiMetric(name: string, value: number, fields: Record<string, unknown> = {}) {
  write('info', 'vapi.metric', {
    metric_name: name,
    metric_value: value,
    ...fields,
  });
}
