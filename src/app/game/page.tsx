'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Chess } from 'chess.js'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import ColorSelectionModal from '@/components/ColorSelectionModal'
import { ChessAI } from '@/lib/chess-ai'
import { ChatService } from '@/services/chat-service';

const ChessboardComponent = dynamic(
  () => import('react-chessboard').then((mod) => mod.Chessboard),
  { ssr: false }
);

export default function GamePage() {
  const router = useRouter();
  const [game, setGame] = useState(new Chess());
  const [playerInfo, setPlayerInfo] = useState<{ name: string; gender: string } | null>(null);
  const [playerColor, setPlayerColor] = useState<'White' | 'Black' | null>(null);
  const [showColorModal, setShowColorModal] = useState(false);
  const [messages, setMessages] = useState<{ text: string; sender: 'ai' | 'player'; }[]>([]);
  const [ai] = useState(new ChessAI());
  const [isAIThinking, setIsAIThinking] = useState(false);
  const [isAIReady, setIsAIReady] = useState(false);
  const [modelLoadingStatus, setModelLoadingStatus] = useState<{
    status: string;
    progress: number;
  }>({ status: 'idle', progress: 0 });
  const [gameStatus, setGameStatus] = useState<'playing' | 'over' | null>(null);
  const [winner, setWinner] = useState<string | null>(null);
  const [chatService] = useState(() => new ChatService());
  const [gameSituation, setGameSituation] = useState<'normal' | 'advantage' | 'disadvantage' | 'check' | 'winning' | 'losing' | 'draw'>('normal');

  useEffect(() => {
    // Cek info player
    const storedInfo = localStorage.getItem('playerInfo');
    if (!storedInfo) {
      router.push('/');
      return;
    }
    
    // Set player info
    const playerData = JSON.parse(storedInfo);
    setPlayerInfo(playerData);
    
    // Cek apakah sudah ada pilihan warna sebelumnya
    const storedColor = localStorage.getItem('playerColor');
    if (storedColor) {
      // Jika sudah ada pilihan warna, gunakan itu
      setPlayerColor(storedColor as 'White' | 'Black');
      // Set pesan sesuai warna yang tersimpan
      setMessages([{
        text: `Welcome back ${playerData.name}! You're playing as ${storedColor}.`,
        sender: 'ai'
      }]);
    } else {
      // Jika belum ada pilihan warna, tampilkan modal
      setShowColorModal(true);
      setMessages([{
        text: `Welcome ${playerData.name}! I'm excited to play chess with you. Choose your preferred color to start the game!`,
        sender: 'ai'
      }]);
    }
  }, [router]);

  useEffect(() => {
    // Load saved game state if exists
    const savedGameState = localStorage.getItem('gameState');
    if (savedGameState) {
      const chess = new Chess();
      try {
        chess.loadPgn(savedGameState);
        setGame(chess);
      } catch (e) {
        console.error('Error loading saved game:', e);
      }
    }
  }, []);

  // Update game situation when board changes
  useEffect(() => {
    const updateGameSituation = () => {
      if (game.isGameOver()) {
        if (game.isDraw()) return setGameSituation('draw');
        // Determine if we're winning or losing
        const loserColor = game.turn();
        if ((playerColor === 'White' && loserColor === 'b') || 
            (playerColor === 'Black' && loserColor === 'w')) {
          setGameSituation('winning');
        } else {
          setGameSituation('losing');
        }
        return;
      }

      if (game.isCheck()) {
        setGameSituation('check');
        return;
      }

      // Simple material advantage check
      const evaluation = evaluatePosition(game);
      if (evaluation > 2) {
        setGameSituation(playerColor === 'White' ? 'advantage' : 'disadvantage');
      } else if (evaluation < -2) {
        setGameSituation(playerColor === 'White' ? 'disadvantage' : 'advantage');
      } else {
        setGameSituation('normal');
      }
    };

    updateGameSituation();
  }, [game, playerColor]);

  useEffect(() => {
    const handleGameSituationMessage = async () => {
      const message = await chatService.generateResponse(null, gameSituation);
      if (message) { // Only add if response is not null
        setMessages(prev => [...prev, {
          text: message,
          sender: 'ai'
        }]);
      }
    };
  
    if (gameSituation !== 'normal') {
      handleGameSituationMessage();
    }
  }, [gameSituation, chatService]);

  // Update chat form submission
  const handleChatSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const input = form.elements.namedItem('message') as HTMLInputElement;
    const message = input.value.trim();
  
    if (message) {
      // Tambahkan pesan player
      setMessages(prev => [...prev, {
        text: message,
        sender: 'player'
      }]);
      input.value = ''; // Clear input
  
      // Dapatkan respons dari AI
      const response = await chatService.generateResponse(message);
      if (response) {
        // Tambah delay untuk efek natural
        setTimeout(() => {
          setMessages(prev => [...prev, {
            text: response,
            sender: 'ai'
          }]);
        }, 500);
      }
    }
  };

  // Helper function to evaluate board position
  const evaluatePosition = (board: Chess): number => {
    const pieceValues = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
    let score = 0;

    board.board().forEach(row => {
      row?.forEach(piece => {
        if (piece) {
          const value = pieceValues[piece.type.toLowerCase() as keyof typeof pieceValues];
          score += piece.color === 'w' ? value : -value;
        }
      });
    });

    return score;
  };

  // Add to existing useEffect for game status
