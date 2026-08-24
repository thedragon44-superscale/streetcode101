import { useState } from 'react';
import { useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js';
import toast from 'react-hot-toast';

export default function CheckoutForm({ onSuccess }) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Stripe.js has not yet loaded.
    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    // Confirm the payment with Stripe
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required', // Prevents the page from redirecting away from your modal
    });

    if (error) {
      // Show error to your customer (e.g., insufficient funds, card declined)
      toast.error(`Payment failed: ${error.message}`);
      setIsProcessing(false);
    } else if (paymentIntent && paymentIntent.status === 'succeeded') {
      // The money has officially been captured! 
      // Call the onSuccess prop to tell the Navbar to save the order to PostgreSQL
      toast.success('Payment authorized securely!');
      onSuccess();
    } else {
      toast.error('Unexpected payment status.');
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
        <PaymentElement options={{ wallets: { applePay: 'auto', googlePay: 'auto' } }} />
      </div>
      
      <button 
        type="submit"
        disabled={isProcessing || !stripe || !elements}
        className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-slate-200 disabled:text-slate-400 text-white font-black py-4 rounded-xl shadow-lg transition-all active:scale-[0.98] uppercase tracking-wider"
      >
        {isProcessing ? 'Processing...' : 'Complete Purchase'}
      </button>
      
      <div className="text-center mt-2 text-xs font-bold text-slate-400 flex items-center justify-center gap-1">
        <i className="fa-solid fa-lock"></i> Secure encrypted checkout via Stripe
      </div>
    </form>
  );
}
