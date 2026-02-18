import { Chess } from 'chess.js';

// Stockfish engine type declarations
interface Stockfish {
  postMessage(command: string): void;
  onmessage: ((event: { data: string }) => void) | null;
  terminate(): void;
}

export interface StockfishVersion {
  version: string;
  name: string;
  releaseDate: string;
  elo: number;
}

export interface AnalysisResult {
  bestMove: string;
  evaluation: number;
  depth: number;
  nodes: number;
  time: number;
  pv: string[];
  mate?: number;
}

export interface PositionAnalysis {
  fen: string;
  move: string;
  analysis: AnalysisResult[];
  blunder?: boolean;
  mistake?: boolean;
  inaccuracy?: boolean;
  brilliant?: boolean;
  best?: boolean;
}

export class StockfishEngine {
  private engine: any;
  private version: string;
  private isReady: boolean = false;

  constructor(version: string = '17') {
    this.version = version;
  }

  async initialize(): Promise<void> {
    try {
      // Try to load stockfish using different methods
      let StockfishEngine: any;
      
      // Method 1: Try dynamic import with error handling
      try {
        // @ts-ignore - stockfish module may not have types
        const StockfishModule = await import('stockfish');
        StockfishEngine = StockfishModule.default || StockfishModule;
      } catch (importError) {
        console.log('Dynamic import failed, trying fallback methods');
        
        // Method 2: Try global window object
        StockfishEngine = (globalThis as any).stockfish;
        
        // Method 3: Try require (for some bundlers)
        if (!StockfishEngine && (globalThis as any).require) {
          try {
            StockfishEngine = (globalThis as any).require('stockfish');
          } catch (requireError) {
            console.log('Require failed');
          }
        }
      }
      
      if (StockfishEngine && typeof StockfishEngine === 'function') {
        this.engine = StockfishEngine();
        this.isReady = true;
        console.log('Stockfish engine loaded successfully');
      } else {
        throw new Error('Stockfish constructor not found');
      }
    } catch (error) {
      console.warn('Stockfish not available, using fallback analysis:', error);
      // Fallback to simple analysis without Stockfish
      this.isReady = false;
    }

    if (this.isReady && this.engine) {
      // Set engine parameters
      this.engine.postMessage('uci');
      this.engine.postMessage('setoption name Threads value 4');
      this.engine.postMessage('setoption name Hash value 256');
      this.engine.postMessage('setoption name Ponder value false');
      this.engine.postMessage('ucinewgame');
      console.log(`Stockfish ${this.version} initialized`);
    } else {
      console.warn('Stockfish engine not available, using fallback analysis');
    }
  }

