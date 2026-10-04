#!/data/data/com.termux/files/usr/bin/bash
# Deploys Edge Functions to the NEW project via Supabase Management API.
# No CLI needed. Run from the repo root: ~/SUPPORT-LINK-BOX-V2.0.99/SUPPORT-LINK-BOX-V2.0.99
set -u
echo "=== Deploy Edge Functions to NEW project (ufgmyoppqedreqomcmcp) ==="
REF="ufgmyoppqedreqomcmcp"
read -s -p "Supabase access token (sbp_..., paste): " SBPTKN
echo ""

# Fixed consume-invite-token (email_confirm: false -> verification email sent)
curl -sLO "https://muse.ai/files/1345602521972253/1864543614984538/vb3ifscflyffb4x9knueig1f/consume-invite-token-fixed.ts"
cp consume-invite-token-fixed.ts supabase/functions/consume-invite-token/index.ts
echo "Fixed consume-invite-token placed."

deploy() {
  local slug=$1
  local verify_jwt=$2
  echo "--- $slug (verify_jwt=$verify_jwt) ---"
  curl -s --request POST \
    --url "https://api.supabase.com/v1/projects/$REF/functions/deploy?slug=$slug" \
    --header "Authorization: Bearer $SBPTKN" \
    --form "metadata={ \"entrypoint_path\": \"index.ts\", \"name\": \"$slug\", \"verify_jwt\": $verify_jwt }" \
    --form file="@supabase/functions/$slug/index.ts" | python3 -c "import json,sys; d=json.load(sys.stdin); print('status:', d.get('status'), '| verify_jwt:', d.get('verify_jwt'))" 2>/dev/null || echo "(deploy call sent)"
}

deploy "auth-login" false
deploy "consume-invite-token" false
deploy "admin-create-invite" true
deploy "admin-revoke-invite" true
deploy "bdt-10am-recovery-cron" true
deploy "lifecycle-google-sheets" true

echo "=== DONE ==="
unset SBPTKN
