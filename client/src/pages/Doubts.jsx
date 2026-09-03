import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { PlusCircle, Search, MessageCircle, ThumbsUp, Eye, Tag } from 'lucide-react';
import { Link } from 'react-router-dom';

const Doubts = () => {
  const [doubts, setDoubts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState({ tag: '', status: '', sort: 'latest' });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newDoubt, setNewDoubt] = useState({ title: '', content: '', tags: '' });

  const fetchDoubts = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ search, tag: filter.tag, status: filter.status, sort: filter.sort }).toString();
      const data = await api.getDoubts(q);
      setDoubts(data);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  useEffect(() => { fetchDoubts(); }, [search, filter]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await api.createDoubt(newDoubt);
      if (res.id) { setNewDoubt({ title: '', content: '', tags: '' }); setIsModalOpen(false); fetchDoubts(); }
    } catch (err) { alert('Error. Are you joined?'); }
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Doubts</h1>
        <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 bg-indigo-600 px-6 py-2 rounded-full font-medium"><PlusCircle size={20} /> Ask</button>
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
              <p className="text-slate-400 text-sm line-clamp-2 mb-4">{d.content}</p>
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
          <div className="glass-card w-full max-w-lg p-8 rounded-2xl">
            <h2 className="text-2xl font-bold mb-6">Ask Question</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input required className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white" placeholder="Title" value={newDoubt.title} onChange={(e) => setNewDoubt({...newDoubt, title: e.target.value})} />
              <textarea required rows="4" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white" placeholder="Details..." value={newDoubt.content} onChange={(e) => setNewDoubt({...newDoubt, content: e.target.value})} />
              <input className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white" placeholder="Tags (comma separated)" value={newDoubt.tags} onChange={(e) => setNewDoubt({...newDoubt, tags: e.target.value})} />
              <div className="flex gap-3"><button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-3 bg-slate-800 rounded-xl">Cancel</button><button type="submit" className="flex-1 px-4 py-3 bg-indigo-600 rounded-xl">Post</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Doubts;
