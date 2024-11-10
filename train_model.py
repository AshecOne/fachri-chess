import torch
import torch.nn as nn
import torch.optim as optim
import chess
import chess.pgn
import numpy as np
import os
from datetime import datetime
import io

# Model definition
class ChessModel(nn.Module):
    def __init__(self):
        super(ChessModel, self).__init__()
        self.input_size = 896  # 768 + 128 additional features
        
        self.feature_extractor = nn.Sequential(
            nn.Linear(self.input_size, 2048),
            nn.LeakyReLU(),
            nn.BatchNorm1d(2048),
            nn.Dropout(0.3),
            
            nn.Linear(2048, 1024),
            nn.LeakyReLU(),
            nn.BatchNorm1d(1024),
            nn.Dropout(0.3),
            
            nn.Linear(1024, 512),
            nn.LeakyReLU(),
            nn.BatchNorm1d(512),
            nn.Dropout(0.3),
        )
        
        self.value_head = nn.Sequential(
            nn.Linear(512, 256),
            nn.LeakyReLU(),
            nn.Linear(256, 1),
            nn.Tanh()
        )
        
        # Initialize weights
        for m in self.modules():
            if isinstance(m, nn.Linear):
                nn.init.kaiming_normal_(m.weight)
                if m.bias is not None:
                    nn.init.constant_(m.bias, 0)
    
    def forward(self, x):
        features = self.feature_extractor(x)
        value = self.value_head(features)
        return value

def board_to_input(board):
    # Encode lebih banyak fitur
    features = np.zeros(896, dtype=np.float32)  # 768 + 128 fitur tambahan
    pieces = 'PNBRQKpnbrqk'
    
    # Basic piece positions (768)
    for i in range(8):
        for j in range(8):
            square = chess.square(j, 7-i)
            piece = board.piece_at(square)
            if piece:
                piece_idx = pieces.index(piece.symbol())
                idx = (i * 8 + j) * 12 + piece_idx
                features[idx] = 1
    
    # Additional features (128)
    feature_idx = 768
    
    # Material count
    for piece_type in chess.PIECE_TYPES:
        features[feature_idx] = len(board.pieces(piece_type, chess.WHITE))
        features[feature_idx + 1] = len(board.pieces(piece_type, chess.BLACK))
        feature_idx += 2
    
    # Control of center squares
    center_squares = [chess.E4, chess.D4, chess.E5, chess.D5]
    for square in center_squares:
        features[feature_idx] = len(board.attackers(chess.WHITE, square))
        features[feature_idx + 1] = len(board.attackers(chess.BLACK, square))
        feature_idx += 2
    
    # King safety
    w_king_square = board.king(chess.WHITE)
    b_king_square = board.king(chess.BLACK)
    if w_king_square:
        features[feature_idx] = len(board.attackers(chess.BLACK, w_king_square))
    if b_king_square:
        features[feature_idx + 1] = len(board.attackers(chess.WHITE, b_king_square))
    feature_idx += 2
    
    # Mobility
    w_moves = board.legal_moves if board.turn == chess.WHITE else None
    b_moves = board.legal_moves if board.turn == chess.BLACK else None
    features[feature_idx] = sum(1 for _ in w_moves) if w_moves else 0
    features[feature_idx + 1] = sum(1 for _ in b_moves) if b_moves else 0
    
    return features

def load_games(pgn_file, max_games=10000):
    print(f"Loading games from {pgn_file}")
    games = []
    count = 0
    
    with open(pgn_file) as f:
        while count < max_games:
            game = chess.pgn.read_game(f)
            if game is None:
                break
            games.append(game)
            count += 1
            if count % 100 == 0:
                print(f"Loaded {count} games...")
    
    print(f"Total games loaded: {len(games)}")
    return games

def prepare_training_data(games):
    X = []
    y = []
    
    for idx, game in enumerate(games):
        if idx % 100 == 0:
            print(f"Processing game {idx}/{len(games)}")
        
        board = game.board()
        result = game.headers["Result"]
        
        # Convert result to target value
        if result == "1-0":
            white_perspective = 1.0
            black_perspective = -1.0
        elif result == "0-1":
            white_perspective = -1.0
            black_perspective = 1.0
        else:
            white_perspective = 0.0
            black_perspective = 0.0
        
        # Process all positions in the game
        for move in game.mainline_moves():
            board.push(move)
            features = board_to_input(board)
            
            # Save position from both perspectives
            if board.turn == chess.WHITE:
                X.append(features)
                y.append(white_perspective)
            else:
                X.append(features)
                y.append(black_perspective)
    
    return np.array(X, dtype=np.float32), np.array(y, dtype=np.float32)
    X = []
    y = []
    
    for idx, game in enumerate(games):
        if idx % 100 == 0:
            print(f"Processing game {idx}/{len(games)}")
        
        board = game.board()
        result = game.headers["Result"]
        
        # Convert result to target value
        if result == "1-0":
            target = 1.0
        elif result == "0-1":
            target = -1.0
        else:
            target = 0.0
        
        # Process all positions in the game
        for move in game.mainline_moves():
            board.push(move)
            X.append(board_to_input(board))
            y.append(target)
    
    return np.array(X, dtype=np.float32), np.array(y, dtype=np.float32)

def main():
    # Set device
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"Using device: {device}")
    
    # Load dataset
    pgn_file = "public/dataset/games_dataset.pgn"
    games = load_games(pgn_file)
    
    # Prepare data
    print("Preparing training data...")
    X, y = prepare_training_data(games)
    print(f"Dataset size: {len(X)} positions")
    
    # Convert to PyTorch tensors
    X = torch.FloatTensor(X).to(device)
    y = torch.FloatTensor(y).to(device)
    
    # Create model
    model = ChessModel().to(device)
    
    # Training parameters
    criterion = nn.MSELoss()
    optimizer = optim.Adam(model.parameters(), lr=0.001)
    batch_size = 2048
    num_epochs = 20

    # Tambahkan early stopping
    early_stopping = 5
    best_loss = float('inf')
    patience_counter = 0
    
    # Create directory for checkpoints
    os.makedirs('checkpoints', exist_ok=True)
    
    # Training loop
    print("Starting training...")
    for epoch in range(num_epochs):
        model.train()
        total_loss = 0
        num_batches = 0
        
        # Process mini-batches
        for i in range(0, len(X), batch_size):
            batch_X = X[i:i+batch_size]
            batch_y = y[i:i+batch_size]
            
            optimizer.zero_grad()
            outputs = model(batch_X)
            loss = criterion(outputs.squeeze(), batch_y)
            loss.backward()
            optimizer.step()
            
            total_loss += loss.item()
            num_batches += 1
            
            if num_batches % 100 == 0:
                print(f"Epoch {epoch+1}/{num_epochs}, Batch {num_batches}, Loss: {loss.item():.4f}")
        
        avg_loss = total_loss / num_batches
        print(f"Epoch {epoch+1}/{num_epochs} completed, Average Loss: {avg_loss:.4f}")
        
        # Save checkpoint
        checkpoint_path = f'checkpoints/model_epoch_{epoch+1}.pt'
        torch.save({
            'epoch': epoch,
            'model_state_dict': model.state_dict(),
            'optimizer_state_dict': optimizer.state_dict(),
            'loss': avg_loss,
        }, checkpoint_path)
        print(f"Saved checkpoint to {checkpoint_path}")
    
    # Save final model
    final_model_path = 'public/chess_model.pt'
    torch.save(model.state_dict(), final_model_path)
    print(f"Training completed. Final model saved to {final_model_path}")

if __name__ == "__main__":
    main()