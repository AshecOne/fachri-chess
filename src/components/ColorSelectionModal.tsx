'use client'
import { Dialog } from '@headlessui/react'

type ColorChoice = 'White' | 'Black' | 'random';

interface ColorSelectionModalProps {
  isOpen: boolean;
  onSelect: (color: ColorChoice) => void;
}

export default function ColorSelectionModal({ isOpen, onSelect }: ColorSelectionModalProps) {
  return (
    <Dialog 
      open={isOpen} 
      onClose={() => {}}
      className="relative z-50"
    >
      <div className="fixed inset-0 bg-black/25" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="w-full max-w-md rounded-2xl bg-white p-6">
          <h2 className="text-2xl font-medium text-center mb-6">
            Choose Your Color
          </h2>
          <div className="space-y-4">
            <button
              onClick={() => onSelect('White')}
              className="w-full p-4 flex items-center justify-center border-2 rounded-lg"
            >
              <span className="text-4xl mr-4">♔</span>
              Play as White
            </button>
            <button
              onClick={() => onSelect('Black')}
              className="w-full p-4 flex items-center justify-center border-2 rounded-lg"
            >
              <span className="text-4xl mr-4">♚</span>
              Play as Black
            </button>
            <button
              onClick={() => onSelect('random')}
              className="w-full p-4 flex items-center justify-center border-2 rounded-lg"
            >
              <span className="text-4xl mr-4">🎲</span>
              Random
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}