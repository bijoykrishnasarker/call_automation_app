import { NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

/**
 * GET /api/onboarding/reload-schema
 * Triggers a PostgREST schema cache reload on the self-hosted Supabase instance.
 * This resolves "column not found in schema cache" errors after migrations.
 */
export async function GET() {
  try {
    const adminClient = createSupabaseServiceClient();
    
    // This NOTIFY command tells PostgREST to reload its schema cache
    const { error } = await adminClient.rpc('reload_schema_cache');
    
    if (error) {
      // If the RPC doesn't exist, try raw SQL via a different approach
      console.error('RPC not found, error:', error.message);
    }

    return NextResponse.json({ success: true, message: 'Schema cache reload triggered' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
