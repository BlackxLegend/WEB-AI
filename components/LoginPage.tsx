
import React, { useState, useEffect } from 'react';
import { User, Lock, ArrowRight, Sparkles, UserPlus, LogIn, Key } from 'lucide-react';
import { authenticateUser, registerUser, saveApiKey, getApiKey } from '../services/storage';

interface LoginPageProps {
  onLogin: (username: string) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [customKey, setCustomKey] = useState('');
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    // Load existing key if any
    const k = getApiKey();
    if (k) {
        setCustomKey(k);
        setShowKeyInput(true);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!username.trim() || !password.trim()) {
        setError("Please enter both username and password");
        return;
    }

    // Save API key if provided, otherwise clear it if input is empty
    if (showKeyInput) {
        saveApiKey(customKey.trim());
    }

    if (isRegistering) {
        const result = registerUser(username.trim(), password.trim());
        if (result.success) {
            setSuccessMsg("Account created! Logging you in...");
            setTimeout(() => {
                onLogin(username.trim());
            }, 1000);
        } else {
            setError(result.message);
        }
    } else {
        const isValid = authenticateUser(username.trim(), password.trim());
        if (isValid) {
            onLogin(username.trim());
        } else {
            setError("Invalid username or password");
        }
    }
  };

  return (
    <div className="min-h-screen w-full bg-gray-950 flex flex-col items-center justify-center relative overflow-hidden font-sans">
      {/* Background Ambience */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[50%] -left-[50%] w-[200%] h-[200%] bg-[radial-gradient(circle,rgba(59,130,246,0.15)_0%,rgba(0,0,0,0)_60%)] animate-pulse-slow"></div>
        <div className="absolute top-[20%] right-[20%] w-64 h-64 bg-purple-600/20 rounded-full blur-[100px]"></div>
      </div>

      <div className="z-10 w-full max-w-md p-6">
        <div className="bg-gray-900/60 backdrop-blur-xl border border-gray-800 rounded-3xl p-8 shadow-2xl relative">
          
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-tr from-blue-600 to-purple-600 rounded-2xl shadow-lg flex items-center justify-center transform rotate-3">
                <Sparkles className="text-white" size={32} />
            </div>
          </div>
          
          <h1 className="text-3xl font-bold text-center text-white mb-2">
              {isRegistering ? "Create Account" : "Welcome Back"}
          </h1>
          <p className="text-gray-400 text-center mb-8">
              {isRegistering ? "Join OmniAI Studio today" : "Sign in to access your workspace"}
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-500 uppercase ml-1">Username</label>
              <div className="relative group">
                <User className="absolute left-4 top-3.5 text-gray-500 group-focus-within:text-blue-500 transition-colors" size={20} />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-gray-950/50 border border-gray-700 text-white rounded-xl pl-12 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder-gray-600"
                  placeholder="Enter username"
                  autoFocus
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-500 uppercase ml-1">Password</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-3.5 text-gray-500 group-focus-within:text-purple-500 transition-colors" size={20} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-gray-950/50 border border-gray-700 text-white rounded-xl pl-12 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all placeholder-gray-600"
                  placeholder="Enter password"
                />
              </div>
            </div>

             {/* API Key Toggle */}
             <div className="pt-2">
                 <button 
                    type="button"
                    onClick={() => setShowKeyInput(!showKeyInput)}
                    className="text-xs text-gray-500 hover:text-blue-400 flex items-center gap-1 mb-2 ml-1"
                 >
                    <Key size={12} /> {showKeyInput ? "Hide API Key Settings" : "Use Custom API Key (Optional)"}
                 </button>
                 
                 {showKeyInput && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                        <div className="relative group">
                            <Key className="absolute left-4 top-3.5 text-yellow-500/50 group-focus-within:text-yellow-500 transition-colors" size={20} />
                            <input
                            type="password"
                            value={customKey}
                            onChange={(e) => setCustomKey(e.target.value)}
                            className="w-full bg-gray-950/50 border border-gray-700 text-white rounded-xl pl-12 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all placeholder-gray-600"
                            placeholder="Paste your Gemini API Key here"
                            />
                        </div>
                        <p className="text-[10px] text-gray-600 ml-1">
                            Use this if you encounter 403 Permission errors or want to use your own quota.
                        </p>
                    </div>
                 )}
             </div>

            {error && (
                <div className="p-3 rounded-lg bg-red-900/20 border border-red-800 text-red-300 text-sm text-center animate-pulse">
                    {error}
                </div>
            )}

            {successMsg && (
                <div className="p-3 rounded-lg bg-green-900/20 border border-green-800 text-green-300 text-sm text-center">
                    {successMsg}
                </div>
            )}

            <button
              type="submit"
              disabled={!username.trim() || !password.trim()}
              className={`w-full font-bold py-3.5 rounded-xl transition-all flex items-center justify-center space-x-2 shadow-lg group
                  ${isRegistering 
                      ? 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 shadow-purple-900/20' 
                      : 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/20'
                  } disabled:opacity-50 disabled:cursor-not-allowed text-white`}
            >
              <span>{isRegistering ? 'Sign Up' : 'Login'}</span>
              <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-800 text-center">
             <button 
                onClick={() => { setIsRegistering(!isRegistering); setError(null); setSuccessMsg(null); }}
                className="text-sm text-gray-400 hover:text-white transition-colors flex items-center justify-center gap-2 mx-auto"
             >
                {isRegistering ? (
                    <>
                        <LogIn size={16} /> <span>Already have an account? Login</span>
                    </>
                ) : (
                    <>
                        <UserPlus size={16} /> <span>Need an account? Sign Up</span>
                    </>
                )}
             </button>
          </div>
        </div>
        
        <div className="mt-6 text-center">
            <p className="text-xs text-gray-600">
                Data is encrypted and stored locally in your browser.<br/>
                We do not collect any personal information.
            </p>
        </div>
      </div>
    </div>
  );
};
