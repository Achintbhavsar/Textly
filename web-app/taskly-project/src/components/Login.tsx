import React, { useState } from 'react';

interface LoginFormProps {
  onToggle: () => void;
  onLogin: (email: string, password: string, rememberMe: boolean) => Promise<void>;
  loading: boolean;
  error: string | null;
  setError: (error: string | null) => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({
  onToggle,
  onLogin,
  loading,
  error,
  setError,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    try {
      await onLogin(email, password, rememberMe);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please try again.');
    }
  };

  return (
    <div className="w-full max-w-md space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="text-center lg:text-left">
        <div className="lg:hidden flex items-center justify-center gap-3 mb-6">
          <div className="bg-blue-500/10 p-2 rounded-lg">
            <span className="material-icons text-blue-500 text-3xl">textsms</span>
          </div>
          <span className="text-2xl font-bold text-slate-900 dark:text-white">Textly</span>
        </div>
        <h1 className="text-3xl lg:text-4xl font-bold text-slate-900 dark:text-white mb-2">
          Welcome back
        </h1>
        <p className="text-slate-500 dark:text-slate-400">
          Please enter your details to sign in.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center">
            <span className="material-icons text-red-500 mr-2">error</span>
            <span className="text-red-700 dark:text-red-300 text-sm">
              {error}
            </span>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 mt-8">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Email Address
          </label>
          <input
            className="block w-full py-3 px-4 border rounded-lg"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Password
          </label>
          <div className="relative">
            <input
              className="block w-full py-3 px-4 border rounded-lg pr-10"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-3 text-slate-400"
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        <button
          className="w-full py-3 bg-blue-600 text-white rounded-lg"
          type="submit"
          disabled={loading}
        >
          {loading ? 'Signing in...' : 'Log in'}
        </button>
      </form>

      <div className="relative my-8">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-200 dark:border-slate-700"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-4 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400">
            Or continue with
          </span>
        </div>
      </div>

      {/* 🔥 ONLY THIS PART CHANGED */}
      <div className="w-full flex justify-center">
  <button
    onClick={() => {
      window.location.href = "http://localhost:5000/api/auth/google";
    }}
    className="flex items-center gap-3 px-6 py-3 border rounded-lg shadow-sm hover:bg-gray-50"
  >
    <img
      src="https://www.svgrepo.com/show/475656/google-color.svg"
      alt="Google"
      className="w-5 h-5"
    />
    Continue with Google
  </button>
</div>
    

      <p className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">
        Don't have an account?{' '}
        <button
          onClick={onToggle}
          className="font-semibold text-blue-600 hover:text-blue-500"
        >
          Sign up for free
        </button>
      </p>
    </div>
  );
};
