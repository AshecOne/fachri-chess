'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Chess, Square } from 'chess.js'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import ColorSelectionModal from '@/components/ColorSelectionModal'
import PromotionModal from '@/components/PromotionModal'
import { ChessAI } from '@/lib/chess-ai'
import { ChatService } from '@/services/chat-service';
import { getImageUrl } from '@/lib/utils';

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
  const [showPromotionModal, setShowPromotionModal] = useState(false);
  const [pendingMove, setPendingMove] = useState<{from: string, to: string} | null>(null);
  const [isProcessingPromotion, setIsProcessingPromotion] = useState(false);
  const [isAIMakingMove, setIsAIMakingMove] = useState(false);
  const [intendedTarget, setIntendedTarget] = useState<string | null>(null);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [validMoves, setValidMoves] = useState<string[]>([]);
  const [showMoveHints, setShowMoveHints] = useState(true);

  useEffect(() => {
    // Only access localStorage on client side
    if (typeof window === 'undefined') return;
    
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
    // Only access localStorage on client side
    if (typeof window === 'undefined') return;
    
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

  // Handle AI's first move when player chooses Black
  useEffect(() => {
    const handleInitialAIMove = async () => {
      // Only trigger once at the start of a new game
      if (isAIReady && playerColor === 'Black' && game.turn() === 'w' && game.history().length === 0) {
        console.log('Initial AI move: player is Black, making first move as White');
        setTimeout(() => {
          makeAIMove(true);
        }, 1000);
      }
    };

    handleInitialAIMove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAIReady, playerColor]); // game and makeAIMove intentionally excluded to prevent infinite loop

  // Load move hints preference from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const savedPreference = localStorage.getItem('showMoveHints');
    if (savedPreference !== null) {
      setShowMoveHints(JSON.parse(savedPreference));
    }
  }, []);

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
  
    // Fallback: if useEffect doesn't trigger, try manual call
    if (selectedColor === 'Black') {
      setTimeout(() => {
        if (isAIReady && game.turn() === 'w' && game.history().length === 0 && !isAIMakingMove) {
          console.log('Fallback: manually triggering AI first move');
          makeAIMove(true);
        }
      }, 2000);
    }
  };

  const toggleMoveHints = () => {
    const newValue = !showMoveHints;
    setShowMoveHints(newValue);
    
    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('showMoveHints', JSON.stringify(newValue));
    }
    
    console.log('Move hints toggled:', newValue);
  };

  const handleSquareClick = (square: string) => {
    console.log('Square clicked:', square);
    
    // Check if it's player's turn
    const isPlayerTurn = 
      (playerColor === 'White' && game.turn() === 'w') ||
      (playerColor === 'Black' && game.turn() === 'b');
    
    if (!isPlayerTurn) return;

    const piece = game.get(square as Square);
    
    // If no piece is selected yet
    if (!selectedSquare) {
      // Only select if there's a piece on this square and it belongs to the player
      if (piece && 
          ((playerColor === 'White' && piece.color === 'w') ||
           (playerColor === 'Black' && piece.color === 'b'))) {
        setSelectedSquare(square);
        
        // Get valid moves for this piece
        const moves = game.moves({ square: square as Square, verbose: true });
        const moveSquares = moves.map(move => move.to);
        setValidMoves(moveSquares);
        
        console.log('Piece selected:', square, 'Valid moves:', moveSquares);
      }
    } else {
      // A piece is already selected
      if (selectedSquare === square) {
        // Clicking the same square - deselect
        setSelectedSquare(null);
        setValidMoves([]);
        console.log('Piece deselected');
      } else if (piece && 
                 ((playerColor === 'White' && piece.color === 'w') ||
                  (playerColor === 'Black' && piece.color === 'b'))) {
        // Clicking another own piece - select the new piece
        setSelectedSquare(square);
        const moves = game.moves({ square: square as Square, verbose: true });
        const moveSquares = moves.map(move => move.to);
        setValidMoves(moveSquares);
        console.log('New piece selected:', square, 'Valid moves:', moveSquares);
      } else {
        // Clicking a target square - attempt to move
        if (validMoves.includes(square)) {
          console.log('Making move:', selectedSquare, '→', square);
          const moveResult = handleMove(selectedSquare, square);
          if (moveResult) {
            // Move was successful, clear selection
            setSelectedSquare(null);
            setValidMoves([]);
          }
        } else {
          // Invalid move - clear selection
          setSelectedSquare(null);
          setValidMoves([]);
          console.log('Invalid move attempted, clearing selection');
        }
      }
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

      const piece = game.get(from as Square);

      // Check if this could be a promotion move (before validating)
      const couldBePromotion = piece && 
        piece.type === 'p' && 
        ((piece.color === 'w' && to[1] === '8') || (piece.color === 'b' && to[1] === '1'));

      if (couldBePromotion) {
        // Test if the promotion move is actually legal (including captures)
        const testGame = new Chess(game.fen());
        let isLegalPromotionMove = false;
        
        try {
          // Test the move with promotion to validate it's legal
          const testMove = testGame.move({
            from,
            to,
            promotion: 'q', // Test with queen
          });
          isLegalPromotionMove = !!testMove;
          
          // Log promotion attempt for debugging
          console.log('Promotion move test:', {
            from,
            to,
            piece: piece?.type + piece?.color,
            isCapture: !!testMove?.captured,
            isLegal: isLegalPromotionMove
          });
        } catch (error) {
          console.log('Promotion test failed:', error instanceof Error ? error.message : String(error));
          isLegalPromotionMove = false;
        }

        if (isLegalPromotionMove) {
          // Store the move and show promotion modal - don't execute move yet
          setPendingMove({ from, to });
          setShowPromotionModal(true);
          
          console.log('Showing promotion modal for move:', { from, to });
          
          // Return false to prevent react-chessboard from updating visually
          // We'll handle the visual update after user selects promotion piece
          return false;
        }
      }

      // Normal move without promotion
      const move = game.move({
        from,
        to,
      });
  
      if (move) {
        // Create a new game instance with the updated state
        const newGame = new Chess(game.fen());
        setGame(newGame);
        if (typeof window !== 'undefined') {
          localStorage.setItem('gameState', newGame.pgn());
        }
  
        // AI membuat gerakan setelah pemain
        setTimeout(() => {
          if (!isAIMakingMove) {
            makeAIMove();
          }
        }, 500);
  
        return true;
      }
    } catch (error) {
      console.error('Move error:', error);
    }
    return false;
  };

  const handlePromotionSelect = (promotionPiece: 'q' | 'r' | 'b' | 'n') => {
    if (!pendingMove || isProcessingPromotion) {
      console.error('No pending move for promotion or already processing');
      return;
    }
    
    setIsProcessingPromotion(true);

    console.log('Executing promotion:', {
      from: pendingMove.from,
      to: pendingMove.to,
      piece: promotionPiece,
      currentTurn: game.turn(),
      gameState: game.fen()
    });

    try {
      // Execute promotion move directly on the current game instance
      const move = game.move({
        from: pendingMove.from,
        to: pendingMove.to,
        promotion: promotionPiece,
      });

      if (move) {
        console.log('Promotion successful:', move);
        
        // Create new game instance to trigger re-render
        const newGame = new Chess(game.fen());
        setGame(newGame);
        
        if (typeof window !== 'undefined') {
          localStorage.setItem('gameState', newGame.pgn());
        }

        // Clear promotion state
        setShowPromotionModal(false);
        setPendingMove(null);
        setIsProcessingPromotion(false);

        console.log('New game state after promotion:', {
          fen: newGame.fen(),
          turn: newGame.turn(),
          isGameOver: newGame.isGameOver()
        });

        // AI makes move after player
        setTimeout(() => {
          if (!isAIMakingMove) {
            makeAIMove();
          }
        }, 500);
      } else {
        // If promotion failed, reset states
        console.error('Promotion move failed - move returned null');
        setShowPromotionModal(false);
        setPendingMove(null);
        setIsProcessingPromotion(false);
      }
    } catch (error) {
      console.error('Promotion error:', error);
      console.error('Error details:', {
        pendingMove,
        promotionPiece,
        gameState: game.fen()
      });
      // Reset promotion state on error
      setShowPromotionModal(false);
      setPendingMove(null);
      setIsProcessingPromotion(false);
    }
  };

  const makeAIMove = async (forceMove = false) => {
    if (!isAIReady || isAIMakingMove) return;
    
    // Check if it's actually AI's turn
    const isAITurn = 
      (playerColor === 'White' && game.turn() === 'b') ||
      (playerColor === 'Black' && game.turn() === 'w');
    
    console.log('makeAIMove debug:', {
      playerColor,
      gameTurn: game.turn(),
      isAITurn,
      isAIReady,
      isAIMakingMove,
      forceMove
    });
    
    // For initial move when player chooses Black, we need to check differently
    if (!forceMove && !isAITurn) {
      console.warn('makeAIMove called but it\'s not AI\'s turn');
      return;
    }
    
    // Special case: if player is Black and it's white's turn at start of game
    if (forceMove && playerColor === 'Black' && game.turn() === 'w') {
      console.log('Forcing AI first move as White (player is Black)');
    }
    
    setIsAIMakingMove(true);
    
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
            if (typeof window !== 'undefined') {
              localStorage.setItem('gameState', newGame.pgn());
            }
            
            // Clear selection after AI move
            setSelectedSquare(null);
            setValidMoves([]);
          }
        } catch (moveError) {
          console.error('Invalid AI move:', moveString, moveError);
          // Fallback: Make a random legal move
          const legalMoves = game.moves({ verbose: true });
          if (legalMoves.length > 0) {
            const randomMove = legalMoves[Math.floor(Math.random() * legalMoves.length)];
            const fallbackMove = game.move(randomMove);
            if (fallbackMove) {
              const newGame = new Chess(game.fen());
              setGame(newGame);
              if (typeof window !== 'undefined') {
                localStorage.setItem('gameState', newGame.pgn());
              }
              
              // Clear selection after AI move
              setSelectedSquare(null);
              setValidMoves([]);
            }
          }
        }
      }
    } catch (error) {
      console.error('AI move error:', error);
    } finally {
      setIsAIThinking(false);
      setIsAIMakingMove(false);
    }
  };

