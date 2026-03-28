import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import styles from '../../styles/auth/LoginPage.module.css';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const user = await login(email, password);
      // Route based on role (matching Previous Repo RBAC flow)
      navigate(`/${user.role}/dashboard`);
    } catch (err) {
      setError('Invalid email or password. Please try again.');
    }
  };

  return (
    <div className={styles['login-container']}>
      <div className={styles['login__card']}>
        <h2 className={styles['login__title']}>Welcome Back</h2>
        <p className={styles['login__subtitle']}>Log in to manage your clinic</p>
        
        {error && <div className={styles['login__error']}>{error}</div>}
        
        <form onSubmit={handleLogin} className={styles['login__form']}>
          <div className={styles['form__group']}>
            <label htmlFor="email" className={styles['form__label']}>Email Address</label>
            <input 
              type="email" 
              id="email"
              className={styles['form__input']} 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required 
              placeholder="Enter your email"
            />
          </div>
          
          <div className={styles['form__group']}>
            <label htmlFor="password" className={styles['form__label']}>Password</label>
            <input 
              type="password" 
              id="password"
              className={styles['form__input']} 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required 
              placeholder="Enter your password"
            />
          </div>
          
          <button type="submit" className={styles['login__btn']}>
            Log In
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;