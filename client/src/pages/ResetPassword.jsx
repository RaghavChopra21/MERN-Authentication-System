import React, { useState, useRef, useContext, useEffect } from 'react';
import { assets } from '../assets/assets';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { AppContent } from '../context/AppContext';
import axios from 'axios';

const ResetPassword = () => {
  const { backendUrl } = useContext(AppContent);
  axios.defaults.withCredentials = true;
  const navigate = useNavigate();

  // ---------------- STATES ----------------
  const [email, setEmail] = useState('');
  const [otpDigits, setOtpDigits] = useState(Array(6).fill(''));
  const [newPassword, setNewPassword] = useState('');
  const [showOtpForm, setShowOtpForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [timer, setTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);

  const inputRefs = useRef([]);
  const otp = otpDigits.join('');

  // ---------------- TIMER for Resend OTP ----------------
  useEffect(() => {
    if (!showOtpForm) return;

    if (timer > 0) {
      setCanResend(false);
      const countdown = setTimeout(() => setTimer((prev) => prev - 1), 1000);
      return () => clearTimeout(countdown);
    } else {
      setCanResend(true);
    }
  }, [timer, showOtpForm]);

  // ---------------- SEND OTP ----------------
  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    if (!email) return toast.warn('Please enter your email.');

    try {
      setLoading(true);
      const { data } = await axios.post(`${backendUrl}/api/auth/send-reset-otp`, { email });
      if (data.success) {
        toast.success('OTP sent successfully!');
        setShowOtpForm(true);
        setTimer(30);
        setOtpDigits(Array(6).fill(''));
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error sending OTP.');
    } finally {
      setLoading(false);
    }
  };

  // ---------------- RESEND OTP ----------------
  const handleResendOtp = async () => {
    if (!canResend) return;
    try {
      setResendLoading(true);
      const { data } = await axios.post(`${backendUrl}/api/auth/resend-reset-otp`, { email });
      if (data.success) {
        toast.info('OTP resent successfully!');
        setOtpDigits(Array(6).fill(''));
        setTimer(30);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to resend OTP.');
    } finally {
      setResendLoading(false);
    }
  };

  // ---------------- OTP INPUT HANDLERS ----------------
  const handleChange = (e, index) => {
    const { value } = e.target;
    if (isNaN(Number(value)) || value.length > 1) return;

    const newOtpDigits = [...otpDigits];
    newOtpDigits[index] = value;
    setOtpDigits(newOtpDigits);

    if (value && index < inputRefs.current.length - 1) {
      inputRefs.current[index + 1].focus();
    }
  };

  const handleKeyDown = (e, index) => {
    if (e.key === 'Backspace' && otpDigits[index] === '' && index > 0) {
      inputRefs.current[index - 1].focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const paste = e.clipboardData.getData('text').trim();
    if (paste.length === 6 && !isNaN(Number(paste))) {
      setOtpDigits(paste.split(''));
      inputRefs.current[5]?.focus();
    } else {
      toast.warn('Please paste a valid 6-digit OTP.');
    }
  };

  // ---------------- RESET PASSWORD ----------------
  const handlePasswordReset = async (e) => {
    e.preventDefault();
    if (otp.length !== 6) return toast.error('Please enter the complete 6-digit OTP.');
    if (!newPassword) return toast.warn('Please enter your new password.');

    try {
      setLoading(true);
      const { data } = await axios.post(`${backendUrl}/api/auth/reset-password`, {
        email,
        otp,
        newPassword,
      });

      if (data.success) {
        toast.success(data.message);
        navigate('/login');
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error resetting password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen px-6 sm:px-0 bg-gradient-to-br from-blue-200 to-purple-400 relative">
      <img
        onClick={() => navigate('/')}
        src={assets.logo}
        alt="Logo"
        className="absolute left-5 sm:left-20 top-5 w-28 sm:w-32 cursor-pointer"
      />

      {/* ---------------- STEP 1: EMAIL ---------------- */}
      {!showOtpForm && (
        <form onSubmit={handleEmailSubmit} className="bg-slate-900 p-8 rounded-lg shadow-lg w-96 text-sm">
          <h1 className="text-white text-2xl font-semibold text-center mb-4">Reset Password</h1>
          <p className="text-center mb-6 text-indigo-300">Enter your registered email address.</p>

          <div className="mb-4 flex items-center gap-3 w-full px-5 py-2.5 rounded-full bg-[#333A5C]">
            <img src={assets.mail_icon} alt="" className="w-3 h-3" />
            <input
              type="email"
              placeholder="Email id"
              className="bg-transparent outline-none text-white w-full"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className={`w-full py-2.5 bg-gradient-to-r from-indigo-500 to-indigo-900 text-white rounded-full mt-3 flex justify-center items-center ${
              loading ? 'opacity-80' : ''
            }`}
          >
            {loading ? (
              <span className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></span>
            ) : (
              'Send OTP'
            )}
          </button>
        </form>
      )}

      {/* ---------------- STEP 2: OTP + NEW PASSWORD ---------------- */}
      {showOtpForm && (
        <form onSubmit={handlePasswordReset} className="bg-slate-900 p-8 rounded-lg shadow-lg w-96 text-sm">
          <h1 className="text-white text-2xl font-semibold text-center mb-4">Enter OTP & New Password</h1>
          <p className="text-center mb-6 text-indigo-300">
            Enter the 6-digit code sent to <span className="text-indigo-400 font-medium">{email}</span>
          </p>

          <div className="flex justify-between mb-4" onPaste={handlePaste}>
            {otpDigits.map((digit, index) => (
              <input
                key={index}
                type="text"
                value={digit}
                onChange={(e) => handleChange(e, index)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                ref={(el) => (inputRefs.current[index] = el)}
                maxLength="1"
                required
                className="w-12 h-12 bg-[#333A5C] text-white text-center text-xl rounded-md outline-none"
                inputMode="numeric"
              />
            ))}
          </div>

          <div className="mb-4 flex items-center gap-3 w-full px-5 py-2.5 rounded-full bg-[#333A5C]">
            <img src={assets.lock_icon} alt="" className="w-3 h-3" />
            <input
              type="password"
              placeholder="New Password"
              className="bg-transparent outline-none text-white w-full"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className={`w-full py-2.5 bg-gradient-to-r from-indigo-500 to-indigo-900 text-white rounded-full flex justify-center items-center ${
              loading ? 'opacity-80' : ''
            }`}
          >
            {loading ? (
              <span className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></span>
            ) : (
              'Reset Password'
            )}
          </button>

          <button
            type="button"
            onClick={handleResendOtp}
            disabled={!canResend || resendLoading}
            className={`w-full mt-4 text-indigo-300 hover:text-indigo-400 text-sm flex justify-center items-center ${
              !canResend || resendLoading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {resendLoading && (
              <span className="animate-spin w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full mr-2"></span>
            )}
            {canResend ? 'Resend OTP' : `Resend OTP in ${timer}s`}
          </button>
        </form>
      )}
    </div>
  );
};

export default ResetPassword;