// Update renderLoadingState
const renderLoadingState = () => {
  // Loading indicator removed - no more blue bar
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

      {/* Loading overlay removed - no more blue loading indicators */}

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
                  onSquareClick={handleSquareClick}
                  onPieceDrop={(sourceSquare: string, targetSquare: string) => {
                    console.log('onPieceDrop called:', { sourceSquare, targetSquare });
                    setIntendedTarget(targetSquare); // Store where user intended to drop
                    // Clear selection when using drag
                    setSelectedSquare(null);
                    setValidMoves([]);
                    return handleMove(sourceSquare, targetSquare);
                  }}
                  onPieceDragBegin={(piece: string, sourceSquare: string) => {
                    console.log('Drag begin:', { piece, sourceSquare });
                    setIntendedTarget(null); // Reset intended target
                  }}
                  onPieceDragEnd={(piece: string, sourceSquare: string) => {
                    console.log('onPieceDragEnd called:', { piece, sourceSquare, intendedTarget });
                    
                    // react-chessboard blocked the move
                    // This might be a promotion that was blocked, so we need to check
                    if (true) { // Always check for promotion on drag end
                      const isPawn = piece.toLowerCase().includes('p');
                      
                      if (isPawn) {
                        // Check if it's the player's turn
                        const isPlayerTurn = 
                          (playerColor === 'White' && game.turn() === 'w') ||
                          (playerColor === 'Black' && game.turn() === 'b');
                        
                        if (!isPlayerTurn) {
                          return;
                        }

                        // Since onPieceDrop wasn't called, we need to detect promotion attempt
                        const file = sourceSquare[0];
                        const rank = sourceSquare[1];
                        const possibleMoves: string[] = [];
                        
                        console.log('Checking promotion conditions:', {
                          piece,
                          file,
                          rank,
                          isWhitePawnOnRank7: piece.includes('w') && rank === '7',
                          isBlackPawnOnRank2: piece.includes('b') && rank === '2'
                        });
                        
                        if (piece.includes('w') && rank === '7') {
                          // White pawn on rank 7 - check all possible promotion moves
                          possibleMoves.push(file + '8'); // Forward
                          const leftFile = String.fromCharCode(file.charCodeAt(0) - 1);
                          const rightFile = String.fromCharCode(file.charCodeAt(0) + 1);
                          if (leftFile >= 'a') possibleMoves.push(leftFile + '8'); // Capture left
                          if (rightFile <= 'h') possibleMoves.push(rightFile + '8'); // Capture right
                        } else if (piece.includes('b') && rank === '2') {
                          // Black pawn on rank 2 - check all possible promotion moves
                          possibleMoves.push(file + '1'); // Forward
                          const leftFile = String.fromCharCode(file.charCodeAt(0) - 1);
                          const rightFile = String.fromCharCode(file.charCodeAt(0) + 1);
                          if (leftFile >= 'a') possibleMoves.push(leftFile + '1'); // Capture left
                          if (rightFile <= 'h') possibleMoves.push(rightFile + '1'); // Capture right
                        }
                        
                        // Test each possible promotion move and pick the first legal one
                        for (const targetMove of possibleMoves) {
                          const testGame = new Chess(game.fen());
                          try {
                            const testMove = testGame.move({
                              from: sourceSquare,
                              to: targetMove,
                              promotion: 'q'
                            });
                            
                            if (testMove) {
                              console.log('Drag-end promotion detected (fallback):', {
                                from: sourceSquare,
                                to: targetMove,
                                turn: game.turn(),
                                isCapture: !!testMove.captured,
                                captured: testMove.captured,
                                moveType: testMove.captured ? 'capture' : 'advance'
                              });
                              
                              setPendingMove({ from: sourceSquare, to: targetMove });
                              setShowPromotionModal(true);
                              break; // Use first legal promotion move found
                            }
                          } catch {
                            // This move is not legal, try next one
                            continue;
                          }
                        }
                      }
                    }
                    
                    setIntendedTarget(null); // Clear intended target
                  }}
                  customBoardStyle={{
                    borderRadius: '4px',
                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                  }}
                  customDarkSquareStyle={{ backgroundColor: '#779952' }}
                  customLightSquareStyle={{ backgroundColor: '#edeed1' }}
                  customSquareStyles={{
                    // Always highlight selected square (subtle)
                    ...(selectedSquare && {
                      [selectedSquare]: {
                        backgroundColor: showMoveHints ? '#ffd700' : 'rgba(255, 215, 0, 0.3)',
                        border: showMoveHints ? '3px solid #ff6b35' : '2px solid rgba(255, 107, 53, 0.5)'
                      }
                    }),
                    // Conditionally highlight valid move squares
                    ...(showMoveHints ? validMoves.reduce((styles, square) => {
                      styles[square] = {
                        backgroundColor: game.get(square as Square) ? 'rgba(255, 0, 0, 0.4)' : 'rgba(0, 255, 0, 0.4)',
                        borderRadius: '50%',
                        border: '2px solid #007bff'
                      };
                      return styles;
                    }, {} as Record<string, React.CSSProperties>) : {})
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
                      src={getImageUrl('fachri.jpg')}
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
                      src={getImageUrl('fachri.jpg')}
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

            {/* Game Controls */}
            <div className="flex flex-col items-center mt-4 gap-3">
              {/* Move Hints Toggle */}
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleMoveHints}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-all duration-200 ${
                    showMoveHints 
                      ? 'bg-blue-500 text-white hover:bg-blue-600' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {showMoveHints ? '🎯 Hide Hints' : '👁️ Show Hints'}
                </button>
                <span className="text-xs text-gray-500 hidden sm:inline">
                  {showMoveHints ? 'Expert mode off' : 'Expert mode on'}
                </span>
              </div>

              {/* Game Status */}
              <div className="text-center">
                {/* Regular turn status */}
                {gameStatus !== 'over' && (
                  <p className="text-sm text-gray-600">
                    {isAIThinking 
                      ? "AI is thinking..." 
                      : `Current turn: ${game.turn() === 'w' ? 'White' : 'Black'}`
                    }
                  </p>
                )}

              {/* Game Over Modal */}
              {gameStatus === 'over' && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                  <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md mx-4 transform animate-fadeIn">
                    <div className="text-6xl mb-4">
                      {winner ? '🏆' : '🤝'}
                    </div>
                    
                    <h2 className="text-3xl font-bold text-gray-800 mb-2">
                      {winner ? 'Game Over!' : "It's a Draw!"}
                    </h2>
                    
                    {winner && (
                      <div className="text-xl text-gray-600 mb-6">
                        <span className="font-semibold text-blue-600">
                          {winner}
                        </span> has won the game!
                      </div>
                    )}
                    
                    <div className="flex flex-col sm:flex-row gap-4 justify-center mt-6">
                      <button 
                        onClick={handlePlayAgain}
                        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 font-semibold"
                      >
                        Play Again
                      </button>
                      <button 
                        onClick={handleQuit}
                        className="px-6 py-3 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200 font-semibold"
                      >
                        Quit Game
                      </button>
                    </div>
                  </div>
                </div>
              )}
              </div>
            </div>
          </div>
        </div>

        {/* Chat Section */}
        <div className="bg-white rounded-lg shadow-lg p-4 flex flex-col h-[400px] sm:h-[450px] lg:h-[475px]">
          <h2 className="text-xl font-semibold text-gray-800 mb-4 flex-shrink-0">Chat with Fachri</h2>
          
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto space-y-4 mb-4 min-h-0">
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

          {/* Input Area */}
          <div className="border-t pt-4 flex-shrink-0">
            <form onSubmit={handleChatSubmit} className="flex gap-2">
              <input
                type="text"
                name="message"
                placeholder="Type a message..."
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-0"
              />
              <button
                type="submit"
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex-shrink-0"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>

    {/* Color Selection Modal */}
    <ColorSelectionModal 
      isOpen={showColorModal}
      onSelect={handleColorSelect}
    />

    {/* Promotion Modal */}
    {playerColor && (
      <PromotionModal
        isOpen={showPromotionModal}
        playerColor={playerColor}
        onSelect={handlePromotionSelect}
      />
    )}
  </div>
);
}