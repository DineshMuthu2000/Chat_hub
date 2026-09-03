import React, { useState, useEffect } from 'react';

export default function AdminDashboard() {
  const [pw, setPw] = useState('');
  const [token, setToken] = useState(localStorage.getItem('adminToken') || '');
  const [tab, setTab] = useState('stats');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [doubts, setDoubts] = useState([]);
  const [uploads, setUploads] = useState([]);
  const [bc, setBc] = useState({ title: '', message: '' });
  const [err, setErr] = useState('');

  const h = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

  const handleLogin = async (e) => {
    e.preventDefault();
    const r = await fetch('/api/auth/admin-login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw })
    });
    const d = await r.json();
    if (r.ok) { localStorage.setItem('adminToken', d.token); setToken(d.token); }
    else setErr(d.error || 'Failed');
  };

  const fetchTab = async () => {
    if (!token) return;
    const get = async (url) => (await fetch(url, { headers: h })).json();
    if (tab === 'stats') setStats(await get('/api/admin/stats'));
    if (tab === 'users') setUsers(await get('/api/admin/users'));
    if (tab === 'doubts') setDoubts(await (await fetch('/api/doubts')).json());
    if (tab === 'uploads') setUploads(await get('/api/uploads'));
  };

  useEffect(() => { fetchTab(); }, [token, tab]);

  const toggle = async (uid, cur) => {
    await fetch(`/api/admin/users/${uid}/status`, {
      method: 'PUT', headers: h, body: JSON.stringify({ status: cur === 'active' ? 'banned' : 'active' })
    });
    fetchTab();
  };

  const del = async (url) => {
    if (confirm('Sure?')) { await fetch(url, { method: 'DELETE', headers: h }); fetchTab(); }
  };

  if (!token) return (
    <form onSubmit={handleLogin} className="max-w-md mx-auto py-16 p-8 bg-slate-800 rounded-2xl space-y-4">
      <h2 className="text-xl font-bold">Admin</h2>
      {err && <div className="text-red-400">{err}</div>}
      <input type="password" placeholder="Password" value={pw} onChange={e => setPw(e.target.value)} className="w-full bg-slate-900 p-3 rounded" />
      <button className="w-full bg-indigo-600 py-2 rounded">Login</button>
    </form>
  );

  return (
    <div className="py-8 max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between">
        <h1 className="text-2xl font-bold text-indigo-400">Admin Dashboard</h1>
        <button onClick={() => { localStorage.removeItem('adminToken'); setToken(''); }} className="bg-slate-800 px-4 py-2 rounded">Logout</button>
      </div>
      <div className="flex gap-2">
        {['stats','users','doubts','uploads','broadcast'].map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded capitalize ${tab === t ? 'bg-indigo-600' : 'bg-slate-900'}`}>{t}</button>
        ))}
      </div>
      {tab === 'stats' && stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(stats).map(([k, v]) => (
            <div key={k} className="bg-slate-800 p-4 rounded text-center"><div className="text-2xl font-bold">{v}</div><div className="text-xs text-slate-400 uppercase">{k}</div></div>
          ))}
        </div>
      )}
      {tab === 'users' && (
        <table className="w-full bg-slate-800 rounded overflow-hidden text-left">
          <thead><tr className="bg-slate-900">
            <th className="p-3">User</th><th className="p-3">Role</th><th className="p-3">Status</th><th className="p-3 text-right">Actions</th>
          </tr></thead>
          <tbody>{users.map(u => (
            <tr key={u.id} className="border-b border-slate-700">
              <td className="p-3">{u.username}</td><td className="p-3 uppercase text-xs">{u.role}</td><td className="p-3">{u.status}</td>
              <td className="p-3 text-right space-x-2">{u.role !== 'admin' && (
                <><button onClick={() => toggle(u.id, u.status)} className="text-xs text-amber-400">{u.status === 'active'?'Ban':'Unban'}</button>
                <button onClick={() => del(`/api/admin/users/${u.id}`)} className="text-xs text-red-400">Delete</button></>
              )}</td>
            </tr>
          ))}</tbody>
        </table>
      )}
      {tab === 'doubts' && doubts.map(d => (
        <div key={d.id} className="bg-slate-800 p-4 rounded flex justify-between">
          <div>{d.title}<div className="text-xs text-slate-400">By {d.anonymous_name}</div></div>
          <button onClick={() => del(`/api/admin/doubts/${d.id}`)} className="text-red-400">Delete</button>
        </div>
      ))}
      {tab === 'uploads' && uploads.map(f => (
        <div key={f.id} className="bg-slate-800 p-4 rounded flex justify-between">
          <div>{f.file_name}<div className="text-xs text-slate-400">By {f.uploader_name}</div></div>
          <button onClick={() => del(`/api/admin/uploads/${f.id}`)} className="text-red-400">Delete</button>
        </div>
      ))}
      {tab === 'broadcast' && (
        <form onSubmit={e => {
          e.preventDefault();
          fetch('/api/admin/broadcast', { method: 'POST', headers: h, body: JSON.stringify(bc) }).then(() => { alert('Sent!'); setBc({title:'',message:''}); });
        }} className="bg-slate-800 p-6 rounded space-y-4 max-w-md mx-auto">
          <input required placeholder="Title" value={bc.title} onChange={e => setBc({...bc, title: e.target.value})} className="w-full bg-slate-900 p-3 rounded" />
          <textarea required placeholder="Message" value={bc.message} onChange={e => setBc({...bc, message: e.target.value})} className="w-full bg-slate-900 p-3 rounded" />
          <button className="w-full bg-indigo-600 py-2 rounded">Broadcast</button>
        </form>
      )}
    </div>
  );
}
