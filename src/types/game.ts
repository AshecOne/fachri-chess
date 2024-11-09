export interface PlayerInfo {
    name: string;
    gender: string;
  }
  
  export interface GameState {
    fen: string;
    playerColor: 'w' | 'b';
    isPlayerTurn: boolean;
    gameOver: boolean;
    result?: string;
  }