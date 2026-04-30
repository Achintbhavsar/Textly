import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { LoginForm } from './components/Login';
import { SignIn } from './components/SignIn';
import { DecorativeSide } from './components/DecorativeSide';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext'; // ← ADD
import OAuthSuccess from './pages/OAuthSuccess';
import ChatDashboard from './components/ChatDashboard/ChatDashboard';

type AuthMode = 'login' | 'signup';

const AuthPage: React.FC = () => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const { user, login, signup, loading, error, setError } = useAuth();

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const toggleMode = () => setMode(prev => prev === 'login' ? 'signup' : 'login');
  const toggleDarkMode = () => setIsDarkMode(prev => !prev);

  const handleLogin = async (email: string, password: string, _rememberMe: boolean) => {
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please try again.');
    }
  };

  const handleSignup = async (name: string, email: string, password: string) => {
    try {
      await signup(name, email, password);
    } catch (err: any) {
      setError(err.message || 'Signup failed. Please try again.');
    }
  };

  if (user) return <Navigate to="/dashboard" />;

  return (
    <div className="w-full h-screen flex flex-col lg:flex-row overflow-hidden bg-white dark:bg-slate-900">
      <button
        onClick={toggleDarkMode}
        className="fixed top-6 right-6 z-50 p-2 rounded-full bg-slate-100 dark:bg-slate-800"
      >
        {isDarkMode ? '🌞' : '🌙'}
      </button>
      <DecorativeSide mode={mode} />
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center px-6 py-12">
        {mode === 'login' ? (
          <LoginForm
            onToggle={toggleMode}
            onLogin={handleLogin}
            loading={loading}
            error={error}
            setError={setError}
          />
        ) : (
          <SignIn
            onToggle={toggleMode}
            onSignup={handleSignup}
            loading={loading}
            error={error}
            setError={setError}
          />
        )}
      </div>
    </div>
  );
};

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/" />;
  return <ChatDashboard />;
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <SocketProvider>  {/* ← ADD */}
        <Router>
          <Routes>
            <Route path="/" element={<AuthPage />} />
            <Route path="/oauth-success" element={<OAuthSuccess />} />
            <Route path="/dashboard" element={<Dashboard />} />
          </Routes>
        </Router>
      </SocketProvider>  {/* ← ADD */}
    </AuthProvider>
  );
};

export default App;