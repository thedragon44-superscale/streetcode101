import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

const API_BASE = `${import.meta.env.VITE_API_URL}/api`;

export default function ProviderDashboard() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSchedule();
  }, []);

  const fetchSchedule = async () => {
    try {
      const token = localStorage.getItem('pidrop_token');
      const response = await fetch(`${API_BASE}/provider/appointments`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setAppointments(data);
      }
    } catch (error) {
      toast.error('Failed to load schedule');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async (appointmentId) => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }

    toast.loading('Acquiring GPS coordinates...', { id: 'gps' });

    navigator.geolocation.getCurrentPosition(async (position) => {
      const { latitude, longitude } = position.coords;
      const token = localStorage.getItem('pidrop_token');

      try {
        const response = await fetch(`${API_BASE}/appointments/${appointmentId}/check-in`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ actual_lat: latitude, actual_long: longitude })
        });

        const data = await response.json();
        
        if (response.ok) {
          toast.success('Checked in successfully!', { id: 'gps' });
          fetchSchedule(); // Refresh the UI
        } else {
          toast.error(data.detail || 'Check-in failed', { id: 'gps' });
        }
      } catch (error) {
        toast.error('Network error during check-in', { id: 'gps' });
      }
    }, (error) => {
      toast.error('Please allow location access to check in.', { id: 'gps' });
    }, { enableHighAccuracy: true });
  };

  const handleComplete = async (appointmentId) => {
    const token = localStorage.getItem('pidrop_token');
    try {
      const response = await fetch(`${API_BASE}/appointments/${appointmentId}/complete`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ proof_of_delivery_url: null }) // Can be expanded for file uploads later
      });

      if (response.ok) {
        toast.success('Job marked complete. Awaiting client confirmation.');
        fetchSchedule();
      } else {
        const data = await response.json();
        toast.error(data.detail || 'Failed to complete job');
      }
    } catch (error) {
      toast.error('Network error');
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500 font-bold">Loading Schedule...</div>;

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8">
      <h1 className="text-3xl font-black text-slate-900 mb-8 uppercase tracking-tight">Service Control Center</h1>
      
      {appointments.length === 0 ? (
        <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center shadow-sm">
          <p className="text-slate-500 font-bold">No active appointments found.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {appointments.map((appt) => (
            <div key={appt.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-orange-500 bg-orange-50 px-2 py-1 rounded-md mb-2 inline-block">
                  {appt.status.replace('_', ' ')}
                </span>
                <h3 className="text-lg font-black text-slate-900">Client: @{appt.client_username}</h3>
                <p className="text-sm text-slate-600 font-medium">Time: {new Date(appt.scheduled_start).toLocaleString()}</p>
                {appt.job_address && (
                  <p className="text-sm text-slate-500 mt-1"><i className="fa-solid fa-location-dot mr-2"></i>{appt.job_address}</p>
                )}
                <p className="text-sm font-bold text-emerald-600 mt-2">Escrow: {appt.escrow_amount.toFixed(2)} SC</p>
              </div>

              <div className="flex gap-2 w-full md:w-auto">
                {appt.status === 'locked' && (
                  <button 
                    onClick={() => handleCheckIn(appt.id)}
                    className="w-full md:w-auto bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 px-6 rounded-xl transition-all"
                  >
                    Check In (GPS)
                  </button>
                )}
                
                {appt.status === 'checked_in' && (
                  <button 
                    onClick={() => handleComplete(appt.id)}
                    className="w-full md:w-auto bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2 px-6 rounded-xl transition-all"
                  >
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
    </div>
  );
}
