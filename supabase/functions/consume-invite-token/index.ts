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

    // 2. Fetch token and member
    const { data: tokenRecord, error: tokenError } = await supabaseAdmin
      .from('invite_tokens')
      .select('id, member_id, status, expires_at')
      .eq('token_hash', tokenHash)
      .single();

    if (tokenError || !tokenRecord) throw new Error('INVALID_OR_EXPIRED');

    if (tokenRecord.status !== 'ACTIVE' || new Date(tokenRecord.expires_at) < new Date()) {
       await supabaseAdmin.from('invite_tokens').update({ status: 'EXPIRED' }).eq('id', tokenRecord.id);
       throw new Error('INVALID_OR_EXPIRED');
    }

    const { data: member, error: memberError } = await supabaseAdmin
      .from('members')
      .select('id, email, auth_user_id, status')
      .eq('id', tokenRecord.member_id)
      .single();

    if (memberError || !member) throw new Error('Member not found');
    if (member.auth_user_id) throw new Error('Account already setup');

    // 3. Create Supabase Auth User (auto-confirmed since it's an admin invite)
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: member.email,
      password: password,
      email_confirm: true // Bypass email confirm since they got it via a secure channel
    });

    if (authError) {
      // If it says already exists, we might need to handle it or block.
      throw new Error('Failed to create auth user: ' + authError.message);
    }

    // 4. Update member and token in parallel
    const { error: updateError } = await supabaseAdmin
      .from('members')
      .update({
        auth_user_id: authUser.user.id
        // Keep status PENDING as required by constraints
      })
      .eq('id', member.id);

    if (updateError) {
       // Cleanup orphaned auth user on fail
       await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
       throw updateError;
    }

    await supabaseAdmin
      .from('invite_tokens')
      .update({ status: 'USED', used_at: new Date().toISOString() })
      .eq('id', tokenRecord.id);

    // Audit
    await supabaseAdmin.from('audit_logs').insert({
      actor_id: member.id, // We just mapped it
      actor_name: member.id,
      actor_role: 'MEMBER',
      action: 'INVITE_CONSUMED',
      target_type: 'member',
      target_member_id: member.id,
      details: 'Consumed invite token and set password'
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
