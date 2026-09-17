import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify caller is admin or developer
    const { data: userData, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !userData.user) {
      throw new Error('Unauthorized');
    }

    const { data: callerData } = await supabaseAdmin
      .from('members')
      .select('role, id')
      .eq('auth_user_id', userData.user.id)
      .single();

    if (!callerData || (callerData.role !== 'ADMIN' && callerData.role !== 'DEVELOPER')) {
      throw new Error('Forbidden: Only Admins can revoke invites');
    }

    const { tokenId } = await req.json();

    if (!tokenId) {
      throw new Error('Missing required field: tokenId');
    }

    // 1. Fetch Token
    const { data: tokenRecord, error: tokenError } = await supabaseAdmin
      .from('invite_tokens')
      .select('id, status, member_id')
      .eq('id', tokenId)
      .single();

    if (tokenError || !tokenRecord) throw new Error('Token not found');

    if (tokenRecord.status !== 'ACTIVE') {
      throw new Error(`Cannot revoke token in ${tokenRecord.status} state`);
    }

    // 2. Mark Revoked
    const { error: updateError } = await supabaseAdmin
      .from('invite_tokens')
      .update({
        status: 'REVOKED',
        revoked_at: new Date().toISOString()
      })
      .eq('id', tokenId);

    if (updateError) throw updateError;

    // 3. Audit Log
    await supabaseAdmin.from('audit_logs').insert({
      actor_id: callerData.id,
      actor_name: callerData.id,
      actor_role: callerData.role,
      action: 'INVITE_REVOKED',
      target_type: 'member',
      target_member_id: tokenRecord.member_id,
      details: 'Revoked invite token'
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
