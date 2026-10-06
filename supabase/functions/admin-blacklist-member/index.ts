import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// L1: normalize fb_link — trim + strip trailing slashes, so
// "https://facebook.com/x/" and "https://facebook.com/x" match.
function normalizeFbLink(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim().replace(/\/+$/, '');
  return s ? s : null;
}

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

    // L1: normalize BEFORE insert and BEFORE any check.
    const normalizedEmail = String(email || '').toLowerCase().trim();
    const normalizedFbLink = normalizeFbLink(fb_link);

    if (!normalizedEmail) throw new Error('email required');
    if (!reason) throw new Error('reason required');

    // H23 (email path): never blacklist the DEVELOPER account or yourself,
    // even when no member_id is passed.
    const { data: emailOwner } = await supabaseAdmin
      .from('members')
      .select('id, role')
      .ilike('email', normalizedEmail)
      .maybeSingle();
    if (emailOwner && emailOwner.role === 'DEVELOPER') {
      throw new Error('ডেভেলপার অ্যাকাউন্ট ব্ল্যাকলিস্ট করা যাবে না।');
    }
    if (emailOwner && emailOwner.id === caller.id) {
      throw new Error('নিজের অ্যাকাউন্ট ব্ল্যাকলিস্ট করা যাবে না।');
    }

    // C13: idempotent — already blacklisted (and no member action requested)
    // returns success instead of erroring.
    const { data: alreadyBl } = await supabaseAdmin
      .from('blacklist')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();
    if (alreadyBl && !member_id) {
      return new Response(JSON.stringify({ success: true, already_blacklisted: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // H23 target resolution happens BEFORE any write: fetch the member (if any)
    // and refuse DEVELOPER targets and self-targets up front.
    let targetMember: { id: string; role: string; auth_user_id: string | null } | null = null;
    if (member_id) {
      const { data: member } = await supabaseAdmin
        .from('members')
        .select('id, role, auth_user_id')
        .eq('id', member_id)
        .single();
      targetMember = member ?? null;

      if (targetMember) {
        // H23 (member path): refuse DEVELOPER targets and self-targets.
        if (targetMember.role === 'DEVELOPER') {
          throw new Error('ডেভেলপার অ্যাকাউন্ট ব্ল্যাকলিস্ট করা যাবে না।');
        }
        if (targetMember.id === caller.id) {
          throw new Error('নিজের অ্যাকাউন্ট ব্ল্যাকলিস্ট করা যাবে না।');
        }
      }
    }

    // Add to blacklist (upsert on email).
    // C13: onConflict:'email' matches the REAL unique constraint on the
    // plain email column (added by the SQL migration) — the old expression
    // index made this throw on re-blacklist.
    const { error: blError } = await supabaseAdmin
      .from('blacklist')
      .upsert({
        email: normalizedEmail,
        fb_link: normalizedFbLink,
        reason,
        blacklisted_by: caller.id,
        blacklisted_by_name: caller.name,
      }, { onConflict: 'email' });
    if (blError) throw blError;

    // If member_id provided, mark member as blacklisted + delete auth account
    if (targetMember) {
      // Update member status
      await supabaseAdmin
        .from('members')
        .update({ status: 'REMOVED' })
        .eq('id', member_id);

      // Delete auth account so they can't login
      if (targetMember.auth_user_id) {
        await supabaseAdmin.auth.admin.deleteUser(targetMember.auth_user_id);
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
      details: `Blacklisted: ${normalizedEmail}${normalizedFbLink ? ' + FB link' : ''} — ${reason}`,
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
