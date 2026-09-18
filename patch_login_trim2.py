import re

with open('src/components/auth/LoginPage.tsx', 'r') as f:
    content = f.read()

# Replace all potential undefined trim() issues
replacements = {
    "facebookUrl.trim()": "(facebookUrl || '').trim()",
    "!facebookUrl.trim()": "!(facebookUrl || '').trim()",
    "inviteToken.trim()": "(inviteToken || '').trim()",
    "loginIdentifier.trim()": "(loginIdentifier || '').trim()",
    "email.trim()": "(email || '').trim()",
    "!profilePhotoUrl.trim()": "!(profilePhotoUrl || '').trim()",
    "!name.trim()": "!(name || '').trim()",
    "name.trim()": "(name || '').trim()",
}

for old, new_val in replacements.items():
    content = content.replace(old, new_val)

with open('src/components/auth/LoginPage.tsx', 'w') as f:
    f.write(content)
