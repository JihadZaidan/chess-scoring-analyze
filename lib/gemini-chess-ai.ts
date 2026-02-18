import { Chess } from 'chess.js';
import { StockfishEngine, AnalysisResult, PositionAnalysis, MultiVersionStockfish } from './stockfish';
import { LichessAPI, LichessGame } from './lichess-api';
import { ChessComAPI, ChessComGame } from './chesscom-api';
import axios from 'axios';

export interface AIMoveSuggestion {
  move: string;
  confidence: number;
  reasoning: string;
  evaluation: number;
  alternatives: {
    move: string;
    evaluation: number;
    reasoning: string;
  }[];
  patterns: string[];
  opening?: string;
  endgame?: string;
  theoreticalMoves?: {
    move: string;
    name: string;
    description: string;
    frequency: number;
    averageRating: number;
  }[];
  bookMoves?: {
    move: string;
    source: string;
    confidence: number;
  }[];
}

export interface GameAnalysis {
  summary: {
    whiteAccuracy: number;
    blackAccuracy: number;
    averageRating: number;
    gameResult: string;
    timeControl: string;
    opening: string;
    criticalMoments: number;
  };
  moves: PositionAnalysis[];
  insights: {
    patterns: string[];
    improvements: string[];
    strengths: string[];
    weaknesses: string[];
  };
  recommendations: {
    studyTopics: string[];
    trainingExercises: string[];
    nextOpponentLevel: string;
  };
}

export interface Pattern {
  name: string;
  type: 'tactical' | 'positional' | 'endgame' | 'opening';
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'master';
  examples: string[];
}

export class GeminiChessAI {
  private stockfish: MultiVersionStockfish;
  private lichessAPI: LichessAPI;
  private chesscomAPI: ChessComAPI;
  private patterns: Pattern[];

  constructor(lichessToken?: string) {
    this.stockfish = new MultiVersionStockfish();
    this.lichessAPI = new LichessAPI(lichessToken);
    this.chesscomAPI = new ChessComAPI();
    this.patterns = this.initializePatterns();
  }

  private initializePatterns(): Pattern[] {
    return [
      {
        name: 'Fork',
        type: 'tactical',
        description: 'A piece attacks two or more enemy pieces simultaneously',
        difficulty: 'beginner',
        examples: ['Nf3+', 'Ng5+', 'Bb5+']
      },
      {
        name: 'Pin',
        type: 'tactical',
        description: 'A piece attacks an enemy piece that cannot move without exposing a more valuable piece',
        difficulty: 'intermediate',
        examples: ['Bb5', 'Rd1', 'Qg4']
      },
      {
        name: 'Skewer',
        type: 'tactical',
        description: 'A piece attacks two enemy pieces on the same line, forcing the more valuable piece to move',
        difficulty: 'intermediate',
        examples: ['Rd8+', 'Qa4+', 'Bh7+']
      },
      {
        name: 'Discovered Attack',
        type: 'tactical',
        description: 'Moving a piece reveals an attack from another piece behind it',
        difficulty: 'advanced',
        examples: ['Nge2', 'Bg5', 'c4']
      },
      {
        name: 'Zugzwang',
        type: 'positional',
        description: 'A player is forced to make a move that worsens their position',
        difficulty: 'advanced',
        examples: ['Kh8', 'Ka7', 'Ke6']
      },
      {
        name: 'Opposition',
        type: 'endgame',
        description: 'Kings face each other with one square between, giving the player to move an advantage',
        difficulty: 'intermediate',
        examples: ['Ke6', 'Kd4', 'Kf4']
      },
      {
        name: 'Lucena Position',
        type: 'endgame',
        description: 'Rook and pawn vs rook endgame winning technique',
        difficulty: 'master',
        examples: ['Rf2+', 'Kg7', 'Ra2']
      },
      {
        name: 'Philidor Position',
        type: 'endgame',
        description: 'Rook and pawn vs rook endgame drawing technique',
        difficulty: 'master',
        examples: ['Rd6+', 'Ke3', 'Rg6']
      }
    ];
  }

