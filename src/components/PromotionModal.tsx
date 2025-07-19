'use client'
import { Dialog } from '@headlessui/react'

type PromotionPiece = 'q' | 'r' | 'b' | 'n';

interface PromotionModalProps {
  isOpen: boolean;
  playerColor: 'White' | 'Black';
  onSelect: (piece: PromotionPiece) => void;
}

export default function PromotionModal({ isOpen, playerColor, onSelect }: PromotionModalProps) {
  const isWhite = playerColor === 'White';
  
  // Define pieces with their symbols for both colors
  const pieces = [
    { type: 'q' as PromotionPiece, name: 'Queen', symbol: isWhite ? '♕' : '♛' },
    { type: 'r' as PromotionPiece, name: 'Rook', symbol: isWhite ? '♖' : '♜' },
    { type: 'b' as PromotionPiece, name: 'Bishop', symbol: isWhite ? '♗' : '♝' },
    { type: 'n' as PromotionPiece, name: 'Knight', symbol: isWhite ? '♘' : '♞' },
  ];

  return (
    <Dialog 
      open={isOpen} 
      onClose={() => {}} // Prevent closing without selection
      className="relative z-50"
    >
      <div className="fixed inset-0 bg-black/50" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              Pawn Promotion
            </h2>
            <p className="text-gray-600">
              Choose which piece your pawn becomes:
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            {pieces.map((piece) => (
              <button
                key={piece.type}
                onClick={() => onSelect(piece.type)}
                className="group p-6 flex flex-col items-center justify-center border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                <span className="text-6xl mb-2 group-hover:scale-110 transition-transform duration-200">
                  {piece.symbol}
                </span>
                <span className="text-lg font-semibold text-gray-700 group-hover:text-blue-700">
                  {piece.name}
                </span>
              </button>
            ))}
          </div>
          
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500">
              Click on a piece to complete your promotion
            </p>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}