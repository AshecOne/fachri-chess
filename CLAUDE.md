# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a chess application built with Next.js that features an AI opponent named "Daffa" (memorializing Fachri Alauddin). The application combines chess gameplay with a chat interface where the AI has a personality inspired by philosophy, particularly Albert Camus and existentialism.

## Development Commands

### Running the Application
- `npm run dev` - Start development server on localhost:3000
- `npm run build` - Build production bundle (note: uses `--no-lint` flag)
- `npm start` - Start production server
- `npm run lint` - Run ESLint for code quality

### Build Notes
- The build command intentionally skips linting (`--no-lint`)
- Always run `npm run lint` manually before committing to ensure code quality

## Architecture Overview

### Core Components

**Chess Game Engine (`src/lib/chess-ai.ts`)**
- Uses ONNX Runtime Web for AI model inference
- Loads quantized chess model (`chess_model_quantized.onnx`) for position evaluation
- Implements opening book with popular chess openings
- Features position caching for performance optimization
- Supports both local and GitHub Pages deployment (model URL detection)

**Game State Management (`src/app/game/page.tsx`)**
- Manages chess board state using chess.js library
- Handles player vs AI turns with WebAssembly model integration
- Persists game state in localStorage for continuity
- Implements game situation analysis (advantage, check, winning, etc.)

**Chat System (`src/services/chat-service.ts`)**
- Personality-driven chat responses with philosophical themes
- Situation-aware responses based on game state
- Keyword-based response matching with fallback defaults
- Rate limiting to prevent spam

**UI Components**
- `ColorSelectionModal.tsx` - Player color choice interface
- `PlayerInfoModal.tsx` - Player registration form
- `PromotionModal.tsx` - Pawn promotion piece selection modal
- Uses Headless UI for accessible modal components
- React Chessboard for interactive chess interface

### Technical Stack

**Frontend Framework**
- Next.js 15 with App Router
- React 18 with TypeScript
- Tailwind CSS for styling
- Dynamic imports for SSR compatibility

**Chess Engine**
- chess.js for game logic and move validation
- react-chessboard for board visualization
- Custom ONNX model for position evaluation

**AI/ML Pipeline**
- PyTorch model training (`train_model.py`)
- ONNX model conversion (`convert_model.py`)
- ONNX Runtime Web for browser inference
- WebAssembly optimization for performance

### Key File Locations

- Main game page: `src/app/game/page.tsx`
- AI implementation: `src/lib/chess-ai.ts`
- Chat service: `src/services/chat-service.ts`
- Type definitions: `src/types/game.ts`
- Model files: `public/chess_model_quantized.onnx`
- WASM files: `public/onnx/`

### Development Patterns

**State Management**
- localStorage for game persistence
- React state for UI interactions
- Chess.js instance for game state
- Modal states for color selection and pawn promotion

**Performance Optimizations**
- Dynamic imports for client-side only components
- Model caching and position memoization
- Quantized ONNX model for faster inference
- Progressive loading with status indicators

**Error Handling**
- Graceful fallbacks for AI move failures
- Model loading error states
- Invalid move recovery

### Testing and Quality

- TypeScript for type safety
- ESLint configuration (run manually before commits)
- No automated test suite currently configured

### Deployment Considerations

**Environment Support**
- Local development with Node.js 20+ (avoid Node.js 23+ due to compatibility issues)
- GitHub Pages deployment with automatic asset URL resolution
- Environment-aware asset loading via `src/lib/utils.ts`

**Asset Management**
- Images and models work in both environments using `getAssetUrl()`, `getModelUrl()`, `getImageUrl()` utilities
- Next.js configured for external GitHub Pages images
- WASM file serving properly configured

**Common Issues & Solutions**
- **Bus error**: Use Node.js 20 LTS instead of latest versions
- **Hydration errors**: All localStorage access wrapped with `typeof window !== 'undefined'` checks
- **Image loading**: External domains configured in `next.config.ts` remotePatterns
- **Pawn promotion**: Built-in react-chessboard promotion UI disabled via CSS and `onPieceDrop` return false
- **Double promotion UI**: Custom `PromotionModal` used instead of library default

### Model Training Pipeline

The project includes Python scripts for training the chess AI:
- `train_model.py` - PyTorch model training with chess position evaluation
- `convert_model.py` - Converts PyTorch model to ONNX format for web deployment

Note: Model training requires Python environment with PyTorch, chess, and ONNX dependencies.