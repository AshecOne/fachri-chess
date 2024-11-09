'use client'

import { Fragment, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'

interface PlayerInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (playerInfo: { name: string; gender: string }) => void;
}

export default function PlayerInfoModal({ isOpen, onClose, onSubmit }: PlayerInfoModalProps) {
  const [playerInfo, setPlayerInfo] = useState({
    name: '',
    gender: '' // Default kosong
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerInfo.name || !playerInfo.gender) return; // Validasi
    onSubmit(playerInfo);
    onClose();
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-10" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title
                  as="h3"
                  className="text-2xl font-medium leading-6 text-gray-900 text-center mb-6"
                >
                  Player Information
                </Dialog.Title>
                <form onSubmit={handleSubmit} className="space-y-8">
                  {/* Name Input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Your Name
                    </label>
                    <input
                      type="text"
                      required
                      className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={playerInfo.name}
                      onChange={(e) => setPlayerInfo({ ...playerInfo, name: e.target.value })}
                      placeholder="Enter your name"
                    />
                  </div>

                  {/* Gender Selection */}
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-gray-700">
                      Select Gender
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      {/* Male Option */}
                      <button
                        type="button"
                        className={`flex flex-col items-center p-4 rounded-lg border-2 transition-all duration-200 ${
                          playerInfo.gender === 'male'
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-blue-200'
                        }`}
                        onClick={() => setPlayerInfo({ ...playerInfo, gender: 'male' })}
                      >
                        <div className="text-5xl mb-2">👨</div>
                        <span className={`font-medium ${
                          playerInfo.gender === 'male' ? 'text-blue-600' : 'text-gray-700'
                        }`}>
                          Male
                        </span>
                      </button>

                      {/* Female Option */}
                      <button
                        type="button"
                        className={`flex flex-col items-center p-4 rounded-lg border-2 transition-all duration-200 ${
                          playerInfo.gender === 'female'
                            ? 'border-pink-500 bg-pink-50'
                            : 'border-gray-200 hover:border-pink-200'
                        }`}
                        onClick={() => setPlayerInfo({ ...playerInfo, gender: 'female' })}
                      >
                        <div className="text-5xl mb-2">👩</div>
                        <span className={`font-medium ${
                          playerInfo.gender === 'female' ? 'text-pink-600' : 'text-gray-700'
                        }`}>
                          Female
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={!playerInfo.name || !playerInfo.gender}
                    className={`w-full py-3 rounded-lg text-white font-medium transition-all duration-200 ${
                      playerInfo.name && playerInfo.gender
                        ? 'bg-blue-600 hover:bg-blue-700'
                        : 'bg-gray-400 cursor-not-allowed'
                    }`}
                  >
                    Start Game
                  </button>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}