useEffect(() => {
  const checkGameStatus = () => {
    if (game.isGameOver()) {
      setGameStatus('over');
      if (game.isCheckmate()) {
        const loserColor = game.turn();
        const winnerName = loserColor === 'w' ? 
          (playerColor === 'Black' ? playerInfo?.name : 'Daffa') :
          (playerColor === 'White' ? playerInfo?.name : 'Daffa');
        setWinner(winnerName || null);
        
        // Add end game message
        const gameOverMessage = winner === 'Daffa' ?
          "Haha, menang kalah ga penting sih sebenernya. Yang penting prosesnya. Mau main lagi ga?" :
          "Nice game! Kayak Sisyphus ya, kita bisa mulai lagi dari awal kalo mau.";
        setMessages(prev => [...prev, {
          text: gameOverMessage,
          sender: 'ai'
        }]);
      }
    }
  };

  checkGameStatus();
}, [game, playerColor, playerInfo, winner]);

useEffect(() => {
  let intervalId: NodeJS.Timeout;
  
  const initGame = async () => {
    setModelLoadingStatus({ status: 'loading', progress: 0 });
    
    // Simulasi loading progress yang lebih smooth
    let progress = 0;
    intervalId = setInterval(() => {
      progress += 2; // Lebih pelan
      if (progress <= 90) { // Hanya sampai 90% untuk simulasi
        setModelLoadingStatus(prev => ({
          ...prev,
          progress: progress
        }));
      }
    }, 50); // Interval lebih cepat

    try {
      await ai.initialize();
      setIsAIReady(true);
      // Set langsung ke 100% setelah benar-benar selesai
      setModelLoadingStatus({ status: 'ready', progress: 100 });
    } catch (error) {
      console.error('Failed to initialize AI:', error);
      setModelLoadingStatus({ status: 'error', progress: 0 });
    } finally {
      clearInterval(intervalId);
    }
  };

  initGame();
  
  return () => {
    if (intervalId) clearInterval(intervalId);
  };
}, [ai]);

  // Game over actions
  const handlePlayAgain = () => {
    setGame(new Chess());
    setGameStatus('playing');
    setWinner(null);
    localStorage.removeItem('gameState');
    setShowColorModal(true);
  };

  const handleQuit = () => {
    // Clear all game-related data from localStorage
    localStorage.removeItem('gameState');
    localStorage.removeItem('playerColor');
    localStorage.removeItem('playerInfo');
    router.push('/');
  };

