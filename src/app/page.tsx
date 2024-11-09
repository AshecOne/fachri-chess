'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import PlayerInfoModal from '@/components/PlayerInfoModal'

export default function Home() {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handlePlayerInfo = (playerInfo: { name: string; gender: string }) => {
    localStorage.setItem('playerInfo', JSON.stringify(playerInfo));
    router.push('/game');
  };

  return (
    <main className="min-h-screen relative bg-gradient-to-b from-blue-50 to-white">
      {/* Decorative chess pieces background */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <div className="absolute top-10 left-10 text-8xl">♔</div>
        <div className="absolute top-20 right-20 text-8xl">♕</div>
        <div className="absolute bottom-10 left-20 text-8xl">♖</div>
        <div className="absolute bottom-20 right-10 text-8xl">♗</div>
      </div>

      {/* Main content */}
      <div className="relative min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="text-center space-y-8 max-w-3xl mx-auto">
          {/* Main title with gradient */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
            Fun Chess with Fachri
          </h1>

          {/* Memorial text */}
          <div className="space-y-4">
            <p className="text-lg sm:text-xl text-gray-600 italic">
              In loving memory of
            </p>
            <h2 className="text-2xl sm:text-3xl font-medium text-gray-800">
              Fachri Alauddin (Daffa)
            </h2>
            <p className="text-md sm:text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
              A brilliant soul who shared his passion for chess and brought joy to everyone around him. 
              His legacy lives on through this game, inspiring future generations of chess enthusiasts.
            </p>
          </div>

          {/* Play button */}
          <div className="pt-8">
            <button
              onClick={() => setIsModalOpen(true)}
              className="transform transition-all duration-300 px-8 py-4 bg-blue-600 text-white text-lg sm:text-xl rounded-lg hover:bg-blue-700 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 shadow-lg hover:shadow-xl"
            >
              Start Playing
            </button>
          </div>

          {/* Additional dedication text */}
          <p className="text-sm sm:text-base text-gray-500 pt-6">
          &quot;Every move we make here celebrates his memory&quot;
          </p>
        </div>
      </div>

      {/* Player Info Modal */}
      <PlayerInfoModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handlePlayerInfo}
      />
    </main>
  );
}