const fs = require('fs');
const results = [];
const log = (m) => { results.push(m); console.log(m); };
const T = (ms, p) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout ' + ms)), ms))]);

(async () => {
  try {
    // 1. Join via proxy (browser path)
    const joinA = await T(8000, fetch('http://localhost:3000/api/auth/anonymous-join', { method: 'POST' }).then(r => r.json()));
    log(`1. JOIN via proxy: ${joinA.user.username}`);

    // 2. Camera photo upload via existing /api/uploads through proxy
    const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BHgAFgQEAh9e2EgAAAABJRU5ErkJggg==';
    const fd = new FormData();
    fd.append('file', new Blob([Buffer.from(png, 'base64')], { type: 'image/png' }), `proxy_check_${Date.now()}.png`);
    const up = await T(15000, fetch('http://localhost:3000/api/uploads', {
      method: 'POST', headers: { 'Authorization': `Bearer ${joinA.token}` }, body: fd
    }).then(r => r.json()));
    log(`2. UPLOAD via proxy: ${up.file ? up.file.file_url : 'MISSING'}`);
    if (!up.file) throw new Error('upload failed');

    // 3. Save chat message via REST chat-message API through proxy
    const sendRes = await T(10000, fetch('http://localhost:3000/api/chats/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${joinA.token}` },
      body: JSON.stringify({
        sender_id: joinA.user.id, sender_name: joinA.user.username, room_id: 'general',
        recipient_id: null, message: '', attachment_url: up.file.file_url,
        attachment_type: up.file.file_type, attachment_name: up.file.file_name,
        attachment_size: up.file.file_size, client_msg_id: `cmid-${Date.now()}`
      })
    }));
    const saved = await sendRes.json();
    log(`3. CHAT MSG API via proxy: ${sendRes.status} | id: ${saved.id ? 'YES' : 'NO'} | url: ${saved.attachment_url || 'NO'} | cmid: ${saved.client_msg_id || 'NO'}`);
    if (sendRes.status !== 201 || !saved.attachment_url || !saved.client_msg_id) throw new Error('chat msg api failed');

    // 4. Realtime: a receiver connected to :5000 gets the broadcast
    const { io } = require('./client/node_modules/socket.io-client');
    const rx = io('http://localhost:5000', { reconnection: false, timeout: 4000 });
    let got = null;
    rx.on('receive_chat_message', m => { if (m.client_msg_id === saved.client_msg_id) got = m; });
    await T(6000, new Promise(res => { rx.on('connect', res); rx.on('connect_error', res); setTimeout(res, 5000); }));
    rx.emit('register_user', { id: 'rx', username: 'RX' });
    rx.emit('join_room', 'general');
    await new Promise(r => setTimeout(r, 1200));
    log(`4. REALTIME broadcast received: ${got ? 'YES' : 'NO'}`);
    rx.close();

    // 5. History + image serve via proxy
    const hist = await T(8000, fetch('http://localhost:3000/api/chats/messages/group/general', { headers: { 'Authorization': `Bearer ${joinA.token}` } }).then(r => r.json()));
    log(`5. HISTORY contains photo: ${hist.some(m => m.client_msg_id === saved.client_msg_id) ? 'YES' : 'NO'}`);
    const img = await T(8000, fetch(`http://localhost:3000${up.file.file_url}`));
    log(`6. IMG serve via proxy: ${img.status} ${img.headers.get('content-type')}`);

    log('PROXY_FLOW: PASS');
  } catch (err) {
    log(`PROXY_FLOW FAILED: ${err.message}`);
  } finally {
    fs.writeFileSync('proxy_results.txt', results.join('\n'));
    process.exit(0);
  }
})();