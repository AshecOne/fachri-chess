import { Chess, Square, Move } from "chess.js";
import * as ort from "onnxruntime-web";
import { getModelUrl } from "./utils";

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

  private boardToInput(board: Chess): Float32Array {
    const input = new Float32Array(896);
    const pieces = "PNBRQKpnbrqk";

    // Basic piece positions (768)
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        const square = (String.fromCharCode(97 + j) + (8 - i)) as Square;
        const piece = board.get(square);
        if (piece) {
          const pieceIndex = pieces.indexOf(
            piece.type + (piece.color === "w" ? "" : piece.type.toLowerCase())
          );
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
    for (const piece of "PNBRQKpnbrqk") {
      input[featureIdx++] = counts[piece] || 0;
    }

    // Center control
    const centerSquares = ["e4", "d4", "e5", "d5"];
    let whiteCenterControl = 0;
    let blackCenterControl = 0;

    for (const square of centerSquares) {
      if (board.get(square as Square)) {
        if (board.get(square as Square)?.color === "w") whiteCenterControl++;
        else blackCenterControl++;
      }
    }

    input[featureIdx++] = whiteCenterControl;
    input[featureIdx++] = blackCenterControl;

    // King safety (distance of enemy pieces from king)
    const kings = this.findKings(board);
    input[featureIdx++] = this.evaluateKingSafety(board, kings.white, "w");
    input[featureIdx++] = this.evaluateKingSafety(board, kings.black, "b");

    return input;
  }

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
    if (this.model) return;

    this.initializationStatus = "loading";

    try {
      // Temporary fallback - skip model loading if it fails
      console.log('Attempting to load ONNX model...');
      // Konfigurasi untuk optimasi performa
      const options: ort.InferenceSession.SessionOptions = {
        executionProviders: ["wasm"],
        graphOptimizationLevel: "all",
        executionMode: "sequential",
        enableCpuMemArena: true,
        enableMemPattern: true,
        enableProfiling: false,
      };

      // Get model URL using utility function
      const modelUrl = getModelUrl();
      const response = await fetch(modelUrl);

      if (!response.ok) throw new Error("Failed to fetch model");

      const contentLength = response.headers.get("content-length");
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

      this.initializationStatus = "ready";
      this.modelLoadingProgress = 100;
    } catch (error) {
      console.error("Error loading model:", error);
      console.log("Falling back to simple AI without ONNX model");
      this.initializationStatus = "ready"; // Mark as ready even without model
      this.modelLoadingProgress = 100;
      // Don't throw error, just continue without model
    }
  }

  public async findBestMove(game: Chess): Promise<string> {
    // Cek opening book dulu
    const bookMove = this.getOpeningBookMove(game);
    if (bookMove) {
      // Tambahkan variasi dalam opening
      const shouldUseBook = Math.random() > 0.2; // 80% chance menggunakan opening book
      if (shouldUseBook) return bookMove;
    }

    const moves = game.moves({ verbose: true });
    if (moves.length === 0) return "";

    const topMoves: { move: Move; score: number }[] = [];
    const isWhite = game.turn() === "w";

    // Evaluate semua gerakan yang mungkin
    for (const move of moves) {
      game.move(move);
      const score = await this.evaluatePosition(game);
      game.undo();

      const adjustedScore = isWhite ? score : -score;
      topMoves.push({ move, score: adjustedScore });
    }

    // Sort dan ambil beberapa gerakan terbaik
    topMoves.sort((a, b) => b.score - a.score);
    const topN = Math.min(3, topMoves.length); // Ambil 3 gerakan terbaik

    // Pilih secara random dari top moves dengan weighted probability
    const randomIndex = this.weightedRandomIndex(topN);
    const selectedMove = topMoves[randomIndex].move;

    return `${selectedMove.from}${selectedMove.to}`;
  }

  private weightedRandomIndex(n: number): number {
    // Berikan bobot lebih tinggi untuk moves yang lebih baik
    const weights = Array(n)
      .fill(0)
      .map((_, i) => 1 / (i + 1));
    const totalWeight = weights.reduce((a, b) => a + b, 0);

    let random = Math.random() * totalWeight;
    for (let i = 0; i < weights.length; i++) {
      random -= weights[i];
      if (random <= 0) return i;
    }
    return 0;
  }

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

  private async evaluatePosition(board: Chess): Promise<number> {
    if (!this.model) {
      await this.initPromise;
      if (!this.model) {
        // Fallback to quick evaluation if model not available
        console.log("Using fallback evaluation (no ONNX model)");
        return this.quickEvaluate(board);
      }
    }

    // Cek cache dulu
    const fen = board.fen();
    if (this.positionCache.has(fen)) {
      return this.positionCache.get(fen)!;
    }

    const input = this.boardToInput(board);
    const tensor = new ort.Tensor("float32", input, [1, 896]);

    try {
      const output = await this.model.run({ input: tensor });
      let score = output["output"].data[0] as number;

      // Tambahkan sedikit noise untuk variasi
      const noise = (Math.random() - 0.5) * 0.1; // ±5% variasi
      score = score * (1 + noise);

      // Invert score if playing as black
      if (board.turn() === "b") {
        score = -score;
      }

      // Cache the result
      this.positionCache.set(fen, score);

      return score;
    } catch (error) {
      console.error("Evaluation error:", error);
      return 0;
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
