const { spawn } = require('child_process');
const fs = require('fs');
const results = [];
const log = (m) => { results.push(m); console.log(m); };

const withTimeout = (ms, promise) => Promise.race([
  promise,
  new Promise((_, rej) => setTimeout(() => rej(new Error(`timeout after ${ms}ms`)), ms))
]);

(async () => {
  // Hard watchdog so the test can never hang forever
  const watchdog = setTimeout(() => {
    results.push('WATCHDOG: test timed out');
    fs.writeFileSync('fix_results.txt', results.join('\n'));
    process.exit(2);
  }, 75000);

  const backend = spawn(process.execPath, ['server/index.js'], { stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 3500));
  // Spawn vite directly (no shell) so it can be killed reliably
  const frontend = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', '3000', '--strictPort'], { cwd: 'client', stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 8000));

  try {
    // 1. Two users join
    const joinA = await withTimeout(8000, fetch('http://localhost:3000/api/auth/anonymous-join', { method: 'POST' }).then(r => r.json()));
    const joinB = await withTimeout(8000, fetch('http://localhost:3000/api/auth/anonymous-join', { method: 'POST' }).then(r => r.json()));
    log(`1. JOIN: A=${joinA.user.username} B=${joinB.user.username}`);

    // 2. Camera-style image upload via existing /api/uploads (through Vite proxy)
    const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BHgAFgQEAh9e2EgAAAABJRU5ErkJggg==';
    const fd = new FormData();
    fd.append('file', new Blob([Buffer.from(pngBase64, 'base64')], { type: 'image/png' }), `camera_fix_${Date.now()}.png`);
    const up = await withTimeout(15000, fetch('http://localhost:3000/api/uploads', {
      method: 'POST', headers: { 'Authorization': `Bearer ${joinA.token}` }, body: fd
    }).then(r => r.json()));
    log(`2. UPLOAD: ${up.file ? up.file.file_url : 'MISSING'}`);
    if (!up.file) throw new Error('Upload failed');

    // 3. Receiver (user B) listens on realtime via existing socket system
    const { io } = require('./client/node_modules/socket.io-client');
    const receiver = io('http://localhost:5000', { reconnection: false, timeout: 4000 });
    let gotPhoto = null, gotText = null;
    receiver.on('receive_chat_message', (m) => {
      if (m.attachment_url === up.file.file_url) gotPhoto = m;
      if (m.message === 'TEXT_STILL_WORKS_123') gotText = m;
    });
    await withTimeout(6000, new Promise(resolve => { receiver.on('connect', () => resolve()); receiver.on('connect_error', () => resolve()); setTimeout(resolve, 5000); }));
    receiver.emit('register_user', { id: joinB.user.id, username: joinB.user.username });
    receiver.emit('join_room', 'general');
    await new Promise(r => setTimeout(r, 800));

    // 4. Sender posts the photo via the REST chat-message API (canonical path)
    const clientMsgId = `cmid-${Date.now()}`;
    const sendRes = await withTimeout(10000, fetch('http://localhost:3000/api/chats/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${joinA.token}` },
      body: JSON.stringify({
        sender_id: joinA.user.id, sender_name: joinA.user.username, room_id: 'general',
        recipient_id: null, message: '', attachment_url: up.file.file_url,
        attachment_type: up.file.file_type, attachment_name: up.file.file_name,
        attachment_size: up.file.file_size, client_msg_id: clientMsgId
      })
    }));
    const saved = await sendRes.json();
    log(`4. CHAT MSG API: ${sendRes.status} | id: ${saved.id ? 'YES' : 'MISSING'} | attachment_url: ${saved.attachment_url || 'MISSING'} | client_msg_id: ${saved.client_msg_id || 'MISSING'}`);
    if (sendRes.status !== 201 || !saved.attachment_url) throw new Error('Chat message API failed: ' + JSON.stringify(saved));

    // 5. Receiver got the photo in realtime via the broadcast
    await new Promise(r => setTimeout(r, 2000));
    log(`5. RECEIVER got photo realtime: ${gotPhoto ? 'YES' : 'NO'}`);
    if (!gotPhoto) throw new Error('Realtime photo delivery failed');

    // 6. Text message still works via the existing socket path
    const senderSock = io('http://localhost:5000', { reconnection: false, timeout: 4000 });
    senderSock.on('connect', () => { senderSock.emit('register_user', { id: joinA.user.id, username: joinA.user.username }); senderSock.emit('join_room', 'general'); });
    await withTimeout(6000, new Promise(resolve => { senderSock.on('connect', () => resolve()); setTimeout(resolve, 4000); }));
    senderSock.emit('send_chat_message', { sender_id: joinA.user.id, sender_name: joinA.user.username, room_id: 'general', message: 'TEXT_STILL_WORKS_123' });
    await new Promise(r => setTimeout(r, 2000));
    log(`6. TEXT still works: ${gotText ? 'YES' : 'NO'}`);
    senderSock.close();

    // 7. History (page reload scenario) contains photo + text
    const hist = await withTimeout(8000, fetch('http://localhost:3000/api/chats/messages/group/general', { headers: { 'Authorization': `Bearer ${joinA.token}` } }).then(r => r.json()));
    const hasPhoto = hist.some(m => m.attachment_url === up.file.file_url);
    const hasText = hist.some(m => m.message === 'TEXT_STILL_WORKS_123');
    log(`7. HISTORY: photo=${hasPhoto ? 'YES' : 'NO'} text=${hasText ? 'YES' : 'NO'}`);

    // 8. Photo is servable for the chat bubble <img>
    const imgRes = await withTimeout(8000, fetch(`http://localhost:3000${up.file.file_url}`));
    log(`8. IMG serve: ${imgRes.status} ${imgRes.headers.get('content-type')}`);
    if (imgRes.status !== 200) throw new Error('Image serve failed');

    log('CAMERA_FIX_FLOW: PASS');
  } catch (err) {
    log(`CAMERA_FIX_FLOW FAILED: ${err.message}`);
  } finally {
    backend.kill();
    frontend.kill();
    clearTimeout(watchdog);
    fs.writeFileSync('fix_results.txt', results.join('\n'));
    setTimeout(() => process.exit(0), 1200);
  }
})();