import { Chess, Square, Move } from 'chess.js';
import * as ort from 'onnxruntime-web';

declare module 'onnxruntime-web' {
  interface WasmPaths {
    'ort-wasm.wasm': string;
    'ort-wasm-simd.wasm': string;
    'ort-wasm-threaded.wasm': string;
  }
}

// Set path untuk file WASM
if (typeof window !== 'undefined') {
  ort.env.wasm.numThreads = 4;
  ort.env.wasm.simd = true;
  const wasmPaths = {
    'ort-wasm.wasm': '/onnx/ort-wasm.wasm',
    'ort-wasm-simd.wasm': '/onnx/ort-wasm-simd.wasm',
    'ort-wasm-threaded.wasm': '/onnx/ort-wasm-threaded.wasm'
  };
  Object.assign(ort.env.wasm, { wasmPaths });
}

// Definisikan tipe status
type AIStatus = 'idle' | 'loading' | 'ready' | 'error';

export class ChessAI {
  private model: ort.InferenceSession | null = null;
  private positionCache: Map<string, number> = new Map();
  private openingBook: Map<string, string>;
  private initializationStatus: AIStatus = 'idle';
  private modelLoadingProgress: number = 0;
  private maxDepth = 3;

  constructor() {
    // Initialize opening book in constructor
    this.openingBook = new Map<string, string>([
      // King's Pawn Opening
      ['rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1', 'e7e5'],
      ['rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2', 'Nf3'],
      ['rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2', 'Nc6'],
      ['r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3', 'Bb5'],
      
      // Sicilian Defense
      ['rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1', 'c7c5'],
      ['rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2', 'Nf3'],
      ['rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2', 'd7d6'],
      
      // French Defense
      ['rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1', 'e7e6'],
      ['rnbqkbnr/pppp1ppp/4p3/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2', 'd4'],
      ['rnbqkbnr/pppp1ppp/4p3/8/3PP3/8/PPP2PPP/RNBQKBNR b KQkq - 0 2', 'd5'],

      // Queen's Gambit
      ['rnbqkbnr/pppppppp/8/8/2P5/8/PP1PPPPP/RNBQKBNR b KQkq - 0 1', 'd7d5'],
      ['rnbqkbnr/ppp1pppp/8/3p4/2P5/8/PP1PPPPP/RNBQKBNR w KQkq - 0 2', 'd4'],
      ['rnbqkbnr/ppp1pppp/8/3p4/2PPP3/8/PP3PPP/RNBQKBNR b KQkq - 0 2', 'e6'],

      // Nimzo-Indian Defense
      ['rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b KQkq - 0 1', 'Nf6'],
      ['rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R w KQkq - 1 1', 'c4'],
      ['rnbqkbnr/pppppppp/8/8/2P5/5N2/PP1PPPPP/RNBQKB1R b KQkq - 1 2', 'e6'],
      ['rnbqkbnr/pppp1ppp/4p3/8/2P5/5N2/PP1PPPPP/RNBQKB1R w KQkq - 2 3', 'Nc3'],
      ['rnbqkbnr/pppp1ppp/4p3/8/2P5/2N2N2/PP1PPPPP/R1BQKB1R b KQkq - 2 3', 'Bb4'],

      // Caro-Kann Defense
      ['rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1', 'c7c6'],
      ['rnbqkbnr/pp1ppppp/2p5/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2', 'd4'],
      ['rnbqkbnr/pp1ppppp/2p5/8/3PP3/8/PPP2PPP/RNBQKBNR b KQkq - 0 2', 'd5'],
      ['rnbqkbnr/pp2pppp/2p5/3p4/3PP3/8/PPP2PPP/RNBQKBNR w KQkq - 0 3', 'Nc3'],
    ]);
    this.initialize();
  }

  public getInitializationStatus(): { status: AIStatus; progress: number } {
    return {
      status: this.initializationStatus,
      progress: this.modelLoadingProgress
    };
  }

