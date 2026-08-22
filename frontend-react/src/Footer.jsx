import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="bg-slate-950 text-slate-400 pt-12 pb-24 sm:pb-12 border-t border-slate-900 mt-auto">
      <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-6">
        
        <div className="text-center md:text-left">
          <h3 className="text-white font-black uppercase tracking-widest font-heading mb-2">
            STREET CODE <span className="text-orange-500">101</span>
          </h3>
          <p className="text-xs font-mono">Authenticated Drops & Peer-to-Peer Ledger</p>
        </div>
        
        <div className="flex flex-wrap justify-center items-center gap-4 text-xs font-bold uppercase tracking-wider">
          <Link to="/legal/refunds" className="hover:text-orange-500 transition-colors">Refund Policy</Link>
          <Link to="/legal/privacy" className="hover:text-orange-500 transition-colors">Privacy Policy</Link>
          <Link to="/legal/terms" className="hover:text-orange-500 transition-colors">Terms of Service</Link>
          <span className="text-slate-500 font-mono lowercase tracking-normal">admin@streetcode101.com</span>
        </div>
        
        <div className="text-xs font-mono text-slate-600">
          © {new Date().getFullYear()} Street Code 101.
        </div>
      </div>
    </footer>
  );
}
