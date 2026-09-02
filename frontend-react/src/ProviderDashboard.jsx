import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import Navbar from './Navbar';

const API_BASE = `${import.meta.env.VITE_API_URL}/api`;

const CURATED_SERVICES = {
  mobile_mechanic: { label: "Mobile Mechanic / Auto Repair", type: "in_person", defaultImage: "/service_mechanic.jpg", compliance: "I assume all liability for vehicular damage, parts, and tools." },
  hair_beauty: { label: "Hair & Beauty / Barber", type: "in_person", defaultImage: "/service_barber.jpg", compliance: "I confirm I maintain sanitary tools and hold necessary grooming certifications." },
  home_service: { label: "Home Services & Cleaning", type: "in_person", defaultImage: "/service_home.jpg", compliance: "I respect client property and assume full financial responsibility for on-site damage." },
  web_development: { label: "Web & App Development", type: "remote", defaultImage: "/service_code.jpg", compliance: "I agree to deliver functional code remotely and avoid malicious exploits." },
  graphic_design: { label: "Graphic Design & Digital Art", type: "remote", defaultImage: "/service_design.jpg", compliance: "I guarantee all artwork is original or properly licensed." }
};

const PREDEFINED_TITLES = {
  mobile_mechanic: ["Oil Change", "Brake Pad Replacement", "Diagnostics / Inspection", "Battery Replacement", "A/C Recharge", "Alternator Replacement"],
  hair_beauty: ["Men's Haircut & Fade", "Women's Cut & Style", "Beard Trim & Lineup", "Braiding", "Coloring / Highlights"],
  home_service: ["Standard House Cleaning", "Deep Cleaning", "Lawn Mowing & Edging", "Plumbing Diagnostics", "Furniture Assembly"],
  web_development: ["Landing Page Creation", "Full Stack Web App", "Bug Fixes / Maintenance", "UI/UX Redesign", "E-commerce Setup"],
  graphic_design: ["Logo Design", "Social Media Kit", "Stream Overlay Package", "Custom Illustration", "Brand Identity Guide"]
};