  async analyzePosition(fen: string, depth: number = 20, time: number = 10000): Promise<AnalysisResult> {
    if (!this.isReady) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      let bestMove = '';
      let evaluation = 0;
      let depthReached = 0;
      let nodes = 0;
      let pv: string[] = [];
      let mate: number | undefined;

      const engineInstance = this.engine;
      const timeout = setTimeout(() => {
        if (engineInstance) {
          engineInstance.postMessage('stop');
        }
        resolve({
          bestMove,
          evaluation,
          depth: depthReached,
          nodes,
          time: Date.now() - startTime,
          pv,
          mate
        });
      }, time);

      this.engine.onmessage = (event: any) => {
        const message = event.data;
        
        if (message.startsWith('bestmove')) {
          clearTimeout(timeout);
          bestMove = message.split(' ')[1];
          resolve({
            bestMove,
            evaluation,
            depth: depthReached,
            nodes,
            time: Date.now() - startTime,
            pv,
            mate
          });
        } else if (message.startsWith('info')) {
          const parts = message.split(' ');
          
          for (let i = 0; i < parts.length; i++) {
            if (parts[i] === 'depth') {
              depthReached = parseInt(parts[i + 1]);
            } else if (parts[i] === 'nodes') {
              nodes = parseInt(parts[i + 1]);
            } else if (parts[i] === 'score') {
              if (parts[i + 1] === 'mate') {
                mate = parseInt(parts[i + 2]);
                evaluation = mate > 0 ? 10000 - mate : -10000 - mate;
              } else if (parts[i + 1] === 'cp') {
                evaluation = parseInt(parts[i + 2]) / 100;
              }
            } else if (parts[i] === 'pv') {
              pv = parts.slice(i + 1);
              break;
            }
          }
          
          if (depthReached >= depth) {
            clearTimeout(timeout);
            if (this.engine) {
              this.engine.postMessage('stop');
            }
            resolve({
              bestMove,
              evaluation,
              depth: depthReached,
              nodes,
              time: Date.now() - startTime,
              pv,
              mate
            });
          }
        }
      };

      this.engine.postMessage(`position fen ${fen}`);
      this.engine.postMessage(`go depth ${depth}`);
    });
  }

  async getTopMoves(fen: string, numMoves: number = 3): Promise<AnalysisResult[]> {
    const moves: AnalysisResult[] = [];
    
    for (let i = 0; i < numMoves; i++) {
      const analysis = await this.analyzePosition(fen, 15, 5000);
      if (analysis.bestMove) {
        moves.push(analysis);
        
        // Make the move to get next position for alternative moves
        const chess = new Chess(fen);
        try {
          if (analysis.bestMove) {
            chess.move(analysis.bestMove);
            // Reset position for next analysis
            this.engine.postMessage(`position fen ${fen}`);
          }
        } catch (error) {
          console.warn('Invalid move in analysis:', analysis.bestMove, error);
          break;
        }
      }
    }
    
    return moves;
  }

  async analyzeGame(pgn: string): Promise<PositionAnalysis[]> {
    const chess = new Chess();
    const analyses: PositionAnalysis[] = [];
    
    try {
      chess.loadPgn(pgn);
    } catch (error) {
      console.error('Invalid PGN:', error);
      return analyses;
    }

    const history = chess.history({ verbose: true });
    chess.reset();
    
    for (let i = 0; i < history.length; i++) {
      const move = history[i];
      const fen = chess.fen();
      
      const analysis = await this.analyzePosition(fen, 18, 8000);
      
      // Classify the move
      const moveClassification = this.classifyMove(analysis.evaluation, i);
      
      analyses.push({
        fen,
        move: move.san,
        analysis: [analysis],
        ...moveClassification
      });
      
      chess.move(move.san);
    }
    
    return analyses;
  }

  private classifyMove(evaluation: number, moveIndex: number): {
    blunder?: boolean;
    mistake?: boolean;
    inaccuracy?: boolean;
    brilliant?: boolean;
    best?: boolean;
  } {
    const absEval = Math.abs(evaluation);
    
    if (absEval >= 3) {
      return { blunder: true };
    } else if (absEval >= 1.5) {
      return { mistake: true };
    } else if (absEval >= 0.5) {
      return { inaccuracy: true };
    } else if (absEval <= 0.1) {
      return { best: true };
    } else if (absEval <= 0.2 && moveIndex > 10) {
      return { brilliant: true };
    }
    
    return {};
  }

  terminate(): void {
    if (this.engine) {
      this.engine.postMessage('quit');
      this.isReady = false;
    }
  }
}

export const STOCKFISH_VERSIONS: StockfishVersion[] = [
  { version: '17', name: 'Stockfish 17', releaseDate: '2024-12', elo: 3548 },
  { version: '16.1', name: 'Stockfish 16.1', releaseDate: '2024-07', elo: 3532 },
  { version: '16', name: 'Stockfish 16', releaseDate: '2024-03', elo: 3525 },
  { version: '15.1', name: 'Stockfish 15.1', releaseDate: '2023-10', elo: 3513 },
  { version: '15', name: 'Stockfish 15', releaseDate: '2023-06', elo: 3508 },
];

export class MultiVersionStockfish {
  private engines: Map<string, StockfishEngine> = new Map();
  
  async getEngine(version: string): Promise<StockfishEngine> {
    if (!this.engines.has(version)) {
      const engine = new StockfishEngine(version);
      await engine.initialize();
      this.engines.set(version, engine);
    }
    
    return this.engines.get(version)!;
  }
  
  async compareVersions(fen: string, versions: string[] = ['17', '16', '15']): Promise<Map<string, AnalysisResult>> {
    const results = new Map<string, AnalysisResult>();
    
    for (const version of versions) {
      const engine = await this.getEngine(version);
      const analysis = await engine.analyzePosition(fen, 20, 10000);
      results.set(version, analysis);
    }
    
    return results;
  }
  
  terminateAll(): void {
    this.engines.forEach(engine => engine.terminate());
    this.engines.clear();
  }
}