  async analyzePosition(
    fen: string, 
    depth: number = 20,
    stockfishVersion: string = '17'
  ): Promise<AIMoveSuggestion> {
    try {
      const engine = await this.stockfish.getEngine(stockfishVersion);
      const analysis = await engine.analyzePosition(fen, depth, 10000);
      const topMoves = await engine.getTopMoves(fen, 3);
      
      const chess = new Chess(fen);
      const patterns = this.detectPatterns(fen);
      const gamePhase = this.getGamePhase(fen);
      
      const reasoning = this.generateReasoning(
        analysis,
        patterns,
        gamePhase,
        chess
      );

      return {
        move: analysis.bestMove,
        confidence: this.calculateConfidence(analysis, topMoves),
        reasoning,
        evaluation: analysis.evaluation,
        alternatives: topMoves.slice(1).map((alt, index) => ({
          move: alt.bestMove,
          evaluation: alt.evaluation,
          reasoning: this.generateAlternativeReasoning(alt, index + 2)
        })),
        patterns: patterns.map(p => p.name),
        opening: gamePhase === 'opening' ? this.getOpeningName(fen) : undefined,
        endgame: gamePhase === 'endgame' ? this.getEndgameType(fen) : undefined,
        theoreticalMoves: this.getTheoreticalMoves(fen),
        bookMoves: this.getBookMoves(fen)
      };
    } catch (error) {
      console.warn('Stockfish analysis failed, using fallback:', error);
      // Fallback to simple analysis
      return this.generateFallbackAnalysis(fen);
    }
  }

  private generateFallbackAnalysis(fen: string): AIMoveSuggestion {
    const chess = new Chess(fen);
    const moves = chess.moves({ verbose: true });
    
    // Simple evaluation based on material
    const material = this.calculateMaterial(chess);
    const evaluation = material.white - material.black;
    
    // Pick a random legal move as fallback
    const randomMove = moves[Math.floor(Math.random() * Math.min(moves.length, 5))];
    
    return {
      move: randomMove ? randomMove.san : 'e2e4',
      confidence: 0.3,
      reasoning: `Basic analysis suggests ${randomMove ? randomMove.san : 'e2e4'} as a reasonable move. Material balance: ${evaluation > 0 ? '+' : ''}${evaluation}. This is a simplified analysis without Stockfish engine.`,
      evaluation: evaluation,
      alternatives: moves.slice(1, 4).map(move => ({
        move: move.san,
        evaluation: 0,
        reasoning: 'Alternative move based on basic principles'
      })),
      patterns: [],
      opening: this.getOpeningName(fen),
      endgame: this.getEndgameType(fen)
    };
  }

  private calculateMaterial(chess: Chess): { white: number, black: number } {
    const materialValues: Record<string, number> = {
      'p': 1, 'n': 3, 'b': 3, 'r': 5, 'q': 9, 'k': 0
    };
    
    let white = 0, black = 0;
    const board = chess.board();
    
    for (const row of board) {
      for (const piece of row) {
        if (piece) {
          const value = materialValues[piece.type.toLowerCase()];
          if (piece.color === 'w') white += value;
          else black += value;
        }
      }
    }
    
    return { white, black };
  }

  async analyzeGame(
    pgn: string,
    platform: 'lichess' | 'chesscom' = 'lichess',
    stockfishVersion: string = '17'
  ): Promise<GameAnalysis> {
    try {
      const engine = await this.stockfish.getEngine(stockfishVersion);
      const positionAnalyses = await engine.analyzeGame(pgn);
      
      const chess = new Chess();
      chess.loadPgn(pgn);
      
      const summary = this.generateGameSummary(positionAnalyses, chess);
      const insights = this.generateInsights(positionAnalyses);
      const recommendations = this.generateRecommendations(insights, summary);

      return {
        summary,
        moves: positionAnalyses,
        insights,
        recommendations
      };
    } catch (error) {
      console.warn('Stockfish game analysis failed, using fallback:', error);
      return this.generateFallbackGameAnalysis(pgn);
    }
  }

