import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export default function ActivateAccountPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading'); // 'loading' | 'success' | 'error'
  const [message, setMessage] = useState('');

  useEffect(() => {
    const activate = async () => {
      try {
        const res = await axios.post(`${API_URL}/api/activate-account`, { token });
        setStatus('success');
        setMessage(res.data.message || 'Account activated successfully!');
        setTimeout(() => navigate('/login'), 3000);
      } catch (err) {
        setStatus('error');
        setMessage(err.response?.data?.message || 'Invalid or expired activation link.');
      }
    };
    if (token) activate();
  }, [token, navigate]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'Arial, sans-serif' }}>
      {status === 'loading' && <p>Activating your account, please wait...</p>}
      {status === 'success' && (
        <>
          <h2 style={{ color: '#005466' }}>✅ {message}</h2>
          <p>Redirecting you to login...</p>
        </>
      )}
      {status === 'error' && (
        <>
          <h2 style={{ color: 'red' }}>❌ Activation Failed</h2>
          <p>{message}</p>
          <a href="/login">Go to Login</a>
        </>
      )}
    </div>
  );
}