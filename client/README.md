# RGB Client

Frontend application for the RGB multiplayer color communication game built with React and TypeScript.

## Features

- **HSL Color Picker**: Full spectrum color selection with precise HSL controls
- **Real-time Multiplayer**: WebSocket-based game synchronization
- **Responsive Design**: Works across desktop and mobile devices
- **Game Flow**: Complete game state management from lobby to scoring

## Technology Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **React Router** - Client-side routing
- **Virgo** - UI component library

## Development

Start the development server:
```bash
npm run dev
```

Build for production:
```bash
npm run build
```

Preview production build:
```bash
npm run preview
```

## Game Components

### Core Game Flow
- **GameContainer**: Main application container and routing
- **GameDisplay**: Real-time game state and timer display
- **GameManager**: Round progression and game logic management
- **GameNavbar**: Top navigation with room info and controls
- **GameResults**: Final scoring and winner announcement

### Player Interfaces
- **PlayerLobby**: Game creation and joining interface
- **PlayerSidebar**: Player list, scores, and management
- **PlayerDescriber**: Color description input for describers
- **PlayerGuesser**: Color selection interface for guessers

### Color Components
- **ColorBox**: Reusable color display with HSL values
- **ColorWheel**: Interactive HSL color picker
- **ColorSliders**: Fine-tuned color adjustment modal

### Round & Utility
- **RoundReveal**: Round results and scoring display
- **Button/TimerButton**: Styled buttons with timer integration
- **RegionSelector**: AWS region selection
- **ConnectionStatus**: WebSocket connection indicator
- **RoomMenu**: Game management and sharing

## Environment Variables

Create a `.env` file with:
```
VITE_CLARITY_PROJECT_ID=your-clarity-project-id
```

WebSocket endpoints are configured in `src/constants/regions.ts` and automatically selected based on the closest AWS region.
