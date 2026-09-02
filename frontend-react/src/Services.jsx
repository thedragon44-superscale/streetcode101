import { useState, useEffect } from 'react';
import Navbar from './Navbar';
import toast from 'react-hot-toast';

const API_BASE = `${import.meta.env.VITE_API_URL}/api`;

export default function Services() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Booking Modal State
  const [activeBooking, setActiveBooking] = useState(null);
  const [bookingDetails, setBookingDetails] = useState({});
  const [scheduledStart, setScheduledStart] = useState('');
  const [jobAddress, setJobAddress] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      const res = await fetch(`${API_BASE}/services`);
      if (res.ok) {
        const data = await res.json();
        setServices(data);
      }
    } catch (err) {
      toast.error('Failed to load services.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenBooking = (service) => {
    const token = localStorage.getItem('pidrop_token');
    if (!token) {
      toast.error('You must be logged in to book a service.');
      return;
    }
    setActiveBooking(service);
    setBookingDetails({});
    setScheduledStart('');
    setJobAddress('');
  };

  const submitBooking = async (e) => {
    e.preventDefault();
    if (!scheduledStart) return toast.error('Please select a preferred date and time.');
    
    setIsSubmitting(true);
    const token = localStorage.getItem('pidrop_token');

    const payload = {
      service_id: activeBooking.id,
      scheduled_start: new Date(scheduledStart).toISOString(),
      job_address: activeBooking.service_type === 'in_person' ? jobAddress : null,
      booking_details: bookingDetails // Sends the dynamic Y/M/M data as JSON
    };

    try {
      const res = await fetch(`${API_BASE}/appointments`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (res.ok) {
        toast.success(`Escrow Locked! ${activeBooking.price} SC deducted.`);
        setActiveBooking(null);
      } else {
        toast.error(data.detail || 'Booking failed. Check your wallet balance.');
      }
    } catch (err) {
      toast.error('Network error during booking.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderDynamicFields = (trade) => {
    if (trade === 'mobile_mechanic') {
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <input type="text" placeholder="Year" onChange={e => setBookingDetails({...bookingDetails, year: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" required />
            <input type="text" placeholder="Make" onChange={e => setBookingDetails({...bookingDetails, make: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" required />
            <input type="text" placeholder="Model" onChange={e => setBookingDetails({...bookingDetails, model: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" required />
          </div>
          <textarea placeholder="Describe symptoms or required parts..." onChange={e => setBookingDetails({...bookingDetails, symptoms: e.target.value})} rows="3" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" required></textarea>
        </div>
      );
    }
    if (trade === 'hair_beauty') {
      return (
        <div className="space-y-4">
          <input type="text" placeholder="Requested Style / Specifics" onChange={e => setBookingDetails({...bookingDetails, style: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" required />
          <textarea placeholder="Any allergies to products or notes?" onChange={e => setBookingDetails({...bookingDetails, notes: e.target.value})} rows="2" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"></textarea>
        </div>
      );
    }
    return (
      <textarea placeholder="Project details, links, or specific requests..." onChange={e => setBookingDetails({...bookingDetails, description: e.target.value})} rows="3" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" required></textarea>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-20 flex flex-col">
      <Navbar />
      
      <main className="max-w-6xl mx-auto px-4 py-8 w-full">
        <div className="mb-8">
          <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight">Service Catalog</h1>
          <p className="text-slate-500 font-medium mt-2">Hire verified professionals. Funds held securely in Escrow until the job is done.</p>
        </div>

        {loading ? (
          <div className="text-center p-12 text-slate-400 font-bold">Loading Vault...</div>
        ) : services.length === 0 ? (
          <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center shadow-sm">
            <p className="text-slate-500 font-bold">No services published yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map(service => (
              <div key={service.id} className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 flex flex-col relative overflow-hidden group">
                <div className="flex justify-between items-start mb-4">
                  <div className="text-xs font-bold text-cyan-600 bg-cyan-50 px-2 py-1 rounded-md uppercase tracking-widest inline-block">
                    {service.service_type === 'in_person' ? 'On-Site' : 'Remote'}
                  </div>
                  <span className="text-lg font-black text-slate-900">{service.price.toFixed(2)} SC</span>
                </div>
                
                <h3 className="text-xl font-black text-slate-900 leading-tight mb-2">{service.title}</h3>
                <p className="text-sm font-bold text-slate-400 mb-4">By @{service.provider_username}</p>
                <p className="text-sm text-slate-600 font-medium flex-1 whitespace-pre-wrap mb-6 line-clamp-3">{service.description}</p>
                
                <button 
                  onClick={() => handleOpenBooking(service)}
                  className="w-full bg-slate-900 hover:bg-cyan-600 text-white font-bold py-3 rounded-xl transition-all shadow-sm uppercase tracking-wider text-sm"
                >
                  Book Service
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* DYNAMIC BOOKING MODAL */}
      {activeBooking && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col relative overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-black text-lg text-slate-900">Lock Escrow</h3>
              <button onClick={() => setActiveBooking(null)} className="text-slate-400 hover:text-slate-700 font-bold">✕</button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <div className="mb-6 pb-6 border-b border-slate-100">
                <h4 className="font-bold text-slate-900">{activeBooking.title}</h4>
                <p className="text-sm text-slate-500 mt-1">Provider: @{activeBooking.provider_username}</p>
                <div className="mt-3 bg-orange-50 text-orange-800 p-3 rounded-xl border border-orange-200 text-sm font-bold flex items-center justify-between">
                  <span>Total Due:</span>
                  <span className="text-lg">{activeBooking.price.toFixed(2)} SC</span>
                </div>
              </div>

              <form onSubmit={submitBooking} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Preferred Date & Time</label>
                  <input type="datetime-local" value={scheduledStart} onChange={e => setScheduledStart(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold focus:outline-none focus:border-cyan-500" required />
                </div>

                {activeBooking.service_type === 'in_person' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Service Location (Full Address)</label>
                    <input type="text" placeholder="123 Main St, City, ST 12345" value={jobAddress} onChange={e => setJobAddress(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium focus:outline-none focus:border-cyan-500" required />
                  </div>
                )}

                <div className="pt-2">
                  <label className="block text-xs font-bold text-cyan-600 uppercase tracking-widest mb-2 border-b border-cyan-100 pb-2">Project Details</label>
                  {/* We infer the trade based on the predefined titles or a backend field. For now, checking title keywords or passing primary_trade from backend */}
                  {renderDynamicFields(activeBooking.title.includes('Change') || activeBooking.title.includes('Brake') ? 'mobile_mechanic' : activeBooking.title.includes('Hair') || activeBooking.title.includes('Trim') ? 'hair_beauty' : 'general')}
                </div>

                <button type="submit" disabled={isSubmitting} className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-black py-4 rounded-xl mt-4 disabled:opacity-50 transition-all uppercase tracking-wider shadow-md">
                  {isSubmitting ? 'Processing...' : 'Confirm & Lock Funds'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