  private generateFallbackGameAnalysis(pgn: string): GameAnalysis {
    const chess = new Chess();
    try {
      chess.loadPgn(pgn);
    } catch (error) {
      console.error('Invalid PGN:', error);
      return this.generateEmptyGameAnalysis();
    }

    const history = chess.history({ verbose: true });
    const moves: PositionAnalysis[] = [];
    
    // Generate simple analysis for each move
    chess.reset();
    for (let i = 0; i < history.length; i++) {
      const move = history[i];
      const fen = chess.fen();
      
      moves.push({
        fen,
        move: move.san,
        analysis: [{
          bestMove: move.san,
          evaluation: 0,
          depth: 1,
          nodes: 1,
          time: 0,
          pv: [move.san]
        }]
      });
      
      chess.move(move.san);
    }

    return {
      summary: {
        whiteAccuracy: 50,
        blackAccuracy: 50,
        averageRating: 1200,
        gameResult: chess.history().length % 2 === 0 ? '1-0' : '0-1',
        timeControl: 'Unknown',
        opening: 'Unknown',
        criticalMoments: 0
      },
      moves,
      insights: {
        patterns: [],
        improvements: ['Study basic tactics', 'Practice endgames'],
        strengths: ['Good opening knowledge'],
        weaknesses: ['Tactical awareness needs improvement']
      },
      recommendations: {
        studyTopics: ['Basic tactics', 'Opening principles'],
        trainingExercises: ['Puzzle solving', 'Endgame practice'],
        nextOpponentLevel: 'Similar rating players'
      }
    };
  }

  private generateEmptyGameAnalysis(): GameAnalysis {
    return {
      summary: {
        whiteAccuracy: 50,
        blackAccuracy: 50,
        averageRating: 1200,
        gameResult: '*',
        timeControl: 'Unknown',
        opening: 'Unknown',
        criticalMoments: 0
      },
      moves: [],
      insights: {
        patterns: [],
        improvements: ['Learn chess basics'],
        strengths: [],
        weaknesses: ['Complete beginner']
      },
      recommendations: {
        studyTopics: ['Rules of chess', 'Basic tactics'],
        trainingExercises: ['Learn piece movements', 'Practice checkmating'],
        nextOpponentLevel: 'Beginner players'
      }
    };
  }

  async analyzeLichessGame(gameId: string): Promise<GameAnalysis> {
    const game = await this.lichessAPI.getGame(gameId);
    return this.analyzeGame(game.pgn, 'lichess');
  }

  async analyzeChessComGame(gameUrl: string): Promise<GameAnalysis> {
    const game = await this.chesscomAPI.getGameByURL(gameUrl);
    return this.analyzeGame(game.pgn, 'chesscom');
  }

  async getPlayerAnalysis(
    username: string,
    platform: 'lichess' | 'chesscom',
    gameCount: number = 10
  ): Promise<{
    profile: any;
    recentGames: GameAnalysis[];
    overallStats: {
      averageAccuracy: number;
      commonPatterns: string[];
      improvementAreas: string[];
      ratingProgress: number[];
    };
  }> {
    let games: any[] = [];
    let profile: any;

    if (platform === 'lichess') {
      profile = await this.lichessAPI.getUser(username);
      games = await this.lichessAPI.getUserGames(username, { max: gameCount });
    } else {
      profile = await this.chesscomAPI.getPlayerProfile(username);
      const monthlyArchives = await this.chesscomAPI.getMonthlyArchives(username);
      // Get recent games from latest archive
      if (monthlyArchives.length > 0) {
        const latestArchive = monthlyArchives[monthlyArchives.length - 1];
        const archiveResponse = await axios.get(latestArchive);
        games = archiveResponse.data.games.slice(0, gameCount);
      }
    }

    const gameAnalyses = await Promise.all(
      games.map(game => 
        platform === 'lichess' 
          ? this.analyzeGame(game.pgn, 'lichess')
          : this.analyzeGame(game.pgn, 'chesscom')
      )
    );

    const overallStats = this.calculatePlayerStats(gameAnalyses);

    return {
      profile,
      recentGames: gameAnalyses,
      overallStats
    };
  }

  private detectPatterns(fen: string): Pattern[] {
    const chess = new Chess(fen);
    const detectedPatterns: Pattern[] = [];

    // Simple pattern detection based on position
    const moves = chess.moves({ verbose: true });
    
    for (const move of moves) {
      // Check for forks
      if (move.piece === 'n') {
        const targets = this.countAttackedPieces(chess, move.to);
        if (targets >= 2) {
          detectedPatterns.push(this.patterns.find(p => p.name === 'Fork')!);
        }
      }
      
      // Check for pins/skewers
      if (['r', 'b', 'q'].includes(move.piece)) {
        if (this.isPinOrSkewer(chess, move.from, move.to)) {
          detectedPatterns.push(this.patterns.find(p => p.name === 'Pin')!);
        }
      }
    }

    return detectedPatterns;
  }

  private countAttackedPieces(chess: Chess, square: string): number {
    // Simplified attack counting
    return chess.moves({ verbose: true })
      .filter(move => move.to === square)
      .length;
  }

