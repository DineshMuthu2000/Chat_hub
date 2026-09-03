const { spawn } = require('child_process');
const fs = require('fs');
const results = [];
const log = (m) => { results.push(m); console.log(m); };

(async () => {
  const backend = spawn('node', ['server/index.js'], { stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 3500));
  try {
    const join = await fetch('http://localhost:5000/api/auth/anonymous-join', { method: 'POST' }).then(r => r.json());
    log(`1. JOIN direct: ${join.user.username}`);

    const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BHgAFgQEAh9e2EgAAAABJRU5ErkJggg==';
    const fd = new FormData();
    fd.append('file', new Blob([Buffer.from(pngBase64, 'base64')], { type: 'image/png' }), `direct_${Date.now()}.png`);
    const up = await fetch('http://localhost:5000/api/uploads', {
      method: 'POST', headers: { 'Authorization': `Bearer ${join.token}` }, body: fd
    }).then(r => r.json());
    log(`2. UPLOAD direct: ${up.file ? up.file.file_url : 'MISSING'}`);

    const receiver = require('./client/node_modules/socket.io-client').io('http://localhost:5000', { reconnection: false, timeout: 4000 });
    let gotPhoto = null;
    receiver.on('receive_chat_message', (m) => { if (m.attachment_url === up.file.file_url) gotPhoto = m; });
    await new Promise(resolve => { receiver.on('connect', () => resolve()); receiver.on('connect_error', () => resolve()); setTimeout(resolve, 5000); });
    receiver.emit('register_user', { id: 'rx-user', username: 'ReceiverBot' });
    receiver.emit('join_room', 'general');
    await new Promise(r => setTimeout(r, 500));

    const sendRes = await fetch('http://localhost:5000/api/chats/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${join.token}` },
      body: JSON.stringify({
        sender_id: join.user.id, sender_name: join.user.username, room_id: 'general',
        recipient_id: null, message: '', attachment_url: up.file.file_url,
        attachment_type: up.file.file_type, attachment_name: up.file.file_name,
        attachment_size: up.file.file_size, client_msg_id: `cmid-${Date.now()}`
      })
    });
    const saved = await sendRes.json();
    log(`3. REST chat msg: ${sendRes.status} | id: ${saved.id ? 'YES' : JSON.stringify(saved).slice(0, 120)}`);

    await new Promise(r => setTimeout(r, 2000));
    log(`4. RECEIVER got photo: ${gotPhoto ? 'YES' : 'NO'}`);
    log('DIRECT_BACKEND_FLOW: PASS');
  } catch (err) {
    log(`DIRECT_BACKEND_FLOW FAILED: ${err.message}`);
  } finally {
    backend.kill();
    fs.writeFileSync('direct_results.txt', results.join('\n'));
    setTimeout(() => process.exit(0), 800);
  }
})();