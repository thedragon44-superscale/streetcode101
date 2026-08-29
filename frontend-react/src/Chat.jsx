import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
const API_BASE = `${API_URL}/api`;
const WS_BASE = `${API_URL.replace(/^http/, 'ws')}/api/ws/chat`;

export default function Chat() {
  const { targetUsername } = useParams();
  const navigate = useNavigate();
  
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  const ws = useRef(null);
  const messagesEndRef = useRef(null);

  const token = localStorage.getItem('pidrop_token');
  const myUsername = token ? JSON.parse(atob(token.split('.')[1])).sub : null;

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }

    if (!targetUsername) {
      setLoading(false);
      return;
    }

    setLoading(true);
    
    // 1. Fetch History
    fetch(`${API_BASE}/messages/${targetUsername}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        setMessages(data);
        setLoading(false);
      })
      .catch(err => console.error(err));

    // 2. Establish WebSocket Connection
    ws.current = new WebSocket(`${WS_BASE}/${token}`);
    
    ws.current.onmessage = (event) => {
      const newMsg = JSON.parse(event.data);
      if (newMsg.sender === targetUsername || newMsg.receiver === targetUsername) {
        setMessages(prev => [...prev, newMsg]);
      }
    };

    return () => {
      if (ws.current) ws.current.close();
    };
  }, [targetUsername, token, navigate]);

  // Global Search API
  useEffect(() => {
    if (searchQuery.trim().length > 0) {
      fetch(`${API_BASE}/search?q=${encodeURIComponent(searchQuery)}`)
        .then(res => res.ok ? res.json() : { users: [] })
        .then(data => setSearchResults(data.users || []))
        .catch(err => console.error("Search failed:", err));
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (targetUsername) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, targetUsername]);

  const sendMessage = (e) => {
    e.preventDefault();
    if (!input.trim() || !ws.current) return;

    ws.current.send(JSON.stringify({
      receiver: targetUsername,
      text: input
    }));
    
    setInput('');
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-slate-900 h-20 animate-pulse"></header>
      <main className="flex-1 max-w-3xl w-full mx-auto p-4 flex flex-col gap-6 mt-4">
        <div className="h-12 w-2/3 bg-slate-200 rounded-2xl animate-pulse self-start rounded-bl-sm"></div>
        <div className="h-12 w-1/2 bg-slate-200 rounded-2xl animate-pulse self-end rounded-br-sm"></div>
        <div className="h-16 w-3/4 bg-slate-200 rounded-2xl animate-pulse self-start rounded-bl-sm"></div>
      </main>
      <footer className="bg-white h-20 border-t border-slate-200 animate-pulse"></footer>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      
      <header className="bg-slate-900 text-white shadow-md sticky top-0 z-50">
        {/* Top Header Row */}
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-white transition">
            <i className="fa-solid fa-arrow-left text-xl"></i>
          </button>
          {targetUsername ? (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center font-black text-slate-300 uppercase">
                {targetUsername[0]}
              </div>
              <div>
                <h2 className="font-bold text-lg leading-tight">@{targetUsername}</h2>
                <span className="text-xs text-cyan-400 font-bold tracking-widest uppercase"><i className="fa-solid fa-lock mr-1"></i> E2EE Secured</span>
              </div>
            </div>
          ) : (
            <h2 className="font-bold text-lg leading-tight uppercase tracking-widest">Inbox</h2>
          )}
        </div>

        {/* META-Style Search Bar */}
        <div className="bg-slate-950 px-4 py-3 border-t border-slate-800 relative">
          <div className="max-w-3xl mx-auto relative">
            <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm"></i>
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search users to message..."
              className="w-full bg-slate-900 border border-slate-700 text-white placeholder-slate-500 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-all"
            />
            
            {/* Search Dropdown */}
            {searchQuery.trim().length > 0 && (
              <div className="absolute top-[110%] left-0 right-0 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-50 max-h-64 overflow-y-auto">
                {searchResults.length > 0 ? (
                  searchResults.map(user => (
                    <Link 
                      key={user.username}
                      to={`/chat/${user.username}`}
                      onClick={() => setSearchQuery('')}
                      className="flex items-center gap-3 p-3 hover:bg-slate-50 border-b border-slate-100 last:border-0 transition-colors"
                    >
                      <img src={user.profile_image_url} alt={user.username} className="w-10 h-10 rounded-full object-cover border border-slate-200 bg-slate-100" />
                      <span className="font-bold text-slate-900">@{user.username}</span>
                    </Link>
                  ))
                ) : (
                  <div className="p-4 text-center text-slate-500 text-sm font-medium">No users found.</div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main View Area */}
      <main className="flex-1 max-w-3xl w-full mx-auto p-4 overflow-y-auto flex flex-col gap-4">
        {!targetUsername ? (
          <div className="text-center text-slate-400 mt-20 flex flex-col items-center">
            <i className="fa-solid fa-inbox text-5xl mb-4 text-slate-300"></i>
            <h3 className="font-black text-slate-700 text-xl uppercase tracking-widest mb-2">Secure Inbox</h3>
            <p className="text-sm font-medium">Search for a vendor or community member above to start an E2EE transmission.</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-slate-400 mt-10 text-sm font-medium">
            No secure history with @{targetUsername}. Start the transmission.
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isMe = msg.sender === myUsername;
            return (
              <div key={idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] px-4 py-3 rounded-2xl shadow-sm text-sm ${isMe ? 'bg-cyan-600 text-white rounded-br-sm' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm'}`}>
                  {msg.text}
                  <div className={`text-[10px] mt-1 text-right ${isMe ? 'text-cyan-200' : 'text-slate-400'}`}>
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </main>

      {/* Input Area (Only visible if chatting with someone) */}
      {targetUsername && (
        <footer className="bg-white border-t border-slate-200 p-4 sticky bottom-0">
          <form onSubmit={sendMessage} className="max-w-3xl mx-auto flex gap-3">
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Transmit secure payload..." 
              className="flex-1 px-4 py-3 bg-slate-100 border border-slate-300 rounded-full focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
            />
            <button 
              type="submit" 
              disabled={!input.trim()}
              className="bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-300 text-white w-12 h-12 rounded-full flex items-center justify-center shadow-md transition-colors"
            >
              <i className="fa-solid fa-paper-plane"></i>
            </button>
          </form>
        </footer>
      )}
    </div>
  );
}
