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
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { rawToken, password } = await req.json();

    if (!rawToken || !password || password.length < 6) {
      throw new Error('Invalid input');
    }

    // 1. Hash the token
    const encoder = new TextEncoder();
    const data = encoder.encode(rawToken);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const tokenHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

    // 2. Pre-flight check (fail early without lock)
    const { data: tokenRecord, error: tokenError } = await supabaseAdmin
      .from('invite_tokens')
      .select('id, member_id, status, expires_at')
      .eq('token_hash', tokenHash)
      .single();

    if (tokenError || !tokenRecord) throw new Error('INVALID_OR_EXPIRED');

    if (tokenRecord.status !== 'ACTIVE' || new Date(tokenRecord.expires_at) < new Date()) { 
       throw new Error('INVALID_OR_EXPIRED');
    }

    const { data: member, error: memberError } = await supabaseAdmin
      .from('members')
      .select('id, email, auth_user_id, status')
      .eq('id', tokenRecord.member_id)
      .single();

    if (memberError || !member) throw new Error('MEMBER_NOT_FOUND');
    if (member.auth_user_id) throw new Error('ALREADY_LINKED');

    // 3. Create Supabase Auth User (Bypasses handle_new_user using metadata)
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: member.email,
      password: password,
      email_confirm: true,
      user_metadata: { is_invite_consumption: 'true' }
    });

    if (authError) {
      throw new Error('Failed to create auth user: ' + authError.message);
    }

    // 4. Execute Row-Locked Safe Transaction via RPC
    const { data: txResult, error: txError } = await supabaseAdmin.rpc('consume_invite_token_tx', {
      p_token_hash: tokenHash,
      p_auth_uid: authUser.user.id
    });

    if (txError || !txResult.success) {
       // Rollback Auth User if token was consumed concurrently
       await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
       throw new Error(txResult?.reason || 'Transaction failed');
    }

    // 5. Audit
    await supabaseAdmin.from('audit_logs').insert({
      actor_id: member.id,
      actor_name: member.id,
      actor_role: 'MEMBER',
      action: 'INVITE_CONSUMED',
      target_type: 'member',
      target_member_id: member.id,
      details: 'Consumed invite token securely and linked identity'
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
