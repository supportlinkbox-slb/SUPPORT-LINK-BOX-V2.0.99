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

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Server configuration error' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { identifier, password } = await req.json();

    if (!identifier || typeof identifier !== 'string' || !password || typeof password !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: 'Email/Member ID এবং Password প্রদান করুন।' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const trimmedId = identifier.trim();
    if (!trimmedId || !password) {
      return new Response(
        JSON.stringify({ success: false, error: 'Email/Member ID এবং Password প্রদান করুন।' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // 1. Server-Side Identifier Resolution (Member ID -> Email or Email -> Email)
    let email = trimmedId.toLowerCase();
    if (!trimmedId.includes('@')) {
      const { data: resolvedEmail, error: resolveErr } = await supabaseAdmin.rpc('get_email_by_identifier', {
        p_identifier: trimmedId,
      });

      if (resolveErr || !resolvedEmail) {
        return new Response(
          JSON.stringify({ success: false, error: 'ভুল Email/Member ID অথবা Password।' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }
      email = String(resolvedEmail).toLowerCase().trim();
    }

    // 2. Server-Authoritative 30-Minute Freeze / Lock Check
    const { data: statusCheck } = await supabaseAdmin.rpc('check_login_status', { p_email: email });

    if (statusCheck && statusCheck.allowed === false) {
      const lockTime = statusCheck.locked_until
        ? new Date(statusCheck.locked_until).toLocaleTimeString()
        : '30 মিনিট';
      return new Response(
        JSON.stringify({
          success: false,
          error: `অ্যাকাউন্ট সাময়িকভাবে লক করা হয়েছে। আবার চেষ্টা করুন: ${lockTime}`,
          locked: true,
          locked_until: statusCheck.locked_until,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // 3. Native Supabase Auth Password Verification
    const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);
    const { data: authData, error: authError } = await supabaseAnon.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.session) {
      // 4. Server-side Record Login Failure
      await supabaseAdmin.rpc('record_login_failure', { p_email: email });

      let errorMsg = 'ভুল Email/Member ID অথবা Password।';
      if (authError?.message?.includes('Admin Approval') || authError?.message?.includes('অপেক্ষায়')) {
        errorMsg = authError.message;
      }

      return new Response(
        JSON.stringify({ success: false, error: errorMsg }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // 5. Server-side Reset Login Attempt Counter on Successful Password Verification
    await supabaseAdmin.rpc('reset_login_attempts', { p_email: email });

    // 6. Return Session Tokens securely
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          session: authData.session,
          user: authData.user,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Login failed' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