  private boardToInput(board: Chess): Float32Array {
    const input = new Float32Array(896);
    const pieces = 'PNBRQKpnbrqk';

    // Basic piece positions (768)
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        const square = (String.fromCharCode(97 + j) + (8 - i)) as Square;
        const piece = board.get(square);
        if (piece) {
          const pieceIndex = pieces.indexOf(piece.type + (piece.color === 'w' ? '' : piece.type.toLowerCase()));
          if (pieceIndex !== -1) {
            input[(i * 8 + j) * 12 + pieceIndex] = 1;
          }
        }
      }
    }

    // Material count and positional features
    let featureIdx = 768;
    
    // Material count (piece counts for each side)
    const counts = this.countAllPieces(board);
    for (const piece of 'PNBRQKpnbrqk') {
      input[featureIdx++] = counts[piece] || 0;
    }

    // Center control
    const centerSquares = ['e4', 'd4', 'e5', 'd5'];
    let whiteCenterControl = 0;
    let blackCenterControl = 0;
    
    for (const square of centerSquares) {
      if (board.get(square as Square)) {
        if (board.get(square as Square)?.color === 'w') whiteCenterControl++;
        else blackCenterControl++;
      }
    }
    
    input[featureIdx++] = whiteCenterControl;
    input[featureIdx++] = blackCenterControl;

    // King safety (distance of enemy pieces from king)
    const kings = this.findKings(board);
    input[featureIdx++] = this.evaluateKingSafety(board, kings.white, 'w');
    input[featureIdx++] = this.evaluateKingSafety(board, kings.black, 'b');

    return input;
  }

  private countAllPieces(board: Chess): { [key: string]: number } {
    const counts: { [key: string]: number } = {};
    board.board().forEach(row => {
      row?.forEach(piece => {
        if (piece) {
          const key = piece.color === 'w' ? piece.type.toUpperCase() : piece.type.toLowerCase();
          counts[key] = (counts[key] || 0) + 1;
        }
      });
    });
    return counts;
  }

  private findKings(board: Chess): { white: Square | null; black: Square | null } {
    let white: Square | null = null;
    let black: Square | null = null;

    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        const square = (String.fromCharCode(97 + j) + (8 - i)) as Square;
        const piece = board.get(square);
        if (piece && piece.type === 'k') {
          if (piece.color === 'w') white = square;
          else black = square;
        }
      }
    }

    return { white, black };
  }

  private evaluateKingSafety(board: Chess, kingSquare: Square | null, color: 'w' | 'b'): number {
    if (!kingSquare) return 0;

    let safety = 0;
    const enemyColor = color === 'w' ? 'b' : 'w';
    const moves = board.moves({ verbose: true, square: kingSquare });

    // King mobility
    safety += moves.length;

    // Pawn shield
    const rank = color === 'w' ? '2' : '7';
    const pawnShieldSquares = ['f', 'g', 'h'].map(file => file + rank);
    for (const square of pawnShieldSquares) {
      const piece = board.get(square as Square);
      if (piece && piece.type === 'p' && piece.color === color) {
        safety += 2;
      }
    }

    // Enemy pieces attacking near king
    const attackingMoves = board.moves({ verbose: true, square: kingSquare });
    const attackers = attackingMoves.filter(move => {
      const piece = board.get(move.to as Square);
      return piece && piece.color === enemyColor;
    });

    safety -= attackers.length * 2;

    return safety;
  }

  private async evaluatePosition(board: Chess): Promise<number> {
    const fen = board.fen();
    
    if (this.positionCache.has(fen)) {
      return this.positionCache.get(fen)!;
    }

    if (!this.model) {
      throw new Error('Model not loaded');
    }

    try {
      const input = this.boardToInput(board);
      const tensor = new ort.Tensor('float32', input, [1, 896]);
      const output = await this.model.run({ 'input': tensor });
      const result = output['output'].data[0] as number;
      
      // Cache the result
      this.positionCache.set(fen, result);
      return result;
    } catch (error) {
      console.error('Model evaluation error:', error);
      // Fallback to simple evaluation if model fails
      return this.quickEvaluate(board);
    }
  }

  public async initialize(): Promise<void> {
    if (this.model) return;

    this.initializationStatus = 'loading';
    
    try {
      // Konfigurasi untuk optimasi performa
      const options: ort.InferenceSession.SessionOptions = {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
        executionMode: 'sequential',
        enableCpuMemArena: true,
        enableMemPattern: true,
        enableProfiling: false,
      };

      // Load model dengan progress tracking
      const modelUrl = '/chess_model_quantized.onnx';
      const response = await fetch(modelUrl);
      
      if (!response.ok) throw new Error('Failed to fetch model');
      
      const contentLength = response.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength, 10) : 0;
      let loaded = 0;

      const reader = response.body!.getReader();
      const chunks: Uint8Array[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        chunks.push(value);
        loaded += value.length;
        this.modelLoadingProgress = (loaded / total) * 100;
      }

      const modelData = new Blob(chunks);
      const arrayBuffer = await modelData.arrayBuffer();

      this.model = await ort.InferenceSession.create(
        new Uint8Array(arrayBuffer),
        options
      );

      this.initializationStatus = 'ready';
      this.modelLoadingProgress = 100;
      console.log('Chess AI model loaded successfully');
      
    } catch (error) {
      console.error('Error loading model:', error);
      this.initializationStatus = 'error';
      throw error;
    }
  }

  public async findBestMove(game: Chess): Promise<string> {
    // Check opening book first
    const fen = game.fen();
    if (this.openingBook.has(fen)) {
      const bookMove = this.openingBook.get(fen)!;
      // Validasi move dari opening book
      try {
        const validMove = game.move({
          from: bookMove.slice(0, 2),
          to: bookMove.slice(2, 4),
          promotion: bookMove.length > 4 ? bookMove[4] : undefined
        });
        if (validMove) {
          game.undo();
          return bookMove;
        }
        return ''; // Return empty string if move is invalid
      } catch (error) {
        console.warn('Invalid opening book move:', bookMove, error);
      }
    }

    // Get all legal moves
    const moves = game.moves({ verbose: true });
    if (moves.length === 0) return '';

    let bestMove: Move | null = null;
    let bestScore = -Infinity;
    
    // Gunakan Promise.race untuk membatasi waktu berpikir
    const timeoutPromise = new Promise<string>((_, reject) => {
      setTimeout(() => reject('timeout'), 3000);
    });

    try {
      const movePromise = (async () => {
        for (const move of moves) {
          game.move(move);
          const score = await this.alphaBeta(game, this.maxDepth - 1, -Infinity, Infinity, false);
          game.undo();

          if (score > bestScore) {
            bestScore = score;
            bestMove = move;
          }
        }

        if (!bestMove) return '';

        // Return the move in correct format
        return `${bestMove.from}${bestMove.to}${bestMove.promotion || ''}`;
      })();

      return await Promise.race([movePromise, timeoutPromise]);
    } catch (error) {
      if (error === 'timeout') {
        // Use simple evaluation for timeout case
        bestMove = await this.findSimpleMoveVerbose(game);
        return bestMove ? `${bestMove.from}${bestMove.to}${bestMove.promotion || ''}` : '';
      }
      throw error;
    }
  }

  private async findSimpleMoveVerbose(game: Chess): Promise<Move | null> {
    const moves = game.moves({ verbose: true });
    if (moves.length === 0) return null;

    let bestMove = moves[0];
    let bestScore = -Infinity;

    for (const move of moves) {
      game.move(move);
      const score = this.quickEvaluate(game);
      game.undo();

      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }

    return bestMove;
  }

  private isEndgame(game: Chess): boolean {
    const pieces = game.board().flat().filter(p => p);
    return pieces.length <= 10; // Jika sisa bidak <= 10, anggap endgame
  }

  private findSimpleMove(game: Chess): string {
    const moves = game.moves({ verbose: true });
    if (moves.length === 0) return '';

    // Evaluasi sederhana untuk gerakan cepat
    let bestMove = moves[0];
    let bestScore = -Infinity;

    for (const move of moves) {
      game.move(move);
      const score = this.quickEvaluate(game);
      game.undo();

      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }

    return `${bestMove.from}${bestMove.to}`;
  }

  private quickEvaluate(board: Chess): number {
    if (board.isCheckmate()) return -10000;
    if (board.isDraw()) return 0;

    const pieceValues = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };
    let score = 0;

    // Material score
    board.board().forEach(row => {
      row?.forEach(piece => {
        if (piece) {
          const value = pieceValues[piece.type.toLowerCase() as keyof typeof pieceValues];
          score += piece.color === 'w' ? value : -value;
        }
      });
    });

    // Mobility bonus
    score += board.moves().length * 10;

    // Center control bonus
    ['e4', 'd4', 'e5', 'd5'].forEach(square => {
      const piece = board.get(square as Square);
      if (piece) {
        score += piece.color === 'w' ? 30 : -30;
      }
    });

    // King safety
    const kings = this.findKings(board);
    if (kings.white) {
      score += this.evaluateKingSafety(board, kings.white, 'w') * 50;
    }
    if (kings.black) {
      score -= this.evaluateKingSafety(board, kings.black, 'b') * 50;
    }

    return score;
  }


  private async alphaBeta(
    game: Chess,
    depth: number,
    alpha: number,
    beta: number,
    maximizing: boolean
  ): Promise<number> {
    if (depth === 0) {
      return this.quickEvaluate(game);
    }

    const moves = game.moves({ verbose: true });
    
    if (moves.length === 0) {
      if (game.isCheckmate()) {
        return maximizing ? -10000 : 10000;
      }
      return 0; // Draw
    }

    if (maximizing) {
      let value = -Infinity;
      for (const move of moves) {
        game.move(move);
        value = Math.max(value, await this.alphaBeta(game, depth - 1, alpha, beta, false));
        game.undo();
        alpha = Math.max(alpha, value);
        if (beta <= alpha) break;
      }
      return value;
    } else {
      let value = Infinity;
      for (const move of moves) {
        game.move(move);
        value = Math.min(value, await this.alphaBeta(game, depth - 1, alpha, beta, true));
        game.undo();
        beta = Math.min(beta, value);
        if (beta <= alpha) break;
      }
      return value;
    }
  }

  // Method untuk cleanup
  public dispose() {
    this.model = null;
    this.positionCache.clear();
    this.initializationStatus = 'idle';
    this.modelLoadingProgress = 0;
  }
}