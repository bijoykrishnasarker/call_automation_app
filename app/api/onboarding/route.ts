import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServiceClient, createSupabaseClientForUser } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { businessName, email, accessToken } = body;

    if (!businessName || !accessToken) {
      return NextResponse.json(
        { error: 'Missing businessName or accessToken' },
        { status: 400 }
      );
    }

    // Basic server-side email format check
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      return NextResponse.json(
        { error: 'Invalid email format. Please use a valid address like you@example.com' },
        { status: 400 }
      );
    }

    // Verify the user's token to get their user ID
    const userClient = createSupabaseClientForUser(accessToken);
    const { data: { user }, error: userError } = await userClient.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized: invalid session' },
        { status: 401 }
      );
    }

    // Use service role client to bypass RLS and schema cache issues
    const adminClient = createSupabaseServiceClient();

    // Check if user already has a profile/organization
    const { data: existingProfile } = await adminClient
      .from('profiles')
      .select('id, organization_id')
      .eq('id', user.id)
      .maybeSingle();

    if (existingProfile?.organization_id) {
      return NextResponse.json({ success: true, alreadyExists: true });
    }

    // 1. Create Organization
    const { data: org, error: orgError } = await adminClient
      .from('organizations')
      .insert({
        name: businessName,
        owner_user_id: user.id,
      })
      .select()
      .single();

    if (orgError) {
      console.error('Error creating organization:', orgError);
      return NextResponse.json(
        { error: `Failed to create organization: ${orgError.message}` },
        { status: 500 }
      );
    }

    // 2. Create Profile
    const { error: profileError } = await adminClient
      .from('profiles')
      .upsert({
        id: user.id,
        organization_id: org.id,
        role: 'owner',
      });

    if (profileError) {
      console.error('Error creating profile:', profileError);
      return NextResponse.json(
        { error: `Failed to create profile: ${profileError.message}` },
        { status: 500 }
      );
    }

    // 3. Create default pipeline
    const { data: pipeline, error: pipeError } = await adminClient
      .from('pipelines')
      .insert({
        user_id: user.id,
        name: 'Main Sales Pipeline',
      })
      .select()
      .single();

    if (!pipeError && pipeline) {
      await adminClient.from('pipeline_stages').insert([
        { pipeline_id: pipeline.id, name: 'New Lead', color: '#3b82f6', position: 0 },
        { pipeline_id: pipeline.id, name: 'Contacted', color: '#8b5cf6', position: 1 },
        { pipeline_id: pipeline.id, name: 'Qualified', color: '#f59e0b', position: 2 },
        { pipeline_id: pipeline.id, name: 'Proposal Sent', color: '#10b981', position: 3 },
        { pipeline_id: pipeline.id, name: 'Closed Won', color: '#059669', position: 4 },
      ]);
    }

    return NextResponse.json({ success: true, organizationId: org.id });
  } catch (err: any) {
    console.error('Onboarding API error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
