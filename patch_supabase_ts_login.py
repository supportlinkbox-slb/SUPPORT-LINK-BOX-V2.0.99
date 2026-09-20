with open('src/lib/supabase.ts', 'r') as f:
    code = f.read()

target = """      // Fetch the profile strictly by auth_user_id
      const { data: profile, error: dbErr } = await supabase
        .from('members')
        .select('*')
        .eq('auth_user_id', user.id)
        .maybeSingle();

      if (!dbErr && profile) {
        return { success: true, data: profile as MemberProfile };
      }"""

replacement = """      // Fetch the profile strictly by auth_user_id, with fallback to email matching
      let { data: profile, error: dbErr } = await supabase
        .from('members')
        .select('*')
        .eq('auth_user_id', user.id)
        .maybeSingle();

      if (!profile && userEmail) {
        const { data: emailProfile } = await supabase
          .from('members')
          .select('*')
          .ilike('email', userEmail)
          .maybeSingle();

        if (emailProfile) {
          try {
            await supabase
              .from('members')
              .update({ auth_user_id: user.id })
              .eq('id', emailProfile.id);
          } catch (e) {
            console.error('Auto-link failed:', e);
          }
          profile = { ...emailProfile, auth_user_id: user.id };
        }
      }

      if (profile) {
        return { success: true, data: profile as MemberProfile };
      }"""

if target in code:
    code = code.replace(target, replacement)
    with open('src/lib/supabase.ts', 'w') as f:
        f.write(code)
    print("Updated src/lib/supabase.ts successfully")
else:
    print("Target block not found in src/lib/supabase.ts")

