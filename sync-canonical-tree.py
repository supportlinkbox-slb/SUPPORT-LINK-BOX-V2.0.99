#!/usr/bin/env python3
"""
sync-canonical-tree.py — Support Link Box canonical repo sync (audit follow-up).

WHY: the audit's systemic finding was "hot fixes applied to live DB were never
committed to the repo — a redeploy re-breaks everything." This script copies the
LIVE versions of the merged SQL fix + the 5 fixed edge functions into the repo's
canonical tree, so the repo matches production.

WHAT IT DOES (inside ~/SUPPORT-LINK-BOX-V2.0.99):
  - downloads fix-all-sql-merged.sql -> supabase/fix-all-sql-merged.sql
  - downloads the 5 fixed index.ts -> supabase/functions/<name>/index.ts
    (lifecycle-google-sheets, admin-blacklist-member, auth-login,
     admin-reject-member, admin-create-invite)

RUN:
  cd ~/SUPPORT-LINK-BOX-V2.0.99 && python3 sync-canonical-tree.py
  # then: git add -A && git commit -m "chore: sync canonical tree with live audit fixes" && git push

Idempotent: re-running just re-downloads the same files.
"""
import os
import sys
import urllib.request

REPO = os.path.expanduser("~/SUPPORT-LINK-BOX-V2.0.99")

FILES = {
    # repo-relative path -> download URL
    "supabase/fix-all-sql-merged.sql":
        "https://muse.ai/files/1345602521972253/2156736355266102/b3yhzh9ka5tnbgi9qlattv86/fix-all-sql-merged.sql",
    "supabase/functions/lifecycle-google-sheets/index.ts":
        "https://muse.ai/files/1345602521972253/1654543529600541/d0j2p2hl5iogf7z2y1uteph1/index.ts",
    "supabase/functions/admin-blacklist-member/index.ts":
        "https://muse.ai/files/1345602521972253/1976708072964749/5fwihs60xsujup43i1k6kk4f/index.ts",
    "supabase/functions/auth-login/index.ts":
        "https://muse.ai/files/1345602521972253/1610600424104148/io7wp7l0lulc7zg9wutply7o/index.ts",
    "supabase/functions/admin-reject-member/index.ts":
        "https://muse.ai/files/1345602521972253/4496017127336841/esmsvqeprsn91ur58f8fikru/index.ts",
    "supabase/functions/admin-create-invite/index.ts":
        "https://muse.ai/files/1345602521972253/2684644428649013/dbwe5ea19izgybmnrfbgw15e/index.ts",
}

def main():
    if not os.path.isdir(os.path.join(REPO, ".git")):
        print(f"ERROR: repo not found at {REPO}")
        sys.exit(1)
    ok = 0
    for rel, url in FILES.items():
        dest = os.path.join(REPO, rel)
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        print(f"downloading {rel} ...")
        try:
            urllib.request.urlretrieve(url, dest)
            size = os.path.getsize(dest)
            print(f"  OK ({size} bytes)")
            ok += 1
        except Exception as e:
            print(f"  FAILED: {e}")
    print(f"\n{ok}/{len(FILES)} files synced.")
    if ok != len(FILES):
        sys.exit(1)
    print("Next: git add -A && git commit -m \"chore: sync canonical tree with live audit fixes\" && git push")

if __name__ == "__main__":
    main()
