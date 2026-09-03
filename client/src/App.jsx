import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home';
import Doubts from './pages/Doubts';
import DoubtDetail from './pages/DoubtDetail';
import Chats from './pages/Chats';
import Profile from './pages/Profile';
import AdminDashboard from './pages/AdminDashboard';

const Navbar = () => (
  <nav className="glass-panel sticky top-0 z-50 p-4 flex items-center justify-between">
    <Link to="/" className="text-2xl font-bold text-indigo-400">AnonHub</Link>
    <div className="flex gap-4">
      <Link to="/doubts" className="text-slate-100 hover:text-indigo-400">Doubts</Link>
      <Link to="/chats" className="text-slate-100 hover:text-indigo-400">Chats</Link>
      <Link to="/profile" className="text-slate-100 hover:text-indigo-400">Profile</Link>
      <Link to="/admin" className="text-red-400 hover:text-red-300">Admin</Link>
    </div>
  </nav>
);

function App() {
  return (
    <Router>
      <div className="min-h-screen text-slate-100">
        <Navbar />
        <main className="container mx-auto p-4">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/doubts" element={<Doubts />} />
            <Route path="/doubts/:id" element={<DoubtDetail />} />
            <Route path="/chats" element={<Chats />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/admin" element={<AdminDashboard />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