const handleColorSelect = (color: 'White' | 'Black' | 'random') => {
    const selectedColor = color === 'random' 
      ? Math.random() > 0.5 ? 'White' : 'Black'
      : color;
    
    localStorage.setItem('playerColor', selectedColor);
    setPlayerColor(selectedColor);
    setShowColorModal(false);
  
    setMessages(prev => [...prev, {
      text: `You'll be playing as ${selectedColor}. ${selectedColor === 'White' ? 'Make your move!' : 'I\'ll start the game.'}`,
      sender: 'ai'
    }]);
  
    // Jika player memilih hitam, AI (putih) mulai duluan
    if (selectedColor === 'Black') {
      setTimeout(() => {
        makeAIMove();
      }, 1000);
    }
  };

  const handleMove = (from: string, to: string) => {
    try {
      if (
        (playerColor === 'White' && game.turn() === 'b') ||
        (playerColor === 'Black' && game.turn() === 'w')
      ) {
        return false;
      }
  
      const move = game.move({
        from,
        to,
        promotion: 'q',
      });
  
      if (move) {
        const newGame = new Chess(game.fen());
        setGame(newGame);
        localStorage.setItem('gameState', newGame.pgn());
  
        // AI membuat gerakan setelah pemain
        setTimeout(() => {
          makeAIMove();
        }, 500);
  
        return true;
      }
    } catch (error) {
      console.error('Move error:', error);
    }
    return false;
  };

  const makeAIMove = async () => {
    if (!isAIReady) return;
    setIsAIThinking(true);
    try {
      const moveString = await ai.findBestMove(game);
      if (moveString && moveString.length >= 4) {
        const from = moveString.slice(0, 2);
        const to = moveString.slice(2, 4);
        const promotion = moveString.length > 4 ? moveString[4] : undefined;
        
        try {
          const move = game.move({
            from,
            to,
            promotion
          });
  
          if (move) {
            const newGame = new Chess(game.fen());
            setGame(newGame);
            localStorage.setItem('gameState', newGame.pgn());
          }
        } catch (moveError) {
          console.error('Invalid move:', moveString, moveError);
          // Fallback: Make a random legal move
          const legalMoves = game.moves({ verbose: true });
          if (legalMoves.length > 0) {
            const randomMove = legalMoves[Math.floor(Math.random() * legalMoves.length)];
            game.move(randomMove);
            const newGame = new Chess(game.fen());
            setGame(newGame);
            localStorage.setItem('gameState', newGame.pgn());
          }
        }
      }
    } catch (error) {
      console.error('AI move error:', error);
    } finally {
      setIsAIThinking(false);
    }
  };

// Update renderLoadingState
const renderLoadingState = () => {
  if (modelLoadingStatus.status === 'loading' || isAIThinking) { // Tambah isAIThinking
    return (
      <div className="fixed top-0 left-0 right-0 bg-blue-500 h-1">
        <div 
          className="bg-blue-600 h-full transition-all duration-300"
          style={{ width: isAIThinking ? '100%' : `${modelLoadingStatus.progress}%` }}
        />
      </div>
    );
  }
  return null;
};

