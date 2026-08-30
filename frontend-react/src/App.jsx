import Post from './Post';
import EmailCaptureModal from './EmailCaptureModal';
import Legal from './Legal';
import ForgotPassword from './ForgotPassword';
import ResetPassword from './ResetPassword';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { CartProvider } from './CartContext';
import Storefront from './Storefront';
import Admin from './Admin';
import Login from './Login';
import ProductPage from './ProductPage';
import Profile from './Profile';
import Feed from './Feed';
import Chat from './Chat';
import Inbox from './Inbox';
import VendorDashboard from './VendorDashboard';
import ScrollToTop from './ScrollToTop';

function App() {
  return (
    <CartProvider>
      <Router>
        <ScrollToTop />
        {/* Global Toast Container styled to match your dark theme */}
        <Toaster 
          position="top-right" 
          toastOptions={{ 
            duration: 4000, 
            style: { background: '#1e293b', color: '#fff', fontWeight: 'bold', borderRadius: '12px' },
            success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
            error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } }
          }} 
        />
        
        {/* Global Email Capture Modal */}
        <EmailCaptureModal />

        <Routes>
          <Route path="/" element={<Storefront />} />
          <Route path="/legal/:section" element={<Legal />} />
          <Route path="/product/:sku" element={<ProductPage />} />
          <Route path="/profile/:username" element={<Profile />} />
          <Route path="/vendor" element={<VendorDashboard />} />
          <Route path="/post/:id" element={<Post />} />
          <Route path="/chat/:targetUsername" element={<Chat />} />
          <Route path="/inbox" element={<Inbox />} />
          <Route path="/feed" element={<Feed />} />
          <Route path="/login" element={<Login />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
        </Routes>
      </Router>
    </CartProvider>
  );
}

export default App;
