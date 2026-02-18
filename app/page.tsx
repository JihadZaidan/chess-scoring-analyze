'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ChessBoardComponent from '@/components/ChessBoard';
import { GeminiChessAI } from '@/lib/gemini-chess-ai';
import { LichessAPI } from '@/lib/lichess-api';
import { ChessComAPI, ChessComGame } from '@/lib/chesscom-api';
import { AIMoveSuggestion } from '@/lib/gemini-chess-ai';
import { Chess } from 'chess.js';

interface ChessUser {
  username: string;
  name?: string;
  avatar?: string;
  platform: 'chess.com' | 'lichess';
}
export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<ChessUser | null>(null);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hello! I am your chess analysis assistant. You can:\n• Import games from Lichess\n• Import games from Chess.com\n• Analyze positions with AI\n• Get move suggestions\nHow can I help you today?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentFen, setCurrentFen] = useState('rnbqkbnr/pppppppp/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  const [analysis, setAnalysis] = useState<AIMoveSuggestion | undefined>(undefined);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [gamePGN, setGamePGN] = useState<string>('');

  const ai = new GeminiChessAI();
  const lichessAPI = new LichessAPI();
  const chessComAPI = new ChessComAPI();

  useEffect(() => {
    const storedUser = localStorage.getItem('chessUser');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    } else {
      router.push('/login');
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('chessUser');
    setUser(null);
    router.push('/login');
  };

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      let response = '';

      // Check for FEN string
      const fenMatch = input.match(/^([rnbqkpRNBQKP1-8\/\s]+)$/);
      if (fenMatch) {
        const fen = fenMatch[1].trim();
        try {
          const testGame = new Chess(fen);
          setCurrentFen(fen);
          response = `Position loaded from FEN:\n${fen}\n\nYou can now make moves or request analysis.`;
        } catch (error) {
          response = 'Invalid FEN string. Please check the format and try again.';
        }
      } else {
        // Check for Chess.com game link (improved regex)
        const chessComMatch = input.match(/chess\.com\/(?:game\/)?(live|daily)\/(\d+)/i) || 
                              input.match(/chess\.com\/game\/(\d+)/i) ||
                              input.match(/chess\.com\/[a-z]+\/game\/(\d+)/i);
        
        if (chessComMatch) {
          const gameType = chessComMatch[1] || 'live';
          const gameId = chessComMatch[2] || chessComMatch[1];
          
          console.log('Chess.com link detected:', { gameType, gameId, originalMatch: chessComMatch });
          
          try {
            const game = await chessComAPI.getGame(gameId);
            if (game && game.pgn) {
              const pgn = game.pgn;
              const tempGame = new Chess();
              
              try {
                tempGame.loadPgn(pgn);
                const fen = tempGame.fen();
                
                // Validate the FEN before setting it
                const testGame = new Chess();
                try {
                  testGame.load(fen);
                  setCurrentFen(fen);
                  setGamePGN(pgn);
                  response = `Chess.com ${gameType} game loaded:\n• Game ID: ${gameId}\n• White: ${game.white?.username || 'Unknown'}\n• Black: ${game.black?.username || 'Unknown'}\n• Time Control: ${game.time_class || 'Unknown'}\n• Rated: ${game.rated ? 'Yes' : 'No'}\n• Current position loaded on board\n\nYou can now analyze or continue from this position.`;
                } catch (fenError) {
                  console.warn('Invalid FEN from PGN, using default position:', fenError);
                  setCurrentFen('rnbqkbnr/pppppppp/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
                  setGamePGN(pgn);
                  response = `Chess.com ${gameType} game loaded (with default starting position):\n• Game ID: ${gameId}\n• White: ${game.white?.username || 'Unknown'}\n• Black: ${game.black?.username || 'Unknown'}\n• Time Control: ${game.time_class || 'Unknown'}\n• Rated: ${game.rated ? 'Yes' : 'No'}\n• PGN loaded but position reset to start\n\nYou can now analyze or continue from this position.`;
                }
              } catch (pgnError) {
                console.warn('Failed to load PGN:', pgnError);
                setCurrentFen('rnbqkbnr/pppppppp/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
                setGamePGN(pgn);
                response = `Chess.com ${gameType} game loaded (PGN parsing failed):\n• Game ID: ${gameId}\n• White: ${game.white?.username || 'Unknown'}\n• Black: ${game.black?.username || 'Unknown'}\n• Time Control: ${game.time_class || 'Unknown'}\n• Rated: ${game.rated ? 'Yes' : 'No'}\n• PGN available but position reset to start\n\nYou can now analyze or continue from this position.`;
              }
            } else {
              response = 'Could not load the Chess.com game. The game might be ongoing, private, or the link is invalid.';
            }
          } catch (error) {
            console.error('Chess.com API Error:', error);
            if (error instanceof Error) {
              if (error.message.includes('not found') || error.message.includes('private')) {
                response = 'Game not found or is private. Live games may not be accessible until completed.';
              } else if (error.message.includes('rate limit')) {
                response = 'Rate limit exceeded. Please try again in a few moments.';
              } else if (error.message.includes('timeout')) {
                response = 'Request timeout. Please check your connection and try again.';
              } else {
                response = `Error loading Chess.com game: ${error.message}`;
              }
            } else {
              response = 'Error loading Chess.com game. The game might be private, ongoing, or the link is invalid.';
            }
          }
        } else if (input.toLowerCase().includes('chess.com') && input.toLowerCase().includes('import')) {
          const username = input.match(/chess\.com\s+(?:import|games?)\s+(?:from\s+)?(\w+)/i)?.[1];
          if (username) {
            const games = await chessComAPI.getPlayerGames(username, { perPage: 10 });
            response = `Found ${games.length} recent games for ${username} on Chess.com. Which game would you like to analyze?\n${games.map((g, i) => `${i + 1}. vs ${g.white.username === username ? g.black.username : g.white.username} - ${g.time_class} - ${g.white.result === g.black.result ? 'Draw' : g.white.username === username ? (g.white.result === 'win' ? 'Won' : 'Lost') : (g.black.result === 'win' ? 'Won' : 'Lost')}`).join('\n')}`;
          } else {
            response = 'Please provide a Chess.com username. Example: "Import games from chess.com magnuscarlsen"';
          }
        } else if (input.toLowerCase().includes('lichess') && input.toLowerCase().includes('import')) {
          const username = input.match(/lichess\s+(?:import|games?)\s+(?:from\s+)?(\w+)/i)?.[1];
          if (username) {
            const games = await lichessAPI.getUserGames(username, { max: 5 });
            response = `Found ${games.length} recent games for ${username} on Lichess. Which game would you like to analyze?\n${games.map((g, i) => `${i + 1}. vs ${g.players.black.user.name} - ${g.speed}`).join('\n')}`;
          } else {
            response = 'Please provide a Lichess username. Example: "Import games from lichess magnuscarlsen"';
          }
        } else if (input.toLowerCase().includes('my games') && user) {
          // Handle my games request
          if (user.platform === 'chess.com') {
            const games = await chessComAPI.getPlayerGames(user.username, { perPage: 10 });
            response = `Found ${games.length} of your recent games on Chess.com:\n${games.map((g, i) => `${i + 1}. vs ${g.white.username === user.username ? g.black.username : g.white.username} - ${g.time_class} - ${g.white.result === g.black.result ? 'Draw' : g.white.username === user.username ? (g.white.result === 'win' ? 'Won' : 'Lost') : (g.black.result === 'win' ? 'Won' : 'Lost')}`).join('\n')}`;
          } else {
            response = 'Lichess game import requires OAuth authentication. Please use "Import games from lichess username" instead.';
          }
        } else if (input.includes('chess.com') && input.includes('/')) {
          // Fallback for any chess.com link that wasn't caught
          const gameId = input.match(/\/(\d+)/)?.[1];
          if (gameId) {
            try {
              const game = await chessComAPI.getGame(gameId);
              if (game && game.pgn) {
                const pgn = game.pgn;
                const tempGame = new Chess();
                tempGame.loadPgn(pgn);
                setCurrentFen(tempGame.fen());
                setGamePGN(pgn);
                response = `Chess.com game loaded:\n• Game ID: ${gameId}\n• White: ${game.white?.username || 'Unknown'}\n• Black: ${game.black?.username || 'Unknown'}\n• Time Control: ${game.time_class || 'Unknown'}\n• Rated: ${game.rated ? 'Yes' : 'No'}\n• Current position loaded on board\n\nYou can now analyze or continue from this position.`;
              } else {
                response = 'Could not load the Chess.com game. The game might be ongoing, private, or the link is invalid.';
              }
            } catch (error) {
              console.error('Chess.com API Error (fallback):', error);
              response = 'Unable to load Chess.com game. The game might be ongoing, private, or the link format is not supported.';
            }
          } else {
            response = 'Could not extract game ID from the Chess.com link. Please check the link format.';
          }
        } else if (input.toLowerCase().includes('analyze') || input.toLowerCase().includes('analysis')) {
          setIsAnalyzing(true);
          try {
            const aiAnalysis = await ai.analyzePosition(currentFen);
            setAnalysis(aiAnalysis);
            response = `Position Analysis Complete!\n\nBest Move: ${aiAnalysis.move}\nEvaluation: ${aiAnalysis.evaluation > 0 ? '+' : ''}${aiAnalysis.evaluation}\nConfidence: ${Math.round(aiAnalysis.confidence * 100)}%\n\n${aiAnalysis.reasoning}`;
          } catch (error) {
            response = 'Analysis failed. Please try again.';
          }
          setIsAnalyzing(false);
        } else {
          const aiAnalysis = await ai.analyzePosition(currentFen);
          setAnalysis(aiAnalysis);
          response = aiAnalysis.reasoning;
        }
      }

      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }]);
    }

    setIsLoading(false);
  };

  const handleChessMove = (move: string, fen: string) => {
    setCurrentFen(fen);
    setAnalysis(undefined);
  };

  const handleClearBoard = () => {
    setCurrentFen('rnbqkbnr/pppppppp/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    setAnalysis(undefined);
    setGamePGN('');
    setMessages([
      { role: 'assistant', content: 'Hello! I am your chess analysis assistant. You can:\n• Import games from Lichess\n• Import games from Chess.com\n• Analyze positions with AI\n• Get move suggestions\nHow can I help you today?' }
    ]);
  };

  const handleAnalysisReset = () => {
    setAnalysis(undefined);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-800 text-white">
      <header className="flex items-center justify-between p-4 bg-gray-900 shadow-md">
        <div className="flex items-center space-x-4">
          {user ? (
            <>
              <span className="text-sm">Logged in as {user.username} ({user.platform})</span>
              <button
                onClick={handleLogout}
                className="px-3 py-1 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors"
              >
                Logout
              </button>
              <button
                onClick={handleClearBoard}
                className="px-4 py-2 bg-red-600 rounded-md hover:bg-red-700 transition-colors"
              >
                Clear Board
              </button>
            </>
          ) : (
            <button
              onClick={() => router.push('/login')}
              className="px-4 py-2 bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
            >
              Login
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-1/2 p-4 border-r border-gray-800 bg-gray-900 overflow-y-auto">
          <h2 className="text-xl font-bold mb-4 text-white">Chess Board</h2>
          <ChessBoardComponent
            onMove={handleChessMove}
            onAnalysisRequest={async (fen: string) => {
              setIsAnalyzing(true);
              try {
                const aiAnalysis = await ai.analyzePosition(fen);
                setAnalysis(aiAnalysis);
                const response = `Position Analysis:\n\nBest Move: ${aiAnalysis.move}\nEvaluation: ${aiAnalysis.evaluation > 0 ? '+' : ''}${aiAnalysis.evaluation}\nConfidence: ${Math.round(aiAnalysis.confidence * 100)}%\n\n${aiAnalysis.reasoning}`;
                setMessages(prev => [...prev, { role: 'assistant', content: response }]);
              } catch (error) {
                setMessages(prev => [...prev, { role: 'assistant', content: 'Analysis failed. Please try again.' }]);
              }
              setIsAnalyzing(false);
            }}
            onAnalysisReset={handleAnalysisReset}
            initialFen={currentFen}
            analysis={analysis}
            isAnalyzing={isAnalyzing}
            gamePGN={gamePGN}
          />
        </div>

        <div className="w-1/2 flex flex-col h-full">
          <div className="bg-gray-900 border-b border-gray-800 p-4 flex-shrink-0">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-xl font-semibold text-white">Chess Analysis Assistant</h1>
                <p className="text-sm text-gray-400">AI-powered chess analysis</p>
                {user && (
                  <div className="flex items-center mt-2 space-x-2">
                    <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center">
                      {user.avatar ? (
                        <img src={user.avatar} alt={user.username} className="w-8 h-8 rounded-full" />
                      ) : (
                        <span className="text-xs text-white font-bold">
                          {user.username.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="text-sm text-white font-medium">
                        {user.name || user.username}
                      </p>
                      <p className="text-xs text-gray-400">
                        {user.platform === 'chess.com' ? 'Chess.com' : 'Lichess'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs px-4 py-2 rounded-lg ${msg.role === 'user' ? 'bg-blue-600' : 'bg-gray-600'}`}
                >
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="max-w-xs px-4 py-2 rounded-lg bg-gray-600">
                  <div className="dot-pulse"></div>
                </div>
              </div>
            )}
          </div>

          <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="p-4 border-t border-gray-600 flex-shrink-0">
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Ask me about chess, import games, or request analysis..."
                className="flex-1 p-2 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-gray-800 text-white placeholder-gray-400"
                disabled={isLoading}
              />
              <button
                onClick={handleSendMessage}
                disabled={isLoading || !input.trim()}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Send
              </button>
            </div>
          </form>
          <div className="p-2 text-xs text-gray-500 flex-shrink-0">
            Try: "Import games from chess.com username", "Import games from lichess username", "My games", "Analyze position", "FEN string", "Chess.com game link", or make a move on the board
          </div>
        </div>
      </div>
    </div>
  );
}
