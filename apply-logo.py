#!/usr/bin/env python3
# Replaces text "SLB" badges with the new logo image
# Run from repo root: python3 apply-logo.py
# Requires: public/slb-logo.png to exist
import sys

# 1. Navbar
path = 'src/components/layout/Navbar.tsx'
with open(path) as f:
    c = f.read()

old_nav = """            <div className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${
              isFestival ? currentThemeConfig.primaryGradient : 'from-cyan-500 to-blue-600'
            } flex items-center justify-center shadow-md text-white font-black text-xl transition-all duration-500`}>
              {isFestival ? <span className="text-lg select-none">{currentThemeConfig.icon}</span> : 'SLB'}
            </div>"""

new_nav = """            {isFestival ? (
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${currentThemeConfig.primaryGradient} flex items-center justify-center shadow-md text-white font-black text-xl transition-all duration-500`}>
                <span className="text-lg select-none">{currentThemeConfig.icon}</span>
              </div>
            ) : (
              <img src="/slb-logo.png" alt="SLB" className="w-10 h-10 rounded-xl shadow-md object-cover" />
            )}"""

if old_nav not in c:
    print("Navbar: already patched or pattern not found, skipping")
else:
    c = c.replace(old_nav, new_nav, 1)
    with open(path, 'w') as f:
        f.write(c)
    print("Navbar: patched OK")

# 2. LoginPage
path = 'src/components/auth/LoginPage.tsx'
with open(path) as f:
    c = f.read()

old_login = """          <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-xl shadow-cyan-500/20 text-white font-black text-2xl mx-auto">
            SLB
          </div>"""

new_login = """          <img src="/slb-logo.png" alt="SLB" className="w-20 h-20 rounded-full shadow-xl shadow-cyan-500/20 mx-auto object-cover" />"""

if old_login not in c:
    print("LoginPage: already patched or pattern not found, skipping")
else:
    c = c.replace(old_login, new_login, 1)
    with open(path, 'w') as f:
        f.write(c)
    print("LoginPage: patched OK")

print("Done.")
