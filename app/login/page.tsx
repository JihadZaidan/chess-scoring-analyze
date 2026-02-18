'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChessComAPI } from '@/lib/chesscom-api';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const chessComAPI = new ChessComAPI();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // Test Chess.com API connection with username
      const profile = await chessComAPI.getPlayerProfile(username);
      
      if (profile) {
        // Store user info in localStorage (in production, use secure storage)
        localStorage.setItem('chessUser', JSON.stringify({
          username: profile.username,
          name: profile.name,
          avatar: profile.avatar,
          platform: 'chess.com'
        }));
        
        // Redirect to main app
        router.push('/');
      }
    } catch (error) {
      setError('Failed to connect to Chess.com. Please check your username.');
      console.error('Login error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLichessLogin = () => {
    // For Lichess, we'll use OAuth in the future
    // For now, redirect to main app with Lichess flag
    localStorage.setItem('chessUser', JSON.stringify({
      username: '',
      platform: 'lichess'
    }));
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-2">Chess Analysis</h1>
          <p className="text-gray-400">Connect your chess account to analyze your games</p>
        </div>

        {/* Login Form */}
        <div className="bg-gray-900 rounded-lg border border-gray-800 p-8">
          <h2 className="text-2xl font-semibold text-white mb-6">Chess.com Login</h2>
          
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-2">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Enter your Chess.com username"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                Password (Optional)
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Enter your password (if needed)"
              />
            </div>

            {error && (
              <div className="bg-red-900 border border-red-800 text-red-300 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !username.trim()}
              className="w-full py-3 px-4 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Connecting...' : 'Connect to Chess.com'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-400 mb-4">Or connect with:</p>
            <button
              onClick={handleLichessLogin}
              className="w-full py-3 px-4 bg-gray-800 text-white rounded-lg font-medium hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-900 transition-colors border border-gray-700"
            >
              Continue with Lichess
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-gray-500">
          <p>By connecting, you agree to analyze your games with AI</p>
          <p className="mt-2">Don't have an account? <a href="https://www.chess.com/signup" target="_blank" rel="noopener noreferrer" className="text-green-400 hover:text-green-300">Sign up for Chess.com</a></p>
        </div>
      </div>
    </div>
  );
}
