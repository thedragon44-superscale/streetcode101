import { useParams, Link } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';

export default function Legal() {
  const { section } = useParams();
  const activeSection = section || 'terms';

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800 flex flex-col">
      <Navbar />
      
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 md:py-12 relative z-0">
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col md:flex-row">
          
          {/* Sidebar Tabs */}
          <div className="md:w-64 bg-slate-50 border-r border-slate-200 p-6 flex flex-col gap-2">
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">Compliance</h2>
            <Link to="/legal/refunds" className={`px-4 py-3 rounded-xl font-bold text-sm transition-colors ${activeSection === 'refunds' ? 'bg-orange-500 text-white shadow-md' : 'text-slate-600 hover:bg-slate-200'}`}>Refund Policy</Link>
            <Link to="/legal/privacy" className={`px-4 py-3 rounded-xl font-bold text-sm transition-colors ${activeSection === 'privacy' ? 'bg-orange-500 text-white shadow-md' : 'text-slate-600 hover:bg-slate-200'}`}>Privacy Policy</Link>
            <Link to="/legal/terms" className={`px-4 py-3 rounded-xl font-bold text-sm transition-colors ${activeSection === 'terms' ? 'bg-orange-500 text-white shadow-md' : 'text-slate-600 hover:bg-slate-200'}`}>Terms of Service</Link>
          </div>
          
          {/* Content Area */}
          <div className="flex-1 p-6 md:p-12">
            {activeSection === 'refunds' && (
              <div className="prose prose-slate max-w-none">
                <h1 className="text-3xl font-black mb-6 uppercase tracking-tight">Returns & Refunds</h1>
                <p><strong>Street Code 101</strong> offers a 30-day return policy. If 30 days have passed since your purchase was delivered, unfortunately, we cannot offer you a refund or exchange.</p>
                <p>To be eligible for a return, your item must be unused, in the same condition that you received it, and in its original packaging.</p>
                <h3 className="text-xl font-bold mt-8 mb-3 uppercase tracking-wider text-slate-400 text-xs">Initiating a Return</h3>
                <p>Do not send your purchase back to the manufacturer or the return address on the package. To initiate a return, please contact our support team via the chat widget on our storefront or email us at <strong>support@streetcode101.com</strong> with your Order ID. We will provide you with the correct return shipping address.</p>
                <h3 className="text-xl font-bold mt-8 mb-3 uppercase tracking-wider text-slate-400 text-xs">Refunds</h3>
                <p>Once your return is received and inspected, we will notify you of the approval or rejection of your refund. If approved, your refund will be processed, and a credit will automatically be applied to your original method of payment (via Stripe) within 5-10 business days.</p>
              </div>
            )}

            {activeSection === 'privacy' && (
              <div className="prose prose-slate max-w-none">
                <h1 className="text-3xl font-black mb-6 uppercase tracking-tight">Privacy Policy</h1>
                <h3 className="text-xl font-bold mt-8 mb-3 uppercase tracking-wider text-slate-400 text-xs">Data Collection</h3>
                <p>When you purchase something from our store, we collect the personal information you give us such as your name, address, and email address to fulfill your order.</p>
                <h3 className="text-xl font-bold mt-8 mb-3 uppercase tracking-wider text-slate-400 text-xs">Secure Payments</h3>
                <p>All payments are processed securely through Stripe. Street Code 101 does not store, process, or have access to your full credit card information. Your payment data is encrypted and handled directly by Stripe's secure infrastructure.</p>
                <h3 className="text-xl font-bold mt-8 mb-3 uppercase tracking-wider text-slate-400 text-xs">Social Feed & Profiles</h3>
                <p>If you utilize our peer-to-peer social feed, your chosen username, profile image, and listing details will be publicly visible to other users.</p>
                <h3 className="text-xl font-bold mt-8 mb-3 uppercase tracking-wider text-slate-400 text-xs">Third-Party Services</h3>
                <p>We share your shipping information solely with our verified global fulfillment partners strictly for the purpose of shipping your order. We do not sell your personal information to third parties.</p>
              </div>
            )}

            {activeSection === 'terms' && (
              <div className="prose prose-slate max-w-none">
                <h1 className="text-3xl font-black mb-6 uppercase tracking-tight">Terms of Service</h1>
                <h3 className="text-xl font-bold mt-8 mb-3 uppercase tracking-wider text-slate-400 text-xs">General Conditions</h3>
                <p>By visiting our site and purchasing something from us, you engage in our "Service" and agree to be bound by the following terms and conditions.</p>
                <h3 className="text-xl font-bold mt-8 mb-3 uppercase tracking-wider text-slate-400 text-xs">Shipping & Fulfillment</h3>
                <p>Street Code 101 curates products from a global partner network. Standard global shipping typically takes 7-14 business days. While we strive to meet these estimates, delivery times are not guaranteed and may be subject to customs or carrier delays.</p>
                <h3 className="text-xl font-bold mt-8 mb-3 uppercase tracking-wider text-slate-400 text-xs">Peer-to-Peer Marketplace</h3>
                <p>Street Code 101 provides a social feed for users to list their own items. We do not manufacture, inspect, or guarantee the quality of user-listed items. We reserve the right to remove any user-generated content or listings that violate our community standards at our sole discretion.</p>
                <h3 className="text-xl font-bold mt-8 mb-3 uppercase tracking-wider text-slate-400 text-xs">Accuracy of Information</h3>
                <p>We are not responsible if information made available on this site is not accurate, complete, or current. Prices for our products are subject to change without notice.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
