import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClientForUser } from '@/lib/supabase/server';
import { getOrganizationIdForUser } from '@/lib/auth/get-organization-id';

function getAccessToken(request: NextRequest): string | null {
  const auth = request.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.slice(7).trim() || null;
}

export async function GET(request: NextRequest) {
  const accessToken = getAccessToken(request);
  if (!accessToken) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Authentication required' },
      { status: 401 }
    );
  }

  const supabase = createSupabaseClientForUser(accessToken);
  const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !user) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Authentication required' },
      { status: 401 }
    );
  }

  const organizationId = await getOrganizationIdForUser(supabase, user.id);
  if (organizationId === null) {
    return NextResponse.json(
      { error: 'Forbidden', message: 'No organization access' },
      { status: 403 }
    );
  }

  const { data, error } = await supabase
    .from('receptionist_messages')
    .select('id, from_number, customer_name, message, created_at')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.warn('[GET /api/conversations]', error.message);
    return NextResponse.json({ messages: [] });
  }

  return NextResponse.json({ messages: data ?? [] });
}
