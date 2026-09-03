const fs = require('fs');
const chats = fs.readFileSync('server/routes/chats.js', 'utf8').split('\n');
const svc = fs.readFileSync('server/services/chatService.js', 'utf8').split('\n');
let out = '=== chats.js 45-100 ===\n';
for (let i = 44; i < Math.min(100, chats.length); i++) out += `${i + 1}: ${chats[i]}\n`;
out += '\n=== chatService.js 1-45 ===\n';
for (let i = 0; i < Math.min(45, svc.length); i++) out += `${i + 1}: ${svc[i]}\n`;
fs.writeFileSync('inspect2.txt', out);