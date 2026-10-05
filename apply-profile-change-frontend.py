#!/usr/bin/env python3
"""Install Profile Change Request feature into the SLB frontend.
- Copies 2 new components into src/
- Patches MemberProfileView (request button + modal)
- Patches AdminDashboard (review panel)
Run from the repo root. Verifies every anchor before patching.
Idempotent: safe to re-run (skips already-patched files).
"""
import shutil, sys
from pathlib import Path

HERE = Path(__file__).parent
SRC = HERE / "src"

def need(cond, msg):
    if not cond:
        print(f"FATAL: {msg}")
        sys.exit(1)

# 0. copy new components -----------------------------------------------------
need((HERE / "ProfileChangeRequestModal.tsx").exists(), "ProfileChangeRequestModal.tsx missing next to script")
need((HERE / "ProfileChangeReviewPanel.tsx").exists(), "ProfileChangeReviewPanel.tsx missing next to script")
need(SRC.is_dir(), "src/ directory not found - run from repo root")

shutil.copy(HERE / "ProfileChangeRequestModal.tsx", SRC / "components" / "member" / "ProfileChangeRequestModal.tsx")
shutil.copy(HERE / "ProfileChangeReviewPanel.tsx", SRC / "components" / "admin" / "ProfileChangeReviewPanel.tsx")
print("copied 2 new components")

# 1. MemberProfileView ---------------------------------------------------------
mpv = SRC / "components" / "member" / "MemberProfileView.tsx"
t = mpv.read_text()

if "ProfileChangeRequestModal" in t and "showChangeRequest" in t:
    print("MemberProfileView.tsx already patched - skipping")
else:
    a1 = "import { useApp } from '../../context/AppContext';"
    need(t.count(a1) == 1, "MPV anchor1")
    t = t.replace(a1, a1 + "\nimport { ProfileChangeRequestModal } from './ProfileChangeRequestModal';")

    a2 = "const [loading, setLoading] = useState(false);"
    need(t.count(a2) == 1, "MPV anchor2")
    t = t.replace(a2, a2 + "\n  const [showChangeRequest, setShowChangeRequest] = useState(false);")

    a3 = """          <button
            onClick={() => logout()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-950/40 hover:bg-red-900/50 text-red-300 border border-red-800/60 text-xs font-bold transition self-start sm:self-center"
          >
            <LogOut className="w-4 h-4" />
            <span>লগআউট করুন</span>
          </button>"""
    need(t.count(a3) == 1, "MPV anchor3")
    t = t.replace(a3, """          <div className="flex flex-col gap-2 self-start sm:self-center">
            <button
              onClick={() => setShowChangeRequest(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-800/60 text-xs font-bold transition"
            >
              <Settings className="w-4 h-4" />
              <span>প্রোফাইল পরিবর্তনের আবেদন</span>
            </button>
            <button
              onClick={() => logout()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-950/40 hover:bg-red-900/50 text-red-300 border border-red-800/60 text-xs font-bold transition"
            >
              <LogOut className="w-4 h-4" />
              <span>লগআউট করুন</span>
            </button>
          </div>
          <ProfileChangeRequestModal
            isOpen={showChangeRequest}
            onClose={() => setShowChangeRequest(false)}
            currentName={currentUser.name}
            currentPhotoUrl={currentUser.profile_photo_url || ''}
          />""")

    mpv.write_text(t)
    print("patched MemberProfileView.tsx")

# 2. AdminDashboard ------------------------------------------------------------
ad = SRC / "components" / "admin" / "AdminDashboard.tsx"
t = ad.read_text()

if "ProfileChangeReviewPanel" in t:
    print("AdminDashboard.tsx already patched - skipping")
else:
    # anchor: a stable import present in the live repo (line 35)
    b1 = "import { MemberDetailsModal } from './MemberDetailsModal';"
    need(t.count(b1) == 1, "AD anchor1 (MemberDetailsModal import not found)")
    t = t.replace(b1, b1 + "\nimport { ProfileChangeReviewPanel } from './ProfileChangeReviewPanel';")

    b2 = "      {/* Admin Module Control Grid (Clean Grid Layout - No Horizontal Sliding Required) */}"
    need(t.count(b2) == 1, "AD anchor2")
    t = t.replace(b2, "      <ProfileChangeReviewPanel />\n\n" + b2)

    ad.write_text(t)
    print("patched AdminDashboard.tsx")

print("DONE - all patches applied cleanly")
