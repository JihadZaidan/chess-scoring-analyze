'use client';

import { useState, useCallback, useEffect } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { AIMoveSuggestion } from '@/lib/gemini-chess-ai';

interface ChessBoardComponentProps {
  onMove?: (move: string, fen: string) => void;
  onAnalysisRequest?: (fen: string) => void;
  onAnalysisReset?: () => void;
  initialFen?: string;
  analysis?: AIMoveSuggestion;
  isAnalyzing?: boolean;
  showCoordinates?: boolean;
  boardOrientation?: 'white' | 'black';
  gamePGN?: string; // Add PGN prop for move symbols
}

export default function ChessBoardComponent({
  onMove,
  onAnalysisRequest,
  onAnalysisReset,
  initialFen = 'rnbqkbnr/pppppppp/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  analysis,
  isAnalyzing = false,
  showCoordinates = true,
  boardOrientation = 'white',
  gamePGN
}: ChessBoardComponentProps) {
  const [game, setGame] = useState(() => {
    try {
      return new Chess(initialFen || 'rnbqkbnr/pppppppp/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    } catch (error) {
      console.warn('Failed to initialize chess game with FEN:', initialFen, error);
      return new Chess(); // Fallback to standard position
    }
  });
  const [position, setPosition] = useState(initialFen || 'rnbqkbnr/pppppppp/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [arrows, setArrows] = useState<Array<{from: string, to: string, color: string}>>([]);

  // Update position when initialFen changes
  useEffect(() => {
    try {
      // Handle empty or invalid initialFen
      let validFen = initialFen;
      
      if (!validFen || validFen.trim() === '') {
        validFen = 'rnbqkbnr/pppppppp/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      }
      
      // Clean up the FEN string
      validFen = validFen.trim();
      
      // Test the FEN before creating the game
      const testGame = new Chess();
      try {
        testGame.load(validFen);
      } catch (fenError) {
        console.warn('Invalid FEN detected, using default:', validFen, fenError);
        validFen = 'rnbqkbnr/pppppppp/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      }
      
      const newGame = new Chess(validFen);
      setGame(newGame);
      setPosition(newGame.fen());
      setSelectedSquare(null);
    } catch (error) {
      console.warn('Failed to initialize chess game with FEN:', initialFen, error);
      // Fallback to default position if FEN is invalid
      const fallbackGame = new Chess();
      setGame(fallbackGame);
      setPosition(fallbackGame.fen());
      setSelectedSquare(null);
    }
  }, [initialFen, gamePGN]);

  // Parse PGN to extract moves for arrows
  const parsePGNToMoves = (pgn: string, gamePGN: string): Array<{from: string, to: string, color: string}> => {
    const moves: Array<{from: string, to: string, color: string}> = [];
    const tempGame = new Chess();
    
    try {
      // Validate PGN before loading
      if (!pgn || pgn.trim() === '') {
        console.warn('Empty PGN provided');
        return moves;
      }
      
      // Try to load PGN
      try {
        tempGame.loadPgn(pgn);
      } catch (pgnError) {
        console.warn('Failed to load PGN:', pgnError);
        return moves;
      }
      
      // Get move history
      const history = tempGame.history({ verbose: true });
      
      history.forEach((move, index) => {
        if (move.from && move.to) {
          moves.push({
            from: move.from,
            to: move.to,
            color: index % 2 === 0 ? 'rgba(0, 123, 255, 0.6)' : 'rgba(255, 123, 0, 0.6)' // Blue for white, red for black
          });
        }
      });
    } catch (error) {
      console.warn('Failed to parse PGN for arrows:', error);
    }
    
    return moves;
  };

  const onDrop = useCallback((sourceSquare: string, targetSquare: string) => {
    console.log('onDrop called:', { sourceSquare, targetSquare });
    if (sourceSquare === targetSquare) {
      console.log('Cannot move to same square');
      return false;
    }
    try {
      // Create a copy of current game state
      const gameCopy = new Chess(game.fen());
      console.log('Current FEN:', game.fen());
      
      // Try to make the move
      const move = gameCopy.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q'
      });

      if (move) {
        console.log('Move successful:', move);
        // Update game state
        setGame(gameCopy);
        setPosition(gameCopy.fen());
        
        // Notify parent component
        onMove?.(move.san, gameCopy.fen());
        onAnalysisRequest?.(gameCopy.fen());
        
        return true;
      } else {
        console.log('Move failed - invalid move');
      }
    } catch (error) {
      console.error('Invalid move:', error);
    }
    return false;
  }, [game, onMove, setSelectedSquare]);

  const resetGame = useCallback(() => {
    const newGame = new Chess();
    setGame(newGame);
    setPosition(newGame.fen());
    setSelectedSquare(null);
    onMove?.('', newGame.fen());
    onAnalysisReset?.();
  }, [game, onMove, setSelectedSquare, onAnalysisReset]);

  const undoMove = useCallback(() => {
    try {
      const gameCopy = new Chess(game.fen());
      gameCopy.undo();
      setGame(gameCopy);
      setPosition(gameCopy.fen());
      setSelectedSquare(null);
      onMove?.('', gameCopy.fen());
    } catch (error) {
      console.error('Cannot undo move:', error);
    }
  }, [game, onMove]);

  // Highlight best move from analysis
  const getCustomSquareStyles = useCallback(() => {
    const styles: Record<string, any> = {};
    
    // Highlight selected square
    if (selectedSquare) {
      styles[selectedSquare] = {
        backgroundColor: 'rgba(255, 255, 0, 0.3)'
      };
    }
    
    if (analysis && analysis.move) {
      try {
        const testGame = new Chess(game.fen());
        const move = testGame.move(analysis.move);
        if (move) {
          styles[move.from] = {
            backgroundColor: 'rgba(255, 255, 0, 0.5)'
          };
          styles[move.to] = {
            backgroundColor: 'rgba(0, 255, 0, 0.5)'
          };
        }
      } catch (error) {
        // Invalid move, return empty highlights
        console.warn('Invalid analysis move:', analysis.move);
      }
    }
    
    return styles;
  }, [analysis, game, selectedSquare]);

  return (
    <div className="flex flex-col items-center space-y-3 sm:space-y-4 w-full max-w-full">
      <div className="relative w-full max-w-[350px] sm:max-w-[400px] md:max-w-[500px] lg:max-w-[600px]">
        <div className="aspect-square">
          <Chessboard
            options={{
              position: position,
              boardOrientation: boardOrientation,
              showNotation: showCoordinates,
              allowDragging: true,
              allowDrawingArrows: true,
              arrows: arrows.map(arrow => ({
                startSquare: arrow.from,
                endSquare: arrow.to,
                color: arrow.color
              })),
              squareStyles: getCustomSquareStyles(),
              onPieceDrop: ({ piece, sourceSquare, targetSquare }) => {
                console.log('onPieceDrop called:', { piece, sourceSquare, targetSquare });
                if (!targetSquare) return false;
                return onDrop(sourceSquare, targetSquare);
              },
              onSquareClick: ({ piece, square }) => {
                console.log('onSquareClick called:', { piece, square });
                
                if (selectedSquare === null) {
                  // First click - select piece
                  if (piece) {
                    setSelectedSquare(square);
                  }
                } else {
                  // Second click - try to move
                  if (selectedSquare === square) {
                    // Clicking same square - deselect
                    setSelectedSquare(null);
                  } else if (onDrop(selectedSquare, square)) {
                    // Valid move
                    setSelectedSquare(null);
                  } else {
                    // Invalid move, just select new square if it has a piece
                    setSelectedSquare(piece ? square : null);
                  }
                }
              },
              canDragPiece: ({ isSparePiece, piece, square }) => {
                console.log('canDragPiece called:', { isSparePiece, piece, square, turn: game.turn() });
                if (!piece) return false;
                // Simple check - allow dragging any piece for now
                return true;
              }
            }}
          />
        </div>
        
        {isAnalyzing && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg">
            <div className="text-white text-sm sm:text-lg font-semibold px-2 text-center">Analyzing...</div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2 justify-center">
        <button
          onClick={resetGame}
          className="px-3 py-1 sm:px-4 sm:py-2 bg-green-600 text-white text-xs sm:text-sm rounded-lg hover:bg-green-700 transition-colors"
        >
          New Game
        </button>
        <button
          onClick={undoMove}
          className="px-3 py-1 sm:px-4 sm:py-2 bg-green-600 text-white text-xs sm:text-sm rounded-lg hover:bg-green-700 transition-colors"
          disabled={game.history().length === 0}
        >
          Undo
        </button>
        <button
          onClick={() => onAnalysisRequest?.(game.fen())}
          className="px-3 py-1 sm:px-4 sm:py-2 bg-green-600 text-white text-xs sm:text-sm rounded-lg hover:bg-green-700 transition-colors"
          disabled={isAnalyzing}
        >
          Analyze Position
        </button>
      </div>

      {analysis && Object.keys(analysis).length > 0 && (
        <div className="w-full max-w-full sm:max-w-md p-3 sm:p-4 bg-gray-800 rounded-lg shadow-lg border border-gray-700">
          <h3 className="font-semibold text-base sm:text-lg mb-2 text-white">AI Analysis</h3>
          <div className="space-y-2 text-xs sm:text-sm text-gray-300">
            <div>
              <span className="font-medium text-white">Best Move:</span> {analysis.move}
            </div>
            <div>
              <span className="font-medium text-white">Evaluation:</span> 
              <span className={`ml-2 font-bold ${analysis.evaluation > 0 ? 'text-green-400' : analysis.evaluation < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                {analysis.evaluation > 0 ? '+' : ''}{analysis.evaluation}
              </span>
            </div>
            <div>
              <span className="font-medium text-white">Confidence:</span> 
              <span className="ml-2">{Math.round(analysis.confidence * 100)}%</span>
            </div>
            <div>
              <span className="font-medium text-white">Reasoning:</span>
              <p className="mt-1 text-gray-400 text-xs sm:text-sm break-words">{analysis.reasoning}</p>
            </div>
            
            {analysis.patterns && analysis.patterns.length > 0 && (
              <div>
                <span className="font-medium text-white">Patterns:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {analysis.patterns.map((pattern, index) => (
                    <span
                      key={index}
                      className="px-1 sm:px-2 py-1 bg-green-900 text-green-300 rounded-full text-xs"
                    >
                      {pattern}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            {analysis.alternatives && analysis.alternatives.length > 0 && (
              <div>
                <span className="font-medium text-white">Alternatives:</span>
                <div className="mt-1 space-y-1">
                  {analysis.alternatives.map((alt, index) => (
                    <div key={index} className="flex justify-between text-xs">
                      <span className="text-gray-300 break-words mr-2">{alt.move}</span>
                      <span className={alt.evaluation > 0 ? 'text-green-400' : alt.evaluation < 0 ? 'text-red-400' : 'text-gray-400'}>
                        {alt.evaluation > 0 ? '+' : ''}{alt.evaluation}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {analysis.theoreticalMoves && analysis.theoreticalMoves.length > 0 && (
              <div>
                <span className="font-medium text-white">Theoretical Moves:</span>
                <div className="mt-1 space-y-1">
                  {analysis.theoreticalMoves.map((move, index) => (
                    <div key={index} className="text-xs">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1">
                        <span className="text-blue-300 font-medium">{move.move}</span>
                        <span className="text-gray-400">{move.frequency}%</span>
                      </div>
                      <div className="text-gray-500">{move.name}</div>
                      <div className="text-gray-600 break-words">{move.description}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {analysis.bookMoves && analysis.bookMoves.length > 0 && (
              <div>
                <span className="font-medium text-white">Book Moves:</span>
                <div className="mt-1 space-y-1">
                  {analysis.bookMoves.map((move, index) => (
                    <div key={index} className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1 text-xs">
                      <span className="text-green-300">{move.move}</span>
                      <div className="text-right">
                        <div className="text-gray-400">{move.source}</div>
                        <div className="text-gray-500">{Math.round(move.confidence * 100)}%</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
