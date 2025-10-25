import React, { useState, useContext, useRef, useEffect } from 'react';
import { assets } from '../assets/assets';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { AppContent } from '../context/AppContext.jsx';

const EmailVerify = ({ purpose = 'account_verification', email }) => {
  axios.defaults.withCredentials = true;
  const navigate = useNavigate();
  const { backendUrl, isLoggedin, userData, getUserData } = useContext(AppContent);

  const [otpDigits, setOtpDigits] = useState(Array(6).fill(''));
  const [timer, setTimer] = useState(30);
  const [isResending, setIsResending] = useState(false);
  const [canResend, setCanResend] = useState(false);
  const inputRefs = useRef([]);

  const otp = otpDigits.join('');

  // TIMER LOGIC
  useEffect(() => {
    if (timer > 0) {
      setCanResend(false);
      const countdown = setTimeout(() => setTimer((prev) => prev - 1), 1000);
      return () => clearTimeout(countdown);
    } else {
      setCanResend(true);
    }
  }, [timer]);

  useEffect(() => {
    setTimer(30);
  }, []);

  // OTP INPUT HANDLERS
  const handleChange = (e, index) => {
    const value = e.target.value;
    if (isNaN(Number(value)) || value.length > 1) return;

    const newOtp = [...otpDigits];
    newOtp[index] = value;
    setOtpDigits(newOtp);

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

  // VERIFY OTP
  const onSubmitHandler = async (e) => {
    e.preventDefault();
    if (otp.length !== 6) {
      toast.error('Please enter a valid 6-digit OTP.');
      return;
    }

    try {
      let endpoint = `${backendUrl}/api/auth/verify-account`;
      let payload = { otp };

      // If password reset, use a different endpoint
      if (purpose === 'password_reset') {
        endpoint = `${backendUrl}/api/auth/verify-reset-otp`;
        payload = { otp, email };
      }

      const { data } = await axios.post(endpoint, payload, { withCredentials: true });

      if (data.success) {
        toast.success(data.message || 'OTP verified successfully!');
        if (purpose === 'account_verification') {
          getUserData();
          navigate('/');
        } else if (purpose === 'password_reset') {
          navigate(`/reset-password?email=${encodeURIComponent(email)}`);
        }
      } else {
        toast.error(data.message || 'Invalid OTP');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    }
  };

  // RESEND OTP
  const handleResendOtp = async () => {
    if (!canResend || isResending) return;
    try {
      setIsResending(true);
      const { data } = await axios.post(
        `${backendUrl}/api/auth/resend-otp`,
        { email: email || userData?.email },
        { withCredentials: true }
      );

      if (data.success) {
        toast.success('New OTP sent successfully!');
        setOtpDigits(Array(6).fill(''));
        setTimer(30);
      } else {
        toast.error(data.message || 'Failed to resend OTP.');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    } finally {
      setIsResending(false);
    }
  };

  // Redirect verified users
  useEffect(() => {
    if (isLoggedin && userData?.isAccountVerified && purpose === 'account_verification') {
      navigate('/');
    }
  }, [isLoggedin, userData, navigate, purpose]);

  return (
    <div className="flex items-center justify-center min-h-screen px-6 sm:px-0 bg-gradient-to-br from-blue-200 to-purple-400">
      <img
        onClick={() => navigate('/')}
        src={assets.logo}
        alt="Logo"
        className="absolute left-5 sm:left-20 top-5 w-28 sm:w-32 cursor-pointer"
      />

      <form
        onSubmit={onSubmitHandler}
        className="bg-slate-900 p-8 rounded-lg shadow-lg w-96 text-sm"
      >
        <h1 className="text-white text-2xl font-semibold text-center mb-4">
          {purpose === 'account_verification'
            ? 'Verify Your Email'
            : 'Verify OTP for Password Reset'}
        </h1>

        <p className="text-center mb-6 text-indigo-300">
          Enter the 6-digit code sent to your email 
          <span className="text-indigo-400 font-medium">{email}</span>
        </p>

        <div className="flex justify-between mb-8" onPaste={handlePaste}>
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
              className="w-12 h-12 bg-[#333A5C] text-white text-center text-xl rounded-md outline-none focus:ring-2 focus:ring-indigo-400"
              inputMode="numeric"
            />
          ))}
        </div>

        <button
          type="submit"
          className="w-full py-3 bg-gradient-to-r from-indigo-500 to-indigo-900 text-white rounded-full hover:opacity-90 transition-all"
        >
          Verify OTP
        </button>

        {/* RESEND SECTION */}
        <div className="mt-6 text-center text-indigo-300">
          {canResend ? (
            <button
              type="button"
              onClick={handleResendOtp}
              disabled={isResending}
              className={`flex items-center justify-center mx-auto gap-2 text-indigo-400 hover:text-indigo-300 font-medium ${
                isResending ? 'opacity-60 cursor-not-allowed' : ''
              }`}
            >
              {isResending ? (
                <>
                  <span className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></span>
                  <span>Sending...</span>
                </>
              ) : (
                'Resend OTP'
              )}
            </button>
          ) : (
            <span>
              Resend OTP in <span className="font-semibold">{timer}s</span>
            </span>
          )}
        </div>
      </form>
    </div>
  );
};

export default EmailVerify;
