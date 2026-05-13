import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { BASE_URL } from '../../utils/api';

export default function ActivateAccountPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');
  const [isPatient, setIsPatient] = useState(false);

  useEffect(() => {
    const activate = async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/activate-account`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        if (!res.ok) throw new Error((await res.json()).message);

        const data = await res.json();
        const role = data.role;

        if (role === 'patient') {
          setIsPatient(true);
          setMessage('Your account has been activated! You can now log in on the website or the NgitiFy mobile app.');
          setTimeout(() => navigate('/login'), 3000);
        } else {
          setMessage(data.message || 'Account activated successfully!');
          setTimeout(() => navigate('/login'), 3000);
        }

        setStatus('success');
      } catch (err) {
        setStatus('error');
        setMessage(err.message || 'Invalid or expired activation link.');
      }
    };
    if (token) activate();
  }, [token, navigate]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'Arial, sans-serif', textAlign: 'center', padding: '0 20px' }}>
      {status === 'loading' && <p>Activating your account, please wait...</p>}

      {status === 'success' && (
        <>
          <h2 style={{ color: '#005466' }}>✅ Account Activated!</h2>
          <p>{message}</p>
          {isPatient ? (
            <p style={{ color: '#888', fontSize: '14px', marginTop: '10px' }}>
              Redirecting you to the login page so you can continue on web if you want to.
            </p>
          ) : (
            <p style={{ color: '#888', fontSize: '14px' }}>Redirecting you to the login page...</p>
          )}
        </>
      )}

      {status === 'error' && (
        <>
          <h2 style={{ color: 'red' }}>❌ Activation Failed</h2>
          <p>{message}</p>
          <a href="/login" style={{ color: '#005466', marginTop: '10px' }}>Go to Login</a>
        </>
      )}
    </div>
  );
}