export default function ProviderDashboard() {
  const [activeTab, setActiveTab] = useState('schedule');
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);

  const [selectedCategory, setSelectedCategory] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchProfileAndSchedule();
  }, [activeTab]);

  const fetchProfileAndSchedule = async () => {
    setLoading(true);
    const token = localStorage.getItem('pidrop_token');
    try {
      const profRes = await fetch(`${API_BASE}/profile/me`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (profRes.ok) {
        const profData = await profRes.json();
        setProfile(profData);
        if (profData.primary_trade) {
          setSelectedCategory(profData.primary_trade);
        }
      }

      if (activeTab === 'schedule') {
        const apptRes = await fetch(`${API_BASE}/provider/appointments`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (apptRes.ok) setAppointments(await apptRes.json());
      }
    } catch (error) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateListing = async (e) => {
    e.preventDefault();
    if (!selectedCategory || !agreed || !title) return toast.error('Complete all required fields and agree to terms.');

    setIsSubmitting(true);
    const token = localStorage.getItem('pidrop_token');
    const categoryData = CURATED_SERVICES[selectedCategory];

    const payload = {
      title,
      description,
      price: parseFloat(price),
      service_type: categoryData.type,
      image_url: categoryData.defaultImage
    };

    try {
      const response = await fetch(`${API_BASE}/services`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      
      if (response.ok) {
        toast.success('Service published to the Vault!');
        setTitle(''); setDescription(''); setPrice(''); setAgreed(false);
        setActiveTab('schedule');
      } else {
        toast.error(data.detail || 'Failed to create listing');
      }
    } catch (error) {
      toast.error('Network error during submission');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCheckIn = async (appointmentId) => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }
    toast.loading('Acquiring GPS...', { id: 'gps' });
    navigator.geolocation.getCurrentPosition(async (position) => {
      const { latitude, longitude } = position.coords;
      const token = localStorage.getItem('pidrop_token');
      try {
        const response = await fetch(`${API_BASE}/appointments/${appointmentId}/check-in`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ actual_lat: latitude, actual_long: longitude })
        });
        const data = await response.json();
        if (response.ok) {
          toast.success('Checked in successfully!', { id: 'gps' });
          fetchProfileAndSchedule();
        } else {
          toast.error(data.detail || 'Check-in failed', { id: 'gps' });
        }
      } catch (error) {
        toast.error('Network error during check-in', { id: 'gps' });
      }
    }, () => {
      toast.error('Please allow location access.', { id: 'gps' });
    }, { enableHighAccuracy: true });
  };

  const handleComplete = async (appointmentId) => {
    const token = localStorage.getItem('pidrop_token');
    try {
      const response = await fetch(`${API_BASE}/appointments/${appointmentId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ proof_of_delivery_url: null })
      });
      if (response.ok) {
        toast.success('Job marked complete. Awaiting client confirmation.');
        fetchProfileAndSchedule();
      } else {
        const data = await response.json();
        toast.error(data.detail || 'Failed to complete job');
      }
    } catch (error) {
      toast.error('Network error');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-20 flex flex-col">
      <Navbar />
      <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-8 w-full mt-6">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight">Service Dash</h1>
          <div className="flex bg-slate-200 p-1 rounded-xl w-full md:w-auto">
            <button onClick={() => setActiveTab('schedule')} className={`flex-1 md:w-40 py-2 px-4 rounded-lg text-sm font-bold uppercase tracking-wider transition-all ${activeTab === 'schedule' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>My Schedule</button>
            <button onClick={() => setActiveTab('create')} className={`flex-1 md:w-40 py-2 px-4 rounded-lg text-sm font-bold uppercase tracking-wider transition-all ${activeTab === 'create' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Add Service</button>
          </div>
        </div>

        {activeTab === 'create' && (
          <div className="bg-white rounded-2xl p-6 md:p-8 border border-slate-200 shadow-sm">
            <form onSubmit={handleCreateListing} className="space-y-6">
              {profile?.primary_trade ? (
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Your Registered Trade</label>
                  <div className="w-full px-4 py-3 bg-cyan-50 border border-cyan-200 rounded-xl text-cyan-900 font-black flex items-center justify-between shadow-sm">
                    <span className="uppercase tracking-wide">{CURATED_SERVICES[profile.primary_trade]?.label || profile.primary_trade}</span>
                    <i className="fa-solid fa-lock text-cyan-600/50"></i>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Hustle Category</label>
                  <select 
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-cyan-500 font-bold text-slate-900"
                    required
                  >
                    <option value="" disabled>-- Choose a curated service type --</option>
                    {Object.entries(CURATED_SERVICES).map(([key, data]) => (
                      <option key={key} value={key}>{data.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {selectedCategory && (
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl space-y-3">
                  <div className="flex items-start gap-3">
                    <i className="fa-solid fa-scale-balanced text-amber-500 mt-1"></i>
                    <div>
                      <h4 className="text-xs font-black text-amber-900 uppercase tracking-widest">Compliance Agreement</h4>
                      <p className="text-sm text-amber-800 font-medium leading-relaxed mt-1">{CURATED_SERVICES[selectedCategory].compliance}</p>
                    </div>
                  </div>
                  <label className="flex items-center gap-3 cursor-pointer mt-4 pt-4 border-t border-amber-200/50">
                    <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="w-5 h-5 accent-amber-600 rounded cursor-pointer" />
                    <span className="text-sm font-bold text-amber-900">I have read and agree to these terms.</span>
                  </label>
                </div>
              )}

              <div className={`transition-opacity duration-300 ${!agreed ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Service Title</label>
                    <select 
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-cyan-500 text-sm font-bold"
                      required
                    >
                      <option value="" disabled>-- Select a specific service --</option>
                      {selectedCategory && PREDEFINED_TITLES[selectedCategory].map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Base Price (SC)</label>
                    <input type="number" min="1" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="150.00" className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-cyan-500 font-mono text-sm" required />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Description / Deliverables</label>
                    <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Detail exactly what the client gets for this price..." rows="4" className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-cyan-500 text-sm font-medium" required></textarea>
                  </div>

                  <button type="submit" disabled={isSubmitting || !agreed} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-4 rounded-xl transition-all disabled:opacity-50 uppercase tracking-wider">
                    {isSubmitting ? 'Publishing...' : 'List Service on Vault'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {activeTab === 'schedule' && (
          <>
            {loading ? (
               <div className="p-8 text-center text-slate-500 font-bold">Loading Schedule...</div>
            ) : appointments.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center shadow-sm">
                <p className="text-slate-500 font-bold">No active appointments found.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {appointments.map((appt) => (
                  <div key={appt.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-cyan-600 bg-cyan-50 border border-cyan-200 px-2 py-1 rounded-md mb-2 inline-block">
                        {appt.status.replace('_', ' ')}
                      </span>
                      <h3 className="text-lg font-black text-slate-900">Client: @{appt.client_username}</h3>
                      <p className="text-sm text-slate-600 font-medium">Time: {new Date(appt.scheduled_start).toLocaleString()}</p>
                      {appt.job_address && (
                        <p className="text-sm text-slate-500 mt-1"><i className="fa-solid fa-location-dot mr-2"></i>{appt.job_address}</p>
                      )}
                      <p className="text-sm font-bold text-emerald-600 mt-2">Escrow: {appt.escrow_amount.toFixed(2)} SC</p>
                    </div>

                    <div className="flex flex-col gap-2 w-full md:w-auto">
                      {appt.status === 'locked' && (
                        <button onClick={() => handleCheckIn(appt.id)} className="w-full md:w-auto bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 px-6 rounded-xl transition-all shadow-sm">
                          Check In (GPS)
                        </button>
                      )}
                      {appt.status === 'checked_in' && (
                        <button onClick={() => handleComplete(appt.id)} className="w-full md:w-auto bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2 px-6 rounded-xl transition-all shadow-sm">
                          Complete Job
                        </button>
                      )}
                      {appt.status === 'pending_confirmation' && (
                        <div className="w-full md:w-auto bg-amber-100 text-amber-700 font-bold py-2 px-6 rounded-xl text-center text-sm border border-amber-200">
                          Awaiting Client
                        </div>
                      )}
                      {appt.status === 'released' && (
                        <div className="w-full md:w-auto bg-emerald-100 text-emerald-700 font-bold py-2 px-6 rounded-xl text-center text-sm border border-emerald-200">
                          Paid
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
