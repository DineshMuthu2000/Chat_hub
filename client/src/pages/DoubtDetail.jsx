import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ThumbsUp, MessageCircle, ArrowLeft, Send, CheckCircle, Tag } from 'lucide-react';
import { api, getApiBase } from '../services/api';

const API_BASE = getApiBase();

const DoubtDetail = () => {
  const { id } = useParams();
  const [doubt, setDoubt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [answer, setAnswer] = useState('');
  const [currentUser] = useState(JSON.parse(localStorage.getItem('user') || '{}'));

  const fetchDoubt = async () => {
    try {
      const data = await api.getDoubt(id);
      setDoubt(data);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  useEffect(() => { fetchDoubt(); }, [id]);

  const handleLike = async () => {
    try {
      const res = await fetch(`${API_BASE}/doubts/${id}/like`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      }).then(r => r.json());
      if (res.likes_count !== undefined) {
        setDoubt({ ...doubt, likes_count: res.likes_count, is_liked: res.liked });
      }
    } catch (err) { console.error(err); }
  };

  const handleAnswerSubmit = async (e) => {
    e.preventDefault();
    if (!answer.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/doubts/${id}/answers`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}` 
        },
        body: JSON.stringify({ content: answer })
      }).then(r => r.json());
      if (res.id) { setAnswer(''); fetchDoubt(); }
    } catch (err) { console.error(err); }
  };

  const handleAcceptAnswer = async (answerId) => {
    try {
      await fetch(`${API_BASE}/doubts/${id}/answers/${answerId}/accept`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      fetchDoubt();
    } catch (err) { console.error(err); }
  };

  if (loading) return <div className="p-8 text-center text-slate-400">Loading...</div>;
  if (!doubt) return <div className="p-8 text-center text-slate-400">Not found.</div>;

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <Link to="/doubts" className="flex items-center gap-2 text-slate-400 hover:text-indigo-400 mb-6">
        <ArrowLeft size={18}/> Back
      </Link>
      <div className="glass-card p-8 rounded-2xl mb-8">
        <div className="flex justify-between items-start mb-4">
          <h1 className="text-3xl font-bold text-slate-100">{doubt.title}</h1>
          {doubt.is_solved && <span className="bg-emerald-500/10 text-emerald-400 text-sm px-3 py-1 rounded-full border border-emerald-500/20">Solved</span>}
        </div>
        {doubt.content && <p className="text-slate-300 text-lg whitespace-pre-wrap mb-6">{doubt.content}</p>}
        {/* Attachment: image / audio / other */}
        {doubt.attachment_url && doubt.attachment_type?.startsWith('image/') && (
          <img src={doubt.attachment_url} alt={doubt.attachment_name || 'question image'} className="max-w-full max-h-96 rounded-xl mb-6 border border-slate-700/50" />
        )}
        {doubt.attachment_url && doubt.attachment_type?.startsWith('audio/') && (
          <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-4 mb-6 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-600/20 flex items-center justify-center shrink-0">🎙️</div>
            <audio controls src={doubt.attachment_url} className="w-full" preload="none" />
          </div>
        )}
        {doubt.attachment_url && !doubt.attachment_type?.startsWith('image/') && !doubt.attachment_type?.startsWith('audio/') && (
          <a href={doubt.attachment_url} download={doubt.attachment_name} className="inline-flex items-center gap-2 bg-slate-900 border border-slate-700/50 rounded-xl px-4 py-3 mb-6 text-indigo-400">
            <Tag size={16} /> {doubt.attachment_name || 'Attachment'}
          </a>
        )}
        <div className="flex items-center justify-between border-t border-slate-800 pt-6">
          <div className="flex items-center gap-6">
            <button onClick={handleLike} className={`flex items-center gap-2 ${doubt.is_liked ? 'text-indigo-400' : 'text-slate-400'}`}>
              <ThumbsUp size={20} fill={doubt.is_liked ? "currentColor" : "none"}/> {doubt.likes_count}
            </button>
            <div className="flex items-center gap-2 text-slate-400"><MessageCircle size={20}/> {doubt.answers_count}</div>
          </div>
          <div className="text-right">
            <div className="text-sm font-medium">By {doubt.anonymous_name}</div>
            <div className="text-xs text-slate-500">{new Date(doubt.created_at).toLocaleDateString()}</div>
          </div>
        </div>
      </div>
      <div className="space-y-6 mb-12">
        <h2 className="text-xl font-bold">{doubt.answers_count} Answers</h2>
        {doubt.answers?.map(ans => (
          <div key={ans.id} className={`glass-card p-6 rounded-xl border-l-4 ${ans.is_accepted ? 'border-l-emerald-500' : 'border-l-slate-700'}`}>
            <div className="flex justify-between mb-4">
              <div className="text-sm"><b>{ans.anonymous_name}</b> • {new Date(ans.created_at).toLocaleDateString()}</div>
              {ans.is_accepted ? <span className="text-emerald-400 text-xs">Accepted</span> : 
                (!doubt.is_solved && doubt.user_id === currentUser.id && (
                  <button onClick={() => handleAcceptAnswer(ans.id)} className="text-xs text-emerald-500">Accept</button>
                ))
              }
            </div>
            <p className="text-slate-300">{ans.content}</p>
          </div>
        ))}
      </div>
      <form onSubmit={handleAnswerSubmit} className="glass-panel p-4 rounded-2xl sticky bottom-4 flex gap-2">
        <textarea required placeholder="Your answer..." className="flex-1 bg-slate-900 border border-slate-700 rounded-xl p-3 text-slate-100"
          value={answer} onChange={(e) => setAnswer(e.target.value)} />
        <button type="submit" className="bg-indigo-600 p-4 rounded-xl"><Send size={24}/></button>
      </form>
    </div>
  );
};
export default DoubtDetail;
