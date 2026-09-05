import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { MessageSquare, Send, Paperclip, User, Camera, FileText, Download, Reply, X, Mic, Trash2 } from 'lucide-react';
import CameraCapture from '../components/CameraCapture';
import VoiceRecorder from '../components/VoiceRecorder';
import { getApiBase } from '../services/api';

const API_BASE = getApiBase();

// Unique id per client-sent message, used to dedupe the realtime echo
const makeClientId = () =>
  (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const Chats = () => {
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [channel, setChannel] = useState('general');
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || '{}'));
  const [cameraOpen, setCameraOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [replyTo, setReplyTo] = useState(null); // message being replied to
  const socketRef = useRef();
  const scrollRef = useRef();
  const fileRef = useRef();
  const messagesEndRef = useRef();

  useEffect(() => {
    socketRef.current = io(window.location.origin.replace('3000', '5000'));
    socketRef.current.emit('register_user', user);
    socketRef.current.emit('join_room', channel);

    socketRef.current.on('receive_chat_message', (msg) => {
      if (msg.room_id !== channel && !msg.recipient_id) return;
      // For DM messages, only show if relevant to current user
      if (msg.recipient_id && msg.recipient_id !== user.id && msg.sender_id !== user.id) return;
      
      // Skip the realtime echo of a message this client already added optimistically
      setMessages(prev => {
        if (msg.client_msg_id && prev.some(m => m.client_msg_id === msg.client_msg_id)) return prev;
        return [...prev, msg];
      });
    });

    socketRef.current.on('delete_chat_message', (messageId) => {
      setMessages(prev => prev.filter(m => m.id !== messageId));
    });

    fetch(`${API_BASE}/chats/messages/group/${channel}`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
    .then(r => r.json())
    .then(data => setMessages(data));

    return () => {
      socketRef.current.emit('leave_room', channel);
      socketRef.current.disconnect();
    };
  }, [channel]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!message.trim() && !replyTo) return;
    if (!message.trim() && replyTo) return;

    const msgData = {
      sender_id: user.id,
      sender_name: user.username,
      room_id: channel,
      message: message.trim(),
      created_at: new Date().toISOString(),
      reply_to_id: replyTo ? replyTo.id : null
    };

    socketRef.current.emit('send_chat_message', msgData);
    setMessage('');
    setReplyTo(null);
  };

  const handleDeleteMessage = async (messageId) => {
    if (!window.confirm("Delete this message?\n\nThis action cannot be undone.")) return;
    try {
      const res = await fetch(`${API_BASE}/chats/messages/${messageId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Failed to delete message');
        return;
      }
      setMessages(prev => prev.filter(m => m.id !== messageId));
    } catch (err) {
      console.error('Delete error:', err);
      alert('Error deleting message');
    }
  };

  // Upload any file via the existing /api/uploads endpoint and return its record
  const uploadAttachment = async (file) => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(`${API_BASE}/uploads`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      body: fd
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Upload failed with status ${res.status}`);
    }
    const data = await res.json();
    if (!data.file) throw new Error(data.error || 'Upload failed');
    return data.file;
  };

  // Save the attachment message via the existing chat-message API (persist + realtime
  // broadcast handled server-side), then show it immediately for the sender.
  const sendAttachmentMsg = async (file) => {
    const payload = {
      sender_id: user.id,
      sender_name: user.username,
      room_id: channel,
      recipient_id: null,
      message: replyTo ? message.trim() : '',
      attachment_url: file.file_url,
      attachment_type: file.file_type,
      attachment_name: file.file_name,
      attachment_size: file.file_size,
      client_msg_id: makeClientId(),
      reply_to_id: replyTo ? replyTo.id : null
    };

    const res = await fetch(`${API_BASE}/chats/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Message send failed with status ${res.status}`);
    }
    const saved = await res.json();

    // Optimistic append for the sender (the realtime echo is deduped via client_msg_id)
    setMessages(prev => prev.some(m => m.client_msg_id && m.client_msg_id === saved.client_msg_id) ? prev : [...prev, saved]);
    setMessage('');
    setReplyTo(null);
    return saved;
  };

  // Attach button - images, videos, audio, PDFs and documents
  const handleFileAttach = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const record = await uploadAttachment(file);
      await sendAttachmentMsg(record);
    } catch (err) {
      console.error('Attachment upload failed:', err);
      alert('File upload failed. Please try again.');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  // Camera flow - called by CameraCapture after the user captures a photo
  const sendCameraPhoto = async (blob) => {
    if (!blob || blob.size === 0) {
      throw new Error('No photo data available');
    }
    // Create a File from the captured blob (with fallback for older browsers)
    let file;
    try {
      file = new File([blob], `camera_photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
    } catch (e) {
      // Fallback: some older browsers don't support File constructor
      file = blob;
      file.name = `camera_photo_${Date.now()}.jpg`;
      file.type = 'image/jpeg';
    }
    // Upload the photo to the existing storage endpoint
    const record = await uploadAttachment(file);
    if (!record || !record.file_url) {
      throw new Error('Photo upload failed - no file URL returned');
    }
    // Send the chat message with the uploaded photo attachment
    await sendAttachmentMsg(record);
  };

  // Voice flow - called by VoiceRecorder after the user records a voice message
  const sendVoiceMessage = async (file) => {
    if (!file || file.size === 0) {
      throw new Error('No audio data available');
    }
    // Upload the voice message to the existing storage endpoint
    const record = await uploadAttachment(file);
    if (!record || !record.file_url) {
      throw new Error('Voice upload failed - no file URL returned');
    }
    // Send the chat message with the uploaded voice attachment
    await sendAttachmentMsg(record);
  };

  // Render a message attachment inline (photo, video, audio,, PDF, document)
  const renderAttachment = (m) => {
    const type = m.attachment_type || '';
    if (type.startsWith('image/')) {
      return <img src={m.attachment_url} alt={m.attachment_name || 'Image'} className="max-w-full max-h-64 rounded-lg mt-2 border border-white/10 shadow" loading="lazy" />;
    }
    if (type.startsWith('video/')) {
      return <video controls src={m.attachment_url} className="max-w-full max-h-64 rounded-lg mt-2 border border-white/10" />;
    }
    if (type.startsWith('audio/')) {
      return <audio controls src={m.attachment_url} className="w-64 max-w-full mt-2" />;
    }
    return (
      <a href={m.attachment_url} download={m.attachment_name} className="flex items-center gap-2 bg-slate-900/80 hover:bg-slate-900 border border-white/10 p-2 rounded-lg mt-2 text-indigo-400 font-medium transition-colors">
        <FileText size={16} className="shrink-0" />
        <span className="truncate max-w-44 text-xs">{m.attachment_name || 'Document'}</span>
        <Download size={14} className="shrink-0 ml-auto" />
      </a>
    );
  };

  return (
    <div className="flex h-[85vh] gap-4">
      <div className="w-64 glass-panel rounded-xl p-4 flex flex-col gap-2">
        <h3 className="font-bold mb-4 text-indigo-400">Channels</h3>
        {['general', 'code-doubts', 'media-share', 'off-topic'].map(ch => (
          <button 
            key={ch} 
            onClick={() => setChannel(ch)}
            className={`text-left p-2 rounded-lg transition-colors ${channel === ch ? 'bg-indigo-600/20 text-indigo-400' : 'hover:bg-slate-800'}`}
          >
            # {ch}
          </button>
        ))}
      </div>
      
      <div className="flex-1 glass-panel rounded-xl flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="font-bold text-xl"># {channel}</h2>
          <div className="text-sm text-slate-400 flex items-center gap-1"><User size={14}/> {user.username}</div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, i) => {
            // Find the replied-to message if this message is a reply
            const repliedMsg = msg.reply_to_id 
              ? (messages.find(m => m.id === msg.reply_to_id) || { id: msg.reply_to_id, sender_name: 'Original Message', message: 'Message deleted', attachment_url: null, isDeletedPlaceholder: true }) 
              : null;
            return (
              <div key={msg.id || i} id={`msg-${msg.id}`} className={`flex flex-col ${msg.sender_id === user.id ? 'items-end' : 'items-start'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">{msg.sender_name}</span>
                  <span className="text-[10px] text-slate-600">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className={`max-w-[70%] p-3 rounded-2xl ${msg.sender_id === user.id ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-slate-800 text-slate-100 rounded-tl-none'}`}>
                  {/* Reply preview */}
                  {repliedMsg && (
                    <div
                      className="mb-2 p-2 rounded-lg bg-black/20 border-l-2 border-indigo-400 cursor-pointer hover:bg-black/30 transition-colors"
                      onClick={() => {
                        const el = document.getElementById(`msg-${repliedMsg.id}`);
                        if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('ring-2', 'ring-indigo-400'); setTimeout(() => el.classList.remove('ring-2', 'ring-indigo-400'), 2000); }
                      }}
                    >
                      <p className="text-[10px] font-bold text-indigo-300 mb-0.5">↩ {repliedMsg.sender_name}</p>
                      {repliedMsg.message && <p className="text-xs opacity-80 truncate">{repliedMsg.message}</p>}
                      {repliedMsg.attachment_url && (
                        <p className="text-xs opacity-70 flex items-center gap-1">
                          {repliedMsg.attachment_type?.startsWith('image/') ? '🖼️ Image' : repliedMsg.attachment_type?.startsWith('video/') ? '🎬 Video' : repliedMsg.attachment_type?.startsWith('audio/') ? '🎵 Audio' : '📎 File'}
                          {repliedMsg.attachment_name && <span className="truncate max-w-32"> - {repliedMsg.attachment_name}</span>}
                        </p>
                      )}
                    </div>
                  )}
                  {msg.message && <div className="text-sm">{msg.message}</div>}
                  {msg.attachment_url && renderAttachment(msg)}
                </div>
                {/* Actions */}
                <div className="mt-1 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setReplyTo(msg)}
                    className="text-[10px] text-slate-500 hover:text-indigo-400 flex items-center gap-1 transition-colors"
                  >
                    <Reply size={12} /> Reply
                  </button>
                  {(msg.sender_id === user.id || user.role === 'admin') && (
                    <button
                      type="button"
                      onClick={() => handleDeleteMessage(msg.id)}
                      className="text-[10px] text-rose-500 hover:text-rose-400 flex items-center gap-1 transition-colors"
                    >
                      <Trash2 size={12} /> Delete
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={scrollRef} />
        </div>

        {/* Reply preview */}
        {replyTo && (
          <div className="px-4 py-2 bg-slate-800/50 border-t border-slate-700 flex items-center gap-3">
            <Reply size={16} className="text-indigo-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-indigo-400">Replying to {replyTo.sender_name}</p>
              {replyTo.message && <p className="text-xs text-slate-400 truncate">{replyTo.message}</p>}
              {replyTo.attachment_url && (
                <p className="text-xs text-slate-500 flex items-center gap-1">
                  {replyTo.attachment_type?.startsWith('image/') ? '🖼️ Image' : replyTo.attachment_type?.startsWith('video/') ? '🎬 Video' : replyTo.attachment_type?.startsWith('audio/') ? '🎵 Audio' : '📎 File'}
                  {replyTo.attachment_name && <span className="truncate max-w-32"> - {replyTo.attachment_name}</span>}
                </p>
              )}
            </div>
            <button type="button" onClick={() => setReplyTo(null)} className="p-1 text-slate-400 hover:text-slate-200 shrink-0">
              <X size={16} />
            </button>
          </div>
        )}

        <form onSubmit={handleSend} className="p-4 bg-slate-900/50 flex gap-2 items-center">
          <input type="file" ref={fileRef} onChange={handleFileAttach} className="hidden" />
          <button type="button" onClick={() => fileRef.current?.click()} className="p-2 text-slate-400 hover:text-indigo-400" title="Attach image, video, audio, PDF or document">
            <Paperclip size={20}/>
          </button>
          <button type="button" onClick={() => setCameraOpen(true)} className="p-2 text-slate-400 hover:text-indigo-400 flex items-center gap-1" title="Capture a photo with the camera">
            <Camera size={20}/><span className="hidden sm:inline text-xs font-medium">Camera</span>
          </button>
          <button type="button" onClick={() => setVoiceOpen(true)} className="p-2 text-slate-400 hover:text-indigo-400 flex items-center gap-1" title="Record a voice message">
            <Mic size={20}/><span className="hidden sm:inline text-xs font-medium">Voice</span>
          </button>
          <input 
            type="text" 
            placeholder={replyTo ? `Reply to ${replyTo.sender_name}...` : `Message # ${channel}`}
            className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 focus:outline-none focus:border-indigo-500 text-slate-100"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <button type="submit" className="p-2 bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"><Send size={20}/></button>
        </form>
      </div>

      <CameraCapture open={cameraOpen} onClose={() => setCameraOpen(false)} onSend={sendCameraPhoto} />
      <VoiceRecorder open={voiceOpen} onClose={() => setVoiceOpen(false)} onSend={sendVoiceMessage} />
    </div>
  );
};

export default Chats;
