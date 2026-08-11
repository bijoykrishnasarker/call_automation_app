import { VapiClient } from '@vapi-ai/server-sdk';

// Backend calls to Vapi must always use the **private** API key.
// This should be configured as VAPI_PRIVATE_KEY in the environment.
const token = process.env.VAPI_PRIVATE_KEY;

if (!token) {
  // Fail fast on the server if the key is missing so misconfiguration is obvious.
  throw new Error('VAPI_PRIVATE_KEY is not set');
}

// VapiClient will send this token as a Bearer Authorization header on all requests.
export const vapi = new VapiClient({ token });

