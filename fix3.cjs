const fs = require('fs');
let lines = fs.readFileSync('src/components/auth/LoginPage.tsx', 'utf8').split('\n');
lines[586] = '                </>)}';
fs.writeFileSync('src/components/auth/LoginPage.tsx', lines.join('\n'));