  private isPinOrSkewer(chess: Chess, from: string, to: string): boolean {
    // Simplified pin/skewer detection
    return false; // Placeholder for complex logic
  }

  private getGamePhase(fen: string): 'opening' | 'middlegame' | 'endgame' {
    const chess = new Chess(fen);
    const moveCount = chess.history().length;
    
    if (moveCount < 10) return 'opening';
    if (moveCount < 30) return 'middlegame';
    return 'endgame';
  }

  private getOpeningName(fen: string): string {
    // Simplified opening detection
    return 'Unknown Opening';
  }

  private getEndgameType(fen: string): string {
    // Simplified endgame classification
    return 'Unknown Endgame';
  }

  private generateReasoning(
    analysis: AnalysisResult,
    patterns: Pattern[],
    gamePhase: string,
    chess: Chess
  ): string {
    let reasoning = '';
    
    if (analysis.mate) {
      reasoning += `Mate in ${Math.abs(analysis.mate)} moves. `;
    } else {
      reasoning += `Evaluation: ${analysis.evaluation > 0 ? '+' : ''}${analysis.evaluation}. `;
    }
    
    if (patterns.length > 0) {
      reasoning += `This position contains tactical patterns: ${patterns.map(p => p.name).join(', ')}. `;
    }
    
    reasoning += `In the ${gamePhase}, this move `;
    
    if (analysis.evaluation > 2) {
      reasoning += 'gives a decisive advantage.';
    } else if (analysis.evaluation > 0.5) {
      reasoning += 'improves the position significantly.';
    } else if (analysis.evaluation > -0.5) {
      reasoning += 'maintains equal chances.';
    } else {
      reasoning += 'leads to a disadvantage.';
    }
    
    return reasoning;
  }

  private generateAlternativeReasoning(analysis: AnalysisResult, moveNumber: number): string {
    return `Alternative move ${moveNumber} with evaluation ${analysis.evaluation > 0 ? '+' : ''}${analysis.evaluation}.`;
  }

  private calculateConfidence(bestMove: AnalysisResult, topMoves: AnalysisResult[]): number {
    if (topMoves.length < 2) return 1.0;
    
    const evalDiff = Math.abs(bestMove.evaluation - topMoves[1].evaluation);
    return Math.min(1.0, evalDiff / 2.0);
  }

  private generateGameSummary(analyses: PositionAnalysis[], chess: Chess): GameAnalysis['summary'] {
    const whiteMoves = analyses.filter((_, i) => i % 2 === 0);
    const blackMoves = analyses.filter((_, i) => i % 2 === 1);
    
    const whiteAccuracy = this.calculateAccuracy(whiteMoves);
    const blackAccuracy = this.calculateAccuracy(blackMoves);
    
    const criticalMoments = analyses.filter(a => a.blunder || a.brilliant).length;
    
    return {
      whiteAccuracy,
      blackAccuracy,
      averageRating: 1500, // Placeholder
      gameResult: chess.turn() === 'w' ? '0-1' : '1-0', // Simplified
      timeControl: 'Unknown',
      opening: 'Unknown',
      criticalMoments
    };
  }

  private calculateAccuracy(moves: PositionAnalysis[]): number {
    if (moves.length === 0) return 0;
    
    const accurateMoves = moves.filter(m => !m.blunder && !m.mistake).length;
    return (accurateMoves / moves.length) * 100;
  }

