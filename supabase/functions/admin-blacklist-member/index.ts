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
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    if (!supabaseUrl || !supabaseServiceKey) throw new Error('Server configuration error');

    // Verify admin
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !userData?.user) throw new Error('UNAUTHORIZED');

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { data: caller } = await supabaseAdmin
      .from('members')
      .select('id, role, name')
      .eq('auth_user_id', userData.user.id)
      .single();

    if (!caller || (caller.role !== 'ADMIN' && caller.role !== 'DEVELOPER')) {
      throw new Error('FORBIDDEN: Admin only');
    }

    const { member_id, email, fb_link, reason } = await req.json();
    if (!email) throw new Error('email required');
    if (!reason) throw new Error('reason required');

    // Add to blacklist (upsert on email)
    const { error: blError } = await supabaseAdmin
      .from('blacklist')
      .upsert({
        email: email.toLowerCase().trim(),
        fb_link: fb_link?.trim() || null,
        reason,
        blacklisted_by: caller.id,
        blacklisted_by_name: caller.name,
      }, { onConflict: 'email' });
    if (blError) throw blError;

    // If member_id provided, mark member as blacklisted + delete auth account
    if (member_id) {
      const { data: member } = await supabaseAdmin
        .from('members')
        .select('id, auth_user_id')
        .eq('id', member_id)
        .single();

      if (member) {
        // Update member status
        await supabaseAdmin
          .from('members')
          .update({ status: 'REMOVED' })
          .eq('id', member_id);

        // Delete auth account so they can't login
        if (member.auth_user_id) {
          await supabaseAdmin.auth.admin.deleteUser(member.auth_user_id);
        }
      }
    }

    // Audit log
    await supabaseAdmin.from('audit_logs').insert({
      actor_id: caller.id,
      actor_name: caller.name,
      actor_role: caller.role,
      action: 'MEMBER_BLACKLISTED',
      target_type: 'member',
      target_member_id: member_id || null,
      details: `Blacklisted: ${email}${fb_link ? ' + FB link' : ''} — ${reason}`,
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
