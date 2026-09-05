import React, { useState, useEffect } from 'react';
import { api, getApiBase } from '../services/api';
import { PlusCircle, Search, MessageCircle, ThumbsUp, Eye, Tag, Image as ImageIcon, Mic, Camera, X, Loader2, RotateCcw } from 'lucide-react';
import { Link } from 'react-router-dom';
import CameraCapture from '../components/CameraCapture';
import VoiceRecorder from '../components/VoiceRecorder';

const API_BASE = getApiBase();
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_AUDIO_SIZE = 25 * 1024 * 1024; // 25MB

const Doubts = () => {
  const [doubts, setDoubts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState({ tag: '', status: '', sort: 'latest' });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newDoubt, setNewDoubt] = useState({ title: '', content: '', tags: '' });
  const [attachment, setAttachment] = useState(null); // { file, kind: 'image'|'audio', preview }
  const [uploading, setUploading] = useState(false);
  const [modalError, setModalError] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const fileInputRef = React.useRef(null);

  const fetchDoubts = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ search, tag: filter.tag, status: filter.status, sort: filter.sort }).toString();
      const data = await api.getDoubts(q);
      setDoubts(data);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  useEffect(() => { fetchDoubts(); }, [search, filter]);

  // ---- Attachment helpers -------------------------------------------------
  const setFileAttachment = (file, kind) => {
    if (!file) return;
    const limit = kind === 'audio' ? MAX_AUDIO_SIZE : MAX_IMAGE_SIZE;
    if (file.size > limit) {
      setModalError(`File too large (max ${limit / (1024 * 1024)}MB)`);
      return;
    }

    // Memory cleanup: Revoke previous preview URL if it exists
    if (attachment && attachment.preview) {
      URL.revokeObjectURL(attachment.preview);
    }

    setModalError('');
    setAttachment({
      file,
      kind,
      preview: kind === 'image' ? URL.createObjectURL(file) : null,
      name: file.name || (kind === 'audio' ? 'voice-message' : 'photo')
    });
  };

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    if (!file.type.startsWith('image/')) {
      setModalError('Please select an image file (JPG, PNG, GIF, WebP)');
      return;
    }
    setFileAttachment(file, 'image');
  };

  const handleCameraSend = async (blob) => {
    // Convert Blob to File object for proper naming and upload
    const filename = `camera_photo_${Date.now()}.jpg`;
    const file = new File([blob], filename, { type: 'image/jpeg' });
    setFileAttachment(file, 'image');
  };

  const handleVoiceSend = async (blob) => {
    // Handle both File and Blob (VoiceRecorder might send Blob)
    const file = blob instanceof File ? blob : new File([blob], `voice_note_${Date.now()}.webm`, { type: blob.type || 'audio/webm' });
    setFileAttachment(file, 'audio');
  };

  const clearAttachment = () => {
    if (attachment?.preview) URL.revokeObjectURL(attachment.preview);
    setAttachment(null);
  };

  const resetModal = () => {
    clearAttachment();
    setNewDoubt({ title: '', content: '', tags: '' });
    setModalError('');
  };

  const uploadFile = async (file) => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(`${API_BASE}/uploads`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      body: fd
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Upload failed (${res.status})`);
    }
    const data = await res.json();
    if (!data.file) throw new Error(data.error || 'Upload failed');
    return data.file;
  };


  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newDoubt.title.trim()) { setModalError('Title is required'); return; }
    if (!newDoubt.content.trim() && !attachment) {
      setModalError('Add text, or attach a voice note / photo');
      return;
    }
    setUploading(true);
    setModalError('');
    try {
      let record = null;
      if (attachment) {
        record = await uploadFile(attachment.file);
      }
      const payload = {
        title: newDoubt.title,
        content: newDoubt.content,
        tags: newDoubt.tags,
        attachment_url: record?.file_url || null,
        attachment_type: record?.file_type || null,
        attachment_name: record?.file_name || null,
        attachment_size: record?.file_size || null
      };
      const res = await api.createDoubt(payload);
      if (res.id) { resetModal(); setIsModalOpen(false); fetchDoubts(); }
      else throw new Error(res.error || 'Failed to post question');
    } catch (err) {
      console.error(err);
      setModalError(err.message || 'Error posting question. Are you joined?');
    } finally {
      setUploading(false);
    }
  };

  const openModal = () => { resetModal(); setIsModalOpen(true); };

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Doubts</h1>
        <button onClick={openModal} className="flex items-center gap-2 bg-indigo-600 px-6 py-2 rounded-full font-medium"><PlusCircle size={20} /> Ask</button>
      </div>
      <div className="grid md:grid-cols-4 gap-6">
        <div className="md:col-span-1 space-y-4">
          <div className="glass-card p-4 rounded-xl">
            <input type="text" placeholder="Search..." className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 mb-4 text-white" value={search} onChange={(e) => setSearch(e.target.value)} />
            <select className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white mb-4" value={filter.sort} onChange={(e) => setFilter({...filter, sort: e.target.value})}><option value="latest">Latest</option><option value="popular">Popular</option></select>
            <select className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white" value={filter.status} onChange={(e) => setFilter({...filter, status: e.target.value})}><option value="">All</option><option value="solved">Solved</option></select>
          </div>
        </div>
        <div className="md:col-span-3 space-y-4">
          {loading ? <div>Loading...</div> : doubts.map(d => (
            <Link key={d.id} to={`/doubts/${d.id}`} className="block glass-card p-6 rounded-xl">
              <h2 className="text-xl font-semibold mb-2">{d.title}</h2>
              {d.content && <p className="text-slate-400 text-sm line-clamp-2 mb-4">{d.content}</p>}
              {/* Attachment preview in feed */}
              {d.attachment_url && d.attachment_type?.startsWith('image/') && (
                <img src={d.attachment_url} alt="question attachment" className="max-w-full max-h-56 rounded-lg mb-4 border border-slate-700/50 object-cover" loading="lazy" />
              )}
              {d.attachment_url && d.attachment_type?.startsWith('audio/') && (
                <audio controls src={d.attachment_url} className="w-full mb-4" preload="none" />
              )}
              {d.attachment_url && !d.attachment_type?.startsWith('image/') && !d.attachment_type?.startsWith('audio/') && (
                <p className="text-slate-400 text-sm mb-4 flex items-center gap-2"><Tag size={14} /> {d.attachment_name || 'Attachment'}</p>
              )}
              <div className="flex items-center gap-4 text-slate-400 text-xs border-t border-slate-800 pt-4">
                <span className="flex items-center gap-1"><ThumbsUp size={14}/> {d.likes_count}</span>
                <span className="flex items-center gap-1"><MessageCircle size={14}/> {d.answers_count}</span>
                <span className="ml-auto italic">by {d.anonymous_name}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="glass-card w-full max-w-lg p-8 rounded-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">Ask Question</h2>
              <button type="button" onClick={() => { resetModal(); setIsModalOpen(false); }} className="p-1 text-slate-400 hover:text-slate-200"><X size={22} /></button>
            </div>
            {modalError && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-sm">{modalError}</div>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <input required className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white" placeholder="Title" value={newDoubt.title} onChange={(e) => setNewDoubt({...newDoubt, title: e.target.value})} />
              <textarea rows="4" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white" placeholder={attachment?.kind === 'audio' ? 'Details (optional — you recorded a voice question)' : 'Details...'} value={newDoubt.content} onChange={(e) => setNewDoubt({...newDoubt, content: e.target.value})} />

              {/* Attachment preview */}
              {attachment && (
                <div className="relative bg-slate-900 border border-slate-700 rounded-lg p-3 flex items-center gap-3">
                  {attachment.kind === 'image' && attachment.preview && (
                    <img src={attachment.preview} alt="attachment preview" className="w-16 h-16 object-cover rounded-lg border border-slate-700" />
                  )}
                  {attachment.kind === 'audio' && (
                    <div className="w-10 h-10 rounded-full bg-indigo-600/20 flex items-center justify-center shrink-0">
                      <Mic size={18} className="text-indigo-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200 truncate">
                      {attachment.kind === 'audio' ? '🎙️ Voice note' : '🖼️ Photo'} — {attachment.name}
                    </p>
                    <p className="text-xs text-slate-500">{((attachment.file.size || 0) / 1024).toFixed(0)} KB</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => attachment.kind === 'audio' ? setVoiceOpen(true) : setCameraOpen(true)} className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-md transition-colors" title={attachment.kind === 'audio' ? 'Re-record' : 'Retake'}>
                      <RotateCcw size={18} />
                    </button>
                    <button type="button" onClick={clearAttachment} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-md transition-colors" title="Remove attachment">
                      <X size={18} />
                    </button>
                  </div>
                </div>
              )}

              {/* Action buttons: text / voice / image / camera */}
              <div className="flex gap-2 flex-wrap">
                <input type="file" accept="image/jpeg,image/png,image/gif,image/webp,image/heic,image/heif" ref={fileInputRef} onChange={handleImageSelect} className="hidden" />
                <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs text-slate-300 transition-colors" title="Add an image from your device">
                  <ImageIcon size={16} /> Image
                </button>
                <button type="button" onClick={() => setVoiceOpen(true)} className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs text-slate-300 transition-colors" title="Record a voice question">
                  <Mic size={16} /> Voice
                </button>
                <button type="button" onClick={() => setCameraOpen(true)} className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs text-slate-300 transition-colors" title="Take a photo with your camera">
                  <Camera size={16} /> Camera
                </button>
              </div>

              <input className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white" placeholder="Tags (comma separated)" value={newDoubt.tags} onChange={(e) => setNewDoubt({...newDoubt, tags: e.target.value})} />
              <div className="flex gap-3">
                <button type="button" onClick={() => { resetModal(); setIsModalOpen(false); }} className="flex-1 px-4 py-3 bg-slate-800 rounded-xl">Cancel</button>
                <button type="submit" disabled={uploading} className="flex-1 px-4 py-3 bg-indigo-600 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50">
                  {uploading && <Loader2 size={16} className="animate-spin" />}
                  {uploading ? 'Uploading…' : 'Post'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <CameraCapture open={cameraOpen} onClose={() => setCameraOpen(false)} onSend={handleCameraSend} />
      <VoiceRecorder open={voiceOpen} onClose={() => setVoiceOpen(false)} onSend={handleVoiceSend} />
    </div>
  );
};

export default Doubts;
