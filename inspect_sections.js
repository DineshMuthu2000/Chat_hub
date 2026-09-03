const fs = require('fs');
const cam = fs.readFileSync('client/src/components/CameraCapture.jsx', 'utf8').split('\n');
const chat = fs.readFileSync('client/src/pages/Chats.jsx', 'utf8').split('\n');
let out = '=== CameraCapture.jsx lines 88-142 ===\n';
for (let i = 87; i < Math.min(142, cam.length); i++) out += `${i + 1}: ${cam[i]}\n`;
out += '\n=== Chats.jsx lines 102-132 ===\n';
for (let i = 101; i < Math.min(132, chat.length); i++) out += `${i + 1}: ${chat[i]}\n`;
fs.writeFileSync('inspect_sections.txt', out);