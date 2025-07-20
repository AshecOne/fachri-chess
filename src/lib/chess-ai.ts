import { Chess, Square, Move } from "chess.js";
import * as ort from "onnxruntime-web";
// import { getModelUrl } from "./utils";

declare module "onnxruntime-web" {
  interface WasmPaths {
    "ort-wasm.wasm": string;
    "ort-wasm-simd.wasm": string;
    "ort-wasm-threaded.wasm": string;
  }
}

// Set path untuk file WASM
if (typeof window !== "undefined") {
  ort.env.wasm.numThreads = 4;
  ort.env.wasm.simd = true;
  const wasmPaths = {
    "ort-wasm.wasm": "/onnx/ort-wasm.wasm",
    "ort-wasm-simd.wasm": "/onnx/ort-wasm-simd.wasm",
    "ort-wasm-threaded.wasm": "/onnx/ort-wasm-threaded.wasm",
  };
  Object.assign(ort.env.wasm, { wasmPaths });
}

// Definisikan tipe status
type AIStatus = "idle" | "loading" | "ready" | "error";

export class ChessAI {
  private model: ort.InferenceSession | null = null;
  private positionCache: Map<string, number> = new Map();
  private openingBook: Map<string, string>;
  private initializationStatus: AIStatus = "idle";
  private modelLoadingProgress: number = 0;
  private maxDepth = 3;
  private initPromise: Promise<void>;

  constructor() {
    // Initialize opening book in constructor
    this.openingBook = new Map<string, string>([
      // King's Pawn Opening
      ["rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", "e7e5"],
      ["rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2", "Nf3"],
      ["rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2", "Nc6"],
      [
        "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3",
        "Bb5",
      ],

      // Sicilian Defense
      ["rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", "c7c5"],
      ["rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2", "Nf3"],
      [
        "rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2",
        "d7d6",
      ],

      // French Defense
      ["rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", "e7e6"],
      ["rnbqkbnr/pppp1ppp/4p3/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2", "d4"],
      ["rnbqkbnr/pppp1ppp/4p3/8/3PP3/8/PPP2PPP/RNBQKBNR b KQkq - 0 2", "d5"],

      // Queen's Gambit
      ["rnbqkbnr/pppppppp/8/8/2P5/8/PP1PPPPP/RNBQKBNR b KQkq - 0 1", "d7d5"],
      ["rnbqkbnr/ppp1pppp/8/3p4/2P5/8/PP1PPPPP/RNBQKBNR w KQkq - 0 2", "d4"],
      ["rnbqkbnr/ppp1pppp/8/3p4/2PPP3/8/PP3PPP/RNBQKBNR b KQkq - 0 2", "e6"],

      // Nimzo-Indian Defense
      ["rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b KQkq - 0 1", "Nf6"],
      ["rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R w KQkq - 1 1", "c4"],
      ["rnbqkbnr/pppppppp/8/8/2P5/5N2/PP1PPPPP/RNBQKB1R b KQkq - 1 2", "e6"],
      ["rnbqkbnr/pppp1ppp/4p3/8/2P5/5N2/PP1PPPPP/RNBQKB1R w KQkq - 2 3", "Nc3"],
      [
        "rnbqkbnr/pppp1ppp/4p3/8/2P5/2N2N2/PP1PPPPP/R1BQKB1R b KQkq - 2 3",
        "Bb4",
      ],

      // Caro-Kann Defense
      ["rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", "c7c6"],
      ["rnbqkbnr/pp1ppppp/2p5/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2", "d4"],
      ["rnbqkbnr/pp1ppppp/2p5/8/3PP3/8/PPP2PPP/RNBQKBNR b KQkq - 0 2", "d5"],
      ["rnbqkbnr/pp2pppp/2p5/3p4/3PP3/8/PPP2PPP/RNBQKBNR w KQkq - 0 3", "Nc3"],
    ]);
    this.initialize();
    this.initPromise = this.initialize();
  }

  public getInitializationStatus(): { status: AIStatus; progress: number } {
    return {
      status: this.initializationStatus,
      progress: this.modelLoadingProgress,
    };
  }

  // This method is no longer needed as we use backend API

  private countAllPieces(board: Chess): { [key: string]: number } {
    const counts: { [key: string]: number } = {};
    board.board().forEach((row) => {
      row?.forEach((piece) => {
        if (piece) {
          const key =
            piece.color === "w"
              ? piece.type.toUpperCase()
              : piece.type.toLowerCase();
          counts[key] = (counts[key] || 0) + 1;
        }
      });
    });
    return counts;
  }

