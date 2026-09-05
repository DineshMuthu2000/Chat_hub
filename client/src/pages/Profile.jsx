import React, { useState, useEffect } from 'react';
import { User, Calendar, Shield, Award, LogOut, RefreshCw } from 'lucide-react';
import { api, getApiBase } from '../services/api';

const API_BASE = getApiBase();

const Profile = () => {
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || '{}'));

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = '/';
  };

  const handleRegenerate = async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/regenerate-name`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      }).then(r => r.json());
      
      if (res.user) {
        localStorage.setItem('user', JSON.stringify(res.user));
        localStorage.setItem('token', res.token);
        setUser(res.user);
      }
    } catch (err) { console.error(err); }
  };

  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <div className="glass-panel p-8 rounded-2xl flex flex-col items-center text-center">
        <div className="w-24 h-24 bg-indigo-600/20 rounded-full flex items-center justify-center mb-4 border border-indigo-500/30">
          <User size={48} className="text-indigo-400" />
        </div>
        <h1 className="text-3xl font-bold mb-1">{user.username}</h1>
        <p className="text-slate-400 mb-6 flex items-center gap-2"><Shield size={14}/> Anonymous Community Member</p>
        
        <div className="grid grid-cols-2 gap-4 w-full mb-8">
          <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800">
            <Award className="mx-auto mb-2 text-yellow-500" size={20}/>
            <div className="text-2xl font-bold">{user.reputation || 0}</div>
            <div className="text-xs text-slate-500 uppercase">Reputation</div>
          </div>
          <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800">
            <Calendar className="mx-auto mb-2 text-indigo-400" size={20}/>
            <div className="text-sm font-bold">{new Date(user.created_at).toLocaleDateString()}</div>
            <div className="text-xs text-slate-500 uppercase">Joined</div>
          </div>
        </div>

        <div className="flex flex-col gap-3 w-full">
          <button 
            onClick={handleRegenerate}
            className="flex items-center justify-center gap-2 w-full py-3 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors font-medium"
          >
            <RefreshCw size={18}/> Regenerate Identity
          </button>
          <button 
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 w-full py-3 bg-red-600/10 text-red-500 hover:bg-red-600/20 rounded-xl transition-colors font-medium"
          >
            <LogOut size={18}/> Sign Out
          </button>
        </div>
      </div>
      <p className="mt-8 text-center text-sm text-slate-500 italic">
        "Your phone number and personal details are never stored or exposed on this platform."
      </p>
    </div>
  );
};

export default Profile;
