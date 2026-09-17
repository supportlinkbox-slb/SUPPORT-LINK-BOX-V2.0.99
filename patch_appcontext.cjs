const fs = require('fs');
const file = 'src/context/AppContext.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace register function to accept tokenHash and consume it before sign out
content = content.replace(
  /const register = async \(data: \{.*?\}\) => \{.*?if \(isSupabaseConfigured\) \{.*?const res = await authApi\.signUp.*?if \(!res\.success\) \{.*?return \{ success: false, error: res\.error \};\s*\}/s,
  `  const register = async (data: {
    email: string;
    pass: string;
    name: string;
    facebookUrl: string;
    profilePhotoUrl?: string;
    facebookIdentityKey?: string;
    facebookIdentityType?: 'numeric_id' | 'username';
    tokenHash?: string;
  }) => {
    if (isSupabaseConfigured) {
      const res = await authApi.signUp({
        email: data.email,
        password: data.pass,
        facebook_name: data.name,
        facebookUrl: data.facebookUrl,
        profilePhotoUrl: data.profilePhotoUrl,
        facebookIdentityKey: data.facebookIdentityKey,
        facebookIdentityType: data.facebookIdentityType,
      });

      if (!res.success) {
        return { success: false, error: res.error };
      }
      
      if (res.data?.session && data.tokenHash) {
         // User just signed up and has a session. Consume the invite token before signing out.
         const consumeRes = await supabase.rpc('consume_invite_token_tx', { p_token_hash: data.tokenHash });
         if (consumeRes.error || !consumeRes.data?.success) {
            console.error('Invite consume error:', consumeRes.error || consumeRes.data?.reason);
         }
      }
`
);

content = content.replace(
  /if \(res\.data\?\.needsEmailConfirmation\) \{/s,
  `      // No Auto Login - enforce signout
      if (res.data?.session) {
        await authApi.signOut();
      }

      if (res.data?.needsEmailConfirmation) {`
);

fs.writeFileSync(file, content);
