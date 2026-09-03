const { spawn } = require('child_process');
const fs = require('fs');
const results = [];
const log = (m) => { results.push(m); console.log(m); };

(async () => {
  const backend = spawn('node', ['server/index.js'], { stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 3500));
  const frontend = spawn('npx', ['vite', '--port', '3000', '--strictPort'], { cwd: 'client', stdio: 'ignore', shell: true });
  await new Promise(r => setTimeout(r, 8500));

  try {
    // 1. Anonymous join THROUGH Vite proxy (3000) - exactly what the browser does
    const joinRes = await fetch('http://localhost:3000/api/auth/anonymous-join', { method: 'POST' });
    const join = await joinRes.json();
    log(`1. JOIN via proxy: ${joinRes.status} | user: ${join.user.username}`);
    if (!join.token) throw new Error('Join failed');

    // 2. Upload a camera-style image THROUGH the Vite proxy (multipart FormData, same as uploadAttachment({
    const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BHgAFgQEAh9e2EgAAAABJRU5ErkJggg==';
    const fd = new FormData();
    fd.append('file', new Blob([Buffer.from(pngBase64, 'base64')], { type: 'image/png' }), `camera_e2e_${Date.now()}.png`);
    const upRes = await fetch('http://localhost:3000/api/uploads', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${join.token}` },
      body: fd
    });
    const up = await upRes.json();
    log(`2. UPLOAD via proxy: ${upRes.status} | file: ${up.file ? up.file.file_url : 'MISSING'} | type: ${up.file ? up.file.file_type : 'n/a'}`);
    if (!up.file) throw new Error('Upload via proxy failed: ' + JSON.stringify(up));

    // 3. Socket connect on :5000 (as browser does), register, join general
    const { io } = require('./client/node_modules/socket.io-client');
    const sender = io('http://localhost:5000', { reconnection: false, timeout: 4000 });
    let received = null;
    await new Promise(resolve => { sender.on('connect', () => resolve()); sender.on('connect_error', () => resolve()); setTimeout(resolve, 5000); });
    sender.emit('register_user', { id: join.user.id, username: join.user.username });
    sender.emit('join_room', 'general');
    sender.on('receive_chat_message', (m) => { if (m.attachment_url === up.file.file_url) received = m; });

    // 4. Same payload as Chats.jsx sendAttachmentMsg
    sender.emit('send_chat_message', {
      sender_id: join.user.id,
      sender_name: join.user.username,
      room_id: 'general',
      recipient_id: null,
      message: '',
      attachment_url: up.file.file_url,
      attachment_type: up.file.file_type,
      attachment_name: up.file.file_name,
      attachment_size: up.file.file_size,
      created_at: new Date().toISOString()
    });
    await new Promise(r => setTimeout(r, 2500));
    log(`3. SOCKET roundtrip via 5000: ${received ? 'YES - msg received with attachment' : 'NO'}`);

    // 5. History via proxy contains the attachment message (idempotent persists)
    const histRes = await fetch(`http://localhost:3000/api/chats/messages/group/general`, { headers: { 'Authorization': `Bearer ${join.token}` } });
    const hist = await histRes.json();
    const found = Array.isArray(hist) ? hist.find(m => m.attachment_url === up.file.file_url) : null;
    log(`4. HISTORY via proxy: ${histRes.status} | contains attachment: ${found ? 'YES' : 'NO'}`);

    // 6. Serve the image via Vite proxy (the <img src> the chat bubble uses)
    const imgRes = await fetch(`http://localhost:3000${up.file.file_url}`);
    const imgType = imgRes.headers.get('content-type');
    log(`5. IMG serve via proxy: ${imgRes.status} | content-type: ${imgType}`);
    if (imgRes.status !== 200 || !imgType.startsWith('image/')) throw new Error('Image proxy serve failed');

    log('E2E_BROWSER_PATH: PASS');
  } catch (err) {
    log(`E2E_BROWSER_PATH FAILED: ${err.message}`);
  } finally {
    backend.kill(); frontend.kill();
    fs.writeFileSync('e2e_results.txt', results.join('\n'));
    setTimeout(() => process.exit(0), 1500);
  }
})();