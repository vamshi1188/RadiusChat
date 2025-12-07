# RadiusChat

A real-time location-based chat application built with Go and React. Visualize nearby users on a map and establish secure peer-to-peer communication channels.

## Features

- 🗺️ **Real-time Map Visualization** - See connected users on an interactive map
- 💬 **P2P Chat** - Direct messaging between users
- 📍 **Geolocation Support** - Automatic location detection
- 🔄 **WebSocket Communication** - Real-time updates across all clients
- 🎨 **Modern UI** - Cyberpunk-themed dark interface with Leaflet maps

## Tech Stack

**Backend:**
- Go (Golang)
- Gorilla WebSocket
- Native HTTP server

**Frontend:**
- React 19
- TypeScript
- Vite
- React Leaflet (OpenStreetMap)
- Tailwind CSS

## Project Structure

```
.
├── main.go                 # Go WebSocket server
├── go.mod                  # Go dependencies
└── web/                    # React frontend
    ├── App.tsx             # Main application component
    ├── index.tsx           # React entry point
    ├── types.ts            # TypeScript interfaces
    ├── vite.config.ts      # Vite configuration
    ├── components/         # React components
    │   ├── MapMarkers.tsx
    │   └── UIComponents.tsx
    └── services/           # WebSocket service
        └── websocketBackend.ts
```

## Getting Started

### Prerequisites

- Go 1.16 or higher
- Node.js 18 or higher
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd "radius copy"
   ```

2. **Install Go dependencies**
   ```bash
   go mod tidy
   ```

3. **Install frontend dependencies**
   ```bash
   cd web
   npm install
   ```

4. **Build the frontend**
   ```bash
   npm run build
   cd ..
   ```

5. **Run the server**
   ```bash
   go run main.go
   ```

6. **Open your browser**
   Navigate to `http://localhost:8080`

## Development

To run the frontend in development mode with hot reload:

```bash
cd web
npm run dev
```

This will start the Vite dev server on `http://localhost:3000` which will connect to the Go backend on `http://localhost:8080`.

## How It Works

1. **Connection**: Users connect via WebSocket with their name and location
2. **Discovery**: The server broadcasts all connected users to every client
3. **Chat Request**: Click on a user marker to initiate a chat request
4. **Communication**: Once accepted, users can exchange messages in real-time
5. **End Chat**: Either user can terminate the connection at any time

## WebSocket Protocol

The application uses a JSON-based message protocol:

### Client → Server Messages
- `login` - Register user with name and location
- `update_location` - Update user's coordinates
- `request_chat` - Request chat with target user
- `accept_chat` - Accept incoming chat request
- `decline_chat` - Decline incoming chat request
- `cancel_request` - Cancel outgoing chat request
- `chat_msg` - Send message to chat partner
- `end_chat` - Terminate active chat session

### Server → Client Messages
- `world_state` - Broadcast all users and their states
- `chat_request` - Incoming chat request notification
- `chat_connected` - Chat session established
- `chat_msg` - Incoming message from partner
- `chat_ended` - Chat session terminated
- `chat_declined` - Chat request was declined
- `request_cancelled` - Incoming request was cancelled

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
