import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

const Home = () => {
  const navigate = useNavigate();

  const handleJoin = async () => {
    console.log("Join button clicked!");
    try {
      const res = await api.anonymousJoin();
      console.log("API response:", res);
      if (res.token) {
        localStorage.setItem('token', res.token);
        localStorage.setItem('user', JSON.stringify(res.user));
        navigate('/doubts');
      }
    } catch (error) {
      console.error("Error joining:", error);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] gap-6">
      <h1 className="text-6xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-cyan-400">
        Anonymous Community Hub
      </h1>
      <p className="text-xl text-slate-400 max-w-2xl text-center">
        Join instantly, ask questions, share files, and chat in real-time. 
        Your privacy is our priority—no personal details, ever.
      </p>
      <button 
        onClick={handleJoin}
        className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full font-semibold text-lg transition-all"
      >
        Join Anonymously
      </button>
    </div>
  );
};

export default Home;
