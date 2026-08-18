import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useCart } from './CartContext';
import Navbar from './Navbar';

const API_BASE = 'http://127.0.0.1:8000/api';

export default function ProductPage() {
  const { sku } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Global Cart
  const { addToCart } = useCart();

  // Fetch the single product
  useEffect(() => {
    fetch(`${API_BASE}/products/${sku}`)
      .then((res) => {
        if (!res.ok) throw new Error('Product not found');
        return res.json();
      })
      .then((data) => {
        setProduct(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [sku]);

  // Wrapper for global addToCart since this page only has one product
  const handleAddToCart = () => {
    addToCart(product);
  };

  // --- SKELETON LOADER ---
  if (loading) return (
    <div className="min-h-screen bg-white font-sans text-slate-900 flex flex-col">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-10 w-full grid grid-cols-1 md:grid-cols-12 gap-8">
        <div className="md:col-span-5 aspect-square bg-slate-100 rounded-2xl animate-pulse"></div>
        <div className="md:col-span-4 space-y-4 pt-4">
          <div className="h-8 bg-slate-200 rounded-md w-3/4 animate-pulse"></div>
          <div className="h-4 bg-slate-200 rounded-md w-1/2 animate-pulse"></div>
          <div className="h-12 bg-slate-200 rounded-md w-1/3 animate-pulse mt-8"></div>
          <div className="space-y-3 mt-8">
            <div className="h-4 bg-slate-200 rounded-md w-full animate-pulse"></div>
            <div className="h-4 bg-slate-200 rounded-md w-full animate-pulse"></div>
            <div className="h-4 bg-slate-200 rounded-md w-4/5 animate-pulse"></div>
          </div>
        </div>
        <div className="md:col-span-3 h-[380px] bg-slate-50 border border-slate-100 rounded-2xl animate-pulse mt-4"></div>
      </main>
    </div>
  );

  if (error) return <div className="min-h-screen flex items-center justify-center font-bold text-red-500">Error: {error}</div>;

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900">
      
      {/* Global Navbar (No Search Bar on Product Page) */}
      <Navbar />

      {/* Breadcrumbs */}
      <div className="max-w-7xl mx-auto px-4 py-4 text-sm text-slate-500">
        <Link to="/" className="hover:underline font-bold text-cyan-700">Home</Link> <span className="mx-2 text-slate-300">/</span> 
        <span className="text-slate-900 font-medium">{product.title}</span>
      </div>

      {/* Main Product Layout */}
      <main className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 md:grid-cols-12 gap-8">
        
        {/* Left Column: Image */}
        <div className="md:col-span-5 flex justify-center p-8 bg-slate-50 rounded-3xl border border-slate-100 shadow-inner">
          <img src={product.image_url} alt={product.title} className="max-w-full h-auto object-contain mix-blend-multiply hover:scale-105 transition-transform duration-500" />
        </div>

        {/* Center Column: Details */}
        <div className="md:col-span-4 flex flex-col pt-2">
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight mb-2">{product.title}</h1>
          <Link to="/" className="text-cyan-700 font-bold hover:underline text-sm mb-4">Visit the Street Code 101 Store</Link>
          
          <div className="flex items-center gap-2 mb-6 border-b border-slate-200 pb-6">
            <div className="text-yellow-400 text-sm">
              <i className="fa-solid fa-star"></i><i className="fa-solid fa-star"></i><i className="fa-solid fa-star"></i><i className="fa-solid fa-star"></i><i className="fa-solid fa-star-half-stroke"></i>
            </div>
            <span className="text-cyan-700 hover:underline cursor-pointer text-sm font-bold">Verified Local Reviews</span>
          </div>

          <div className="flex items-start mb-6 text-slate-900">
            <span className="text-sm font-black mt-1">$</span>
            <span className="text-5xl font-black">{Math.floor(product.price)}</span>
            <span className="text-sm font-black mt-1">{(product.price % 1).toFixed(2).substring(2)}</span>
          </div>

          <div className="space-y-4 text-sm text-slate-600 leading-relaxed bg-slate-50 p-6 rounded-2xl border border-slate-100">
            <p className="font-black text-slate-900 text-base uppercase tracking-wide">About this drop</p>
            <ul className="list-disc pl-5 space-y-3 font-medium">
              <li>{product.description}</li>
              <li>Premium materials sourced for peak streetwear performance.</li>
              <li>Backed by the Street Code 101 authenticity guarantee.</li>
              <li className="text-slate-400 font-mono text-xs">SKU: {product.sku}</li>
            </ul>
          </div>
        </div>

        {/* Right Column: Buy Box */}
        <div className="md:col-span-3">
          <div className="border border-slate-200 rounded-3xl p-6 shadow-xl shadow-slate-200/50 sticky top-24">
            <div className="text-3xl font-black text-slate-900 mb-4">${product.price.toFixed(2)}</div>
            
            <div className="text-sm text-slate-600 mb-4">
              <span className="font-bold text-cyan-700 hover:underline cursor-pointer">FREE Returns</span>
            </div>
            
            <div className="text-sm mb-6">
              <span className="font-bold text-cyan-700 hover:underline cursor-pointer">FREE delivery</span> 
              <span className="font-bold text-slate-900"> {new Date(Date.now() + 172800000).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
            </div>

            {product.in_stock ? (
              <div className="text-lg font-black text-emerald-600 mb-6 flex items-center gap-2">
                <i className="fa-solid fa-circle-check"></i> In Stock
              </div>
            ) : (
              <div className="text-lg font-black text-red-600 mb-6 flex items-center gap-2">
                <i className="fa-solid fa-circle-xmark"></i> Currently Unavailable
              </div>
            )}

            <button 
              disabled={!product.in_stock}
              onClick={handleAddToCart}
              className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-black py-4 rounded-xl shadow-md transition-all active:scale-[0.98] mb-3 uppercase tracking-wider"
            >
              {product.in_stock ? 'Add to Cart' : 'Out of Stock'}
            </button>
            <button 
              disabled={!product.in_stock}
              onClick={() => { handleAddToCart(); /* Add instant checkout logic here later */ }}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-black py-4 rounded-xl shadow-md transition-all active:scale-[0.98] uppercase tracking-wider"
            >
              Buy Now
            </button>

            <div className="mt-6 text-xs text-slate-500 space-y-3 font-medium bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div className="flex justify-between"><span>Ships from</span> <span className="font-bold text-slate-900">Street Code 101</span></div>
              <div className="flex justify-between"><span>Sold by</span> <span className="font-bold text-slate-900">Street Code 101</span></div>
              <div className="flex justify-between"><span>Returns</span> <span className="font-bold text-cyan-700 hover:underline cursor-pointer">30-day refund policy</span></div>
            </div>
          </div>
        </div>
      </main>

    </div>
  );
}
