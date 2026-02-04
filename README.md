# 🪙 CoinSniffer

A multiplayer 3D browser game where players compete to collect coins in an Israeli-themed environment. Built with Solana blockchain integration for real rewards!

![CoinSniffer](https://via.placeholder.com/800x400?text=CoinSniffer+Game)

## 🎮 Features

- **Multiplayer Gameplay**: Up to 10 players compete in real-time
- **Israeli-Themed World**: Jerusalem stone buildings, synagogue, Western Wall, market stalls
- **Solana Rewards**: Top 3 players win real SOL rewards
- **3D First-Person**: Built with Three.js for immersive gameplay
- **Interactive Environment**: Open doors, explore buildings
- **Jewish Character Models**: Players with kippahs and beards

## 🎯 How to Play

1. Enter your Solana wallet address
2. Wait in lobby for other players (3-minute timer)
3. When game starts, collect as many coins as possible
4. Top 3 players split the reward pool (50%/30%/20%)

### Controls

| Key | Action |
|-----|--------|
| WASD | Move |
| Mouse | Look around |
| Space | Jump |
| E | Open/Close doors |

## 🚀 Quick Start

### Development

```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd server && npm install && cd ..

# Start backend (terminal 1)
cd server && npm run dev

# Start frontend (terminal 2)
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:9113

### Docker

```bash
# Build and run in background (Recommended)
docker-compose up -d --build

# View logs
docker-compose logs -f
```

- Frontend: http://localhost:9112
- Backend: http://localhost:9113

## 🔧 Configuration

Create `server/.env` file:

```env
# Helius API Key for Solana RPC
HELIUS_API_KEY=your_helius_api_key_here

# Reward wallet private key (base58 or JSON array)
REWARD_WALLET_PRIVATE_KEY=your_wallet_private_key_here

# Fee reserve for transaction costs
FEE_RESERVE_SOL=0.01

# Server port
PORT=9113

# Game settings
MAX_PLAYERS=10
LOBBY_TIMER_SECONDS=180
GAME_DURATION_SECONDS=120
TOTAL_PENNIES=75
```

## 📁 Project Structure

```
PenneySniffer/
├── src/
│   ├── main.ts          # Game logic, Three.js, Socket.IO client
│   ├── world.ts         # 3D world creation (buildings, trees, etc.)
│   ├── ui.ts            # UI management
│   └── style.css        # Styling
├── server/
│   ├── server.js        # Express + Socket.IO server
│   ├── gameManager.js   # Game state management
│   ├── solanaService.js # Solana blockchain integration
│   └── .env             # Environment variables
├── index.html           # Main HTML file
├── Dockerfile           # Frontend Docker config
├── docker-compose.yml   # Docker Compose config
└── package.json
```

## 🏗️ Tech Stack

- **Frontend**: Vite, TypeScript, Three.js
- **Backend**: Node.js, Express, Socket.IO
- **Blockchain**: Solana Web3.js, Helius RPC
- **Deployment**: Docker, Nginx

## 🔐 Security Notes

- Never commit your `.env` file with real keys
- The reward wallet private key should be kept secure
- Use the fee reserve to ensure transaction costs are covered

## 📜 License

MIT License - feel free to use and modify!

## 🤝 Contributing

Pull requests welcome! Please open an issue first for major changes.