  private findKings(board: Chess): {
    white: Square | null;
    black: Square | null;
  } {
    let white: Square | null = null;
    let black: Square | null = null;

    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        const square = (String.fromCharCode(97 + j) + (8 - i)) as Square;
        const piece = board.get(square);
        if (piece && piece.type === "k") {
          if (piece.color === "w") white = square;
          else black = square;
        }
      }
    }

    return { white, black };
  }

  private evaluateKingSafety(
    board: Chess,
    kingSquare: Square | null,
    color: "w" | "b"
  ): number {
    if (!kingSquare) return 0;

    let safety = 0;
    const enemyColor = color === "w" ? "b" : "w";
    const moves = board.moves({ verbose: true, square: kingSquare });

    // King mobility
    safety += moves.length;

    // Pawn shield
    const rank = color === "w" ? "2" : "7";
    const pawnShieldSquares = ["f", "g", "h"].map((file) => file + rank);
    for (const square of pawnShieldSquares) {
      const piece = board.get(square as Square);
      if (piece && piece.type === "p" && piece.color === color) {
        safety += 2;
      }
    }

    // Enemy pieces attacking near king
    const attackingMoves = board.moves({ verbose: true, square: kingSquare });
    const attackers = attackingMoves.filter((move) => {
      const piece = board.get(move.to as Square);
      return piece && piece.color === enemyColor;
    });

    safety -= attackers.length * 2;

    return safety;
  }

  public async initialize(): Promise<void> {
    this.initializationStatus = "loading";

    try {
      // Check if backend API is available
      console.log('Connecting to Chess AI backend...');
      const response = await fetch('https://nw-clarke-situations-villages.trycloudflare.com/api/health');
      
      if (!response.ok) {
        throw new Error(`Backend API not available: ${response.status}`);
      }
      
      const health = await response.json();
      console.log('Backend API status:', health);
      
      if (health.model !== 'loaded') {
        throw new Error('Backend model not loaded');
      }
      
      this.initializationStatus = "ready";
      this.modelLoadingProgress = 100;
      console.log('Chess AI backend connected successfully!');
    } catch (error) {
      console.error("Error connecting to backend:", error);
      this.initializationStatus = "error";
      this.modelLoadingProgress = 0;
      throw new Error('Chess AI backend unavailable. Please ensure the backend service is running.');
    }
  }

  public async findBestMove(game: Chess): Promise<string> {
    try {
      // Call backend API for best move
      const response = await fetch('https://nw-clarke-situations-villages.trycloudflare.com/api/move', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fen: game.fen() }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      return data.move;
    } catch (error) {
      console.error('Error calling chess API:', error);
      throw new Error('Chess AI service unavailable');
    }
  }

  // This method is no longer needed as we use backend API

  private getOpeningBookMove(game: Chess): string | undefined {
    const fen = game.fen();
    const bookMove = this.openingBook.get(fen);

    if (bookMove) {
      // Handle both coordinate notation (e2e4) and algebraic notation (e4, Nf3, etc)
      if (bookMove.length === 4) {
        // Coordinate notation
        try {
          const move = game.move({
            from: bookMove.substring(0, 2) as Square,
            to: bookMove.substring(2, 4) as Square,
          });
          game.undo();
          if (move) {
            return `${move.from}${move.to}`;
          }
        } catch (e) {
          console.error("Error in coordinate book move:", e);
        }
      } else {
        // Algebraic notation
        try {
          const move = game.move(bookMove);
          game.undo();
          if (move) {
            return `${move.from}${move.to}`;
          }
        } catch (e) {
          console.error("Error in algebraic book move:", e);
        }
      }
    }
    return undefined;
  }

  // This method is no longer needed as we use backend API

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
    const pieces = game
      .board()
      .flat()
      .filter((p) => p);
    return pieces.length <= 10; // Jika sisa bidak <= 10, anggap endgame
  }

  private findSimpleMove(game: Chess): string {
    const moves = game.moves({ verbose: true });
    if (moves.length === 0) return "";

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
    board.board().forEach((row) => {
      row?.forEach((piece) => {
        if (piece) {
          const value =
            pieceValues[piece.type.toLowerCase() as keyof typeof pieceValues];
          score += piece.color === "w" ? value : -value;
        }
      });
    });

    // Mobility bonus
    score += board.moves().length * 10;

    // Center control bonus
    ["e4", "d4", "e5", "d5"].forEach((square) => {
      const piece = board.get(square as Square);
      if (piece) {
        score += piece.color === "w" ? 30 : -30;
      }
    });

    // King safety
    const kings = this.findKings(board);
    if (kings.white) {
      score += this.evaluateKingSafety(board, kings.white, "w") * 50;
    }
    if (kings.black) {
      score -= this.evaluateKingSafety(board, kings.black, "b") * 50;
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
        value = Math.max(
          value,
          await this.alphaBeta(game, depth - 1, alpha, beta, false)
        );
        game.undo();
        alpha = Math.max(alpha, value);
        if (beta <= alpha) break;
      }
      return value;
    } else {
      let value = Infinity;
      for (const move of moves) {
        game.move(move);
        value = Math.min(
          value,
          await this.alphaBeta(game, depth - 1, alpha, beta, true)
        );
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
    this.initializationStatus = "idle";
    this.modelLoadingProgress = 0;
  }
}