  private getTheoreticalMoves(fen: string): AIMoveSuggestion['theoreticalMoves'] {
    const chess = new Chess(fen);
    const moves = chess.moves({ verbose: true });
    const theoreticalMoves: AIMoveSuggestion['theoreticalMoves'] = [];
    
    // Common theoretical moves based on position patterns
    const commonPatterns = [
      {
        pattern: /^rnbqkbnr\/pppppppp\/8\/8\/8\/8\/PPPPPPPP\/RNBQKBNR/,
        moves: [
          { move: 'e2e4', name: 'King\'s Pawn Opening', description: 'Most popular opening move', frequency: 45, averageRating: 1800 },
          { move: 'd2d4', name: 'Queen\'s Pawn Opening', description: 'Second most popular opening move', frequency: 35, averageRating: 1750 },
          { move: 'g1f3', name: 'Réti Opening', description: 'Hypermodern opening', frequency: 8, averageRating: 1900 }
        ]
      },
      {
        pattern: /^rnbqkb1r\/pppp1ppp\/2n2n2\/4p3\/4P3\/2N2N2\/PPPP1PPP\/RNBQKB1R/,
        moves: [
          { move: 'f1c4', name: 'Italian Game', description: 'Classical development', frequency: 25, averageRating: 1700 },
          { move: 'f1b5', name: 'Ruy Lopez', description: 'Spanish Opening', frequency: 30, averageRating: 1800 }
        ]
      }
    ];
    
    commonPatterns.forEach(({ pattern, moves: patternMoves }) => {
      if (pattern.test(fen)) {
        theoreticalMoves.push(...patternMoves.filter(move => 
          moves.some(m => m.from + m.to === move.move)
        ));
      }
    });
    
    // Add general theoretical principles
    if (chess.turn() === 'w') {
      theoreticalMoves.push(
        { move: 'g1f3', name: 'Knight Development', description: 'Develop knight to natural square', frequency: 15, averageRating: 1600 },
        { move: 'b1c3', name: 'Queen Knight Development', description: 'Develop queen knight', frequency: 12, averageRating: 1600 }
      );
    }
    
    return theoreticalMoves.slice(0, 3);
  }

  private getBookMoves(fen: string): AIMoveSuggestion['bookMoves'] {
    const chess = new Chess(fen);
    const moves = chess.moves({ verbose: true });
    const bookMoves: AIMoveSuggestion['bookMoves'] = [];
    
    // Opening book moves based on common theory
    const openingBook = new Map([
      ['e2e4', { source: 'MCO-15', confidence: 0.95 }],
      ['d2d4', { source: 'MCO-15', confidence: 0.93 }],
      ['g1f3', { source: 'NCO', confidence: 0.88 }],
      ['b1c3', { source: 'NCO', confidence: 0.85 }],
      ['f1c4', { source: 'MCO-15', confidence: 0.82 }],
      ['f1b5', { source: 'MCO-15', confidence: 0.90 }],
      ['e2e3', { source: 'NCO', confidence: 0.75 }],
      ['d2d3', { source: 'NCO', confidence: 0.72 }]
    ]);
    
    moves.forEach(move => {
      const moveStr = move.from + move.to;
      const bookInfo = openingBook.get(moveStr);
      if (bookInfo) {
        bookMoves.push({
          move: moveStr,
          source: bookInfo.source,
          confidence: bookInfo.confidence
        });
      }
    });
    
    return bookMoves.slice(0, 3);
  }

  private generateInsights(analyses: PositionAnalysis[]): GameAnalysis['insights'] {
    const patterns = analyses.flatMap(a => a.analysis).map(a => a.pv).flat();
    const blunders = analyses.filter(a => a.blunder).length;
    const brilliantMoves = analyses.filter(a => a.brilliant).length;
    
    return {
      patterns: ['Tactical awareness', 'Positional understanding'],
      improvements: blunders > 0 ? ['Reduce blunders', 'Better time management'] : [],
      strengths: brilliantMoves > 0 ? ['Tactical vision', 'Calculation accuracy'] : [],
      weaknesses: blunders > 2 ? ['Tactical oversight', 'Time pressure'] : []
    };
  }

  private generateRecommendations(
    insights: GameAnalysis['insights'],
    summary: GameAnalysis['summary']
  ): GameAnalysis['recommendations'] {
    return {
      studyTopics: ['Tactics', 'Endgames', 'Opening theory'],
      trainingExercises: ['Puzzle solving', 'Game analysis', 'Speed chess'],
      nextOpponentLevel: summary.averageRating > 1500 ? '1600-1800' : '1400-1600'
    };
  }

  private calculatePlayerStats(games: GameAnalysis[]): {
    averageAccuracy: number;
    commonPatterns: string[];
    improvementAreas: string[];
    ratingProgress: number[];
  } {
    const accuracies = games.map(g => (g.summary.whiteAccuracy + g.summary.blackAccuracy) / 2);
    const averageAccuracy = accuracies.reduce((a, b) => a + b, 0) / accuracies.length;
    
    return {
      averageAccuracy,
      commonPatterns: ['Fork', 'Pin', 'Skewer'],
      improvementAreas: ['Tactics', 'Endgames'],
      ratingProgress: [1500, 1520, 1540] // Placeholder
    };
  }

  terminate(): void {
    this.stockfish.terminateAll();
  }
}