return (
  <div className="min-h-screen bg-gray-100 p-4">
    <div className="max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-800 mb-6 text-center lg:text-left">
        Fun Chess with Fachri
      </h1>

      {/* Loading Progress Bar */}
      {renderLoadingState()}

      {/* Loading Overlay */}
      {modelLoadingStatus.status === 'loading' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-80">
            <h3 className="text-lg font-semibold mb-2">Loading Chess AI</h3>
            <p className="text-gray-600 mb-4">
              Initializing game... {modelLoadingStatus.progress.toFixed(0)}%
            </p>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div 
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${modelLoadingStatus.progress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Chess Board and Players Section */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-lg p-4">
            {/* Game Area */}
            <div className="flex flex-col lg:flex-row gap-8">
              {/* Chess Board */}
              <div className="flex-1 flex justify-center lg:justify-start">
                <ChessboardComponent 
                  position={game.fen()}
                  boardOrientation={playerColor === 'Black' ? 'black' : 'white'}
                  onPieceDrop={(sourceSquare: string, targetSquare: string) => {
                    handleMove(sourceSquare, targetSquare);
                    return true;
                  }}
                  boardWidth={Math.min(600, typeof window !== 'undefined' ? window.innerWidth - 80 : 600)}
                />
              </div>

              {/* Desktop Players Info */}
              <div className="hidden lg:flex w-48 flex-col items-center justify-center space-y-6">
                {/* AI Player */}
                <div className="text-center">
                  <div className="relative w-24 h-24 mx-auto mb-2">
                    <Image
                      src="https://ashecone.github.io/fachri-chess/fachri.jpg"
                      alt="Fachri"
                      sizes="96px"
                      priority
                      fill
                      className="rounded-full object-cover"
                    />
                  </div>
                  <p className="font-semibold text-gray-800">Daffa</p>
                  <p className="text-sm text-gray-600">
                    {playerColor === 'White' ? 'Black' : 'White'} Pieces
                  </p>
                </div>

                <div className="text-2xl font-bold text-gray-600">VS</div>

                {/* Human Player */}
                <div className="text-center">
                  <div className="text-4xl mb-2">
                    {playerInfo?.gender === 'male' ? '👨' : '👩'}
                  </div>
                  <p className="font-semibold text-gray-800">{playerInfo?.name}</p>
                  <p className="text-sm text-gray-600">{playerColor || 'Select'} Pieces</p>
                </div>
              </div>
            </div>

            {/* Mobile Players Info */}
            <div className="lg:hidden mt-6">
              <div className="flex items-center justify-center gap-8">
                {/* Mobile Human Player */}
                <div className="text-center">
                  <div className="text-4xl mb-2">
                    {playerInfo?.gender === 'male' ? '👨' : '👩'}
                  </div>
                  <p className="font-semibold text-gray-800">{playerInfo?.name}</p>
                  <p className="text-sm text-gray-600">{playerColor || 'Select'} Pieces</p>
                </div>

                <div className="text-2xl font-bold text-gray-600 px-4">VS</div>

                {/* Mobile AI Player */}
                <div className="text-center">
                  <div className="relative w-16 h-16 mx-auto mb-2">
                    <Image
                      src="/fachri.jpg"
                      alt="Fachri"
                      sizes="64px"
                      priority
                      fill
                      className="rounded-full object-cover"
                    />
                  </div>
                  <p className="font-semibold text-gray-800">Daffa</p>
                  <p className="text-sm text-gray-600">
                    {playerColor === 'White' ? 'Black' : 'White'} Pieces
                  </p>
                </div>
              </div>
            </div>

            {/* Game Status */}
            <div className="text-center mt-4">
              <p className="text-sm text-gray-600">
                {gameStatus === 'over' 
                  ? (winner ? `${winner} wins!` : "Game Over - It's a draw!") 
                  : isAIThinking 
                    ? "AI is thinking..." 
                    : `Current turn: ${game.turn() === 'w' ? 'White' : 'Black'}`
                }
              </p>

              {/* Game Over Actions */}
              {gameStatus === 'over' && (
                <div className="mt-4 space-x-4">
                  <button 
                    onClick={handlePlayAgain}
                    className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
                  >
                    Play Again
                  </button>
                  <button 
                    onClick={handleQuit}
                    className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
                  >
                    Quit
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Chat Section */}
        <div className="bg-white h-[475px] rounded-lg shadow-lg p-4">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Chat with Fachri</h2>
          <div className="h-[400px] flex flex-col">
            <div className="flex-1 overflow-y-auto space-y-4 mb-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg ${
                    message.sender === 'ai'
                      ? 'bg-blue-100 ml-4'
                      : 'bg-green-100 mr-4'
                  }`}
                >
                  {message.text}
                </div>
              ))}
            </div>

            {/* Chat Input */}
            <div className="border-t pt-4">
            <form 
  onSubmit={handleChatSubmit}
  className="flex gap-2"
>
  <input
    type="text"
    name="message"
    placeholder="Type a message..."
    className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
  />
  <button
    type="submit"
    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
  >
    Send
  </button>
</form>
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* Color Selection Modal */}
    <ColorSelectionModal 
      isOpen={showColorModal}
      onSelect={handleColorSelect}
    />
  </div>
);
}