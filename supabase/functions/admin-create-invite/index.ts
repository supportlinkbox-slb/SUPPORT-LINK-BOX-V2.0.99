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
      throw new Error('Forbidden: Only Admins can create invites');
    }

    const { email, facebookUrl, facebookName, profilePhotoUrl, facebookIdentityKey, facebookIdentityType, expiresInHours = 48 } = await req.json();

    if (!email || !facebookIdentityKey) {
      throw new Error('Missing required fields');
    }

    // 1. Check Duplicates (Email & FB)
    const { data: existingFB } = await supabaseAdmin
      .from('members')
      .select('id')
      .eq('facebook_identity_key', facebookIdentityKey)
      .eq('facebook_identity_type', facebookIdentityType)
      .maybeSingle();

    if (existingFB) throw new Error('DUPLICATE_FACEBOOK');

    const { data: existingEmail } = await supabaseAdmin
      .from('members')
      .select('id')
      .ilike('email', email)
      .maybeSingle();

    if (existingEmail) throw new Error('DUPLICATE_EMAIL');

    // 2. Generate Member Number
    const { data: memberNumber, error: seqError } = await supabaseAdmin.rpc('generate_member_number_secure');
    if (seqError) throw new Error('Error generating member number');

    // 3. Create Member Profile (PENDING)
    const { data: newMember, error: memberError } = await supabaseAdmin
      .from('members')
      .insert({
        member_number: memberNumber,
        email: email,
        name: facebookName,
        facebook_name: facebookName,
        facebook_name_original: facebookName,
        facebook_url: facebookUrl,
        facebook_profile_url: facebookUrl,
        facebook_identity_key: facebookIdentityKey,
        facebook_identity_type: facebookIdentityType,
        profile_photo_url: profilePhotoUrl,
        role: 'MEMBER',
        status: 'PENDING',
      })
      .select('id')
      .single();

    if (memberError) throw memberError;

    // 4. Generate Crypto Secure Token
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const rawToken = Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');

    // Hash the token
    const encoder = new TextEncoder();
    const data = encoder.encode(rawToken);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const tokenHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

    // 5. Store Token
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiresInHours);

    const { error: tokenError } = await supabaseAdmin
      .from('invite_tokens')
      .insert({
        token_hash: tokenHash,
        member_id: newMember.id,
        created_by: callerData.id,
        expires_at: expiresAt.toISOString(),
        status: 'ACTIVE'
      });

    if (tokenError) throw tokenError;

    // Audit Log
    await supabaseAdmin.from('audit_logs').insert({
      actor_id: callerData.id,
      actor_name: callerData.id,
      actor_role: callerData.role,
      action: 'INVITE_CREATED',
      target_type: 'member',
      target_member_id: newMember.id,
      details: 'Created invite token for ' + email
    });

    return new Response(JSON.stringify({ success: true, rawToken, memberNumber }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
