import { readFile } from 'node:fs/promises';
import { createHmac } from 'node:crypto';
import { resolve } from 'node:path';

const baseUrl = process.env.VAPI_HARNESS_BASE_URL ?? 'http://localhost:3000';
const endpoint = `${baseUrl.replace(/\/$/, '')}/api/vapi/webhook`;
const secret = process.env.VAPI_WEBHOOK_SECRET ?? '';
const signingSecret = process.env.VAPI_WEBHOOK_SIGNING_SECRET ?? '';

const fixtures = [
  'full-data.json',
  'partial-data.json',
  'invalid-time.json',
  'dst-transition.json',
];

async function sendFixture(file) {
  const filePath = resolve(process.cwd(), 'scripts', 'vapi-fixtures', file);
  const raw = await readFile(filePath, 'utf8');
  const headers = {
    'content-type': 'application/json',
    'x-vapi-delivery-id': `harness-${file}`,
    'x-forwarded-proto': 'https',
  };

  if (secret) headers['x-vapi-secret'] = secret;
  if (signingSecret) {
    headers['x-vapi-signature'] = `sha256=${createHmac('sha256', signingSecret).update(raw).digest('hex')}`;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: raw,
  });

  const json = await response.json().catch(() => ({}));
  return {
    fixture: file,
    status: response.status,
    body: json,
  };
}

async function main() {
  const results = [];
  for (const fixture of fixtures) {
    results.push(await sendFixture(fixture));
  }

  for (const result of results) {
    console.log(JSON.stringify(result));
  }

  const failed = results.some(result => result.status >= 500);
  if (failed) process.exit(1);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
