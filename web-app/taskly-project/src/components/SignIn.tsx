import React, { useState } from 'react';

interface SignInProps {
  onToggle: () => void;
  onSignup: (name: string, email: string, password: string) => Promise<void>;
  loading: boolean;
  error: string | null;
  setError: (error: string | null) => void;
}

export const SignIn: React.FC<SignInProps> = ({
  onToggle,
  onSignup,
  loading,
  error,
  setError,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [avatarPreview, setAvatarPreview] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName || !email || !password) {
      setError('Please fill in all fields');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    try {
      await onSignup(fullName, email, password);
    } catch (err: any) {
      setError(err.message || 'Signup failed. Please try again.');
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFullName(value);

    if (value.trim()) {
      setAvatarPreview(
        `https://ui-avatars.com/api/?name=${encodeURIComponent(
          value
        )}&background=2563eb&color=fff&size=200&bold=true`
      );
    } else {
      setAvatarPreview('');
    }
  };

  const handleGoogleSignup = () => {
    window.location.href = 'http://localhost:5000/api/auth/google';
  };

  return (
    <div className="w-full max-w-md space-y-8 animate-in fade-in slide-in-from-left-4 duration-500">
      <div className="text-left">
        <div className="lg:hidden flex items-center justify-start gap-3 mb-6">
          <div className="bg-blue-500/10 p-2 rounded-lg">
            <span className="material-icons text-blue-500 text-3xl">
              textsms
            </span>
          </div>
          <span className="text-2xl font-bold text-slate-900 dark:text-white">
            Textly
          </span>
        </div>
        <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          Start your journey
        </h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Create your account to start managing your conversations effortlessly.
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

      <div className="w-full flex justify-center mt-6">
        <button
          type="button"
          onClick={handleGoogleSignup}
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

      <div className="relative mt-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-200 dark:border-slate-700"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="bg-white dark:bg-slate-900 px-2 text-slate-500 dark:text-slate-400">
            Or sign up with email
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 mt-6">
        {avatarPreview && (
          <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-slate-800 rounded-lg border border-blue-100 dark:border-slate-700">
            <img
              src={avatarPreview}
              alt="Avatar Preview"
              className="w-12 h-12 rounded-full border-2 border-blue-500"
            />
            <span className="text-xs text-blue-600 dark:text-blue-400">
              Auto-generated from your name
            </span>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Full Name
          </label>
          <input
            className="w-full mt-1 p-3 border rounded-lg"
            value={fullName}
            onChange={handleNameChange}
            required
            type="text"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Email
          </label>
          <input
            className="w-full mt-1 p-3 border rounded-lg"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            type="email"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Password
          </label>
          <div className="relative">
            <input
              className="w-full mt-1 p-3 border rounded-lg pr-10"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              type={showPassword ? 'text' : 'password'}
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
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-3 rounded-lg"
        >
          {loading ? 'Creating Account...' : 'Create Account'}
        </button>
      </form>

      <p className="text-center text-sm text-slate-600 dark:text-slate-400 mt-6">
        Already have an account?{' '}
        <button
          onClick={onToggle}
          className="font-semibold text-blue-600 hover:text-blue-500"
        >
          Log in
        </button>
      </p>
    </div>
  );
};
