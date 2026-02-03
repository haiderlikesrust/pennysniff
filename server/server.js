const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const GameManager = require('./gameManager');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3001;
const gameManager = new GameManager(io);

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);

    // Player joins lobby with wallet address
    socket.on('join_lobby', (data) => {
        const { walletAddress } = data;
        const result = gameManager.addPlayerToLobby(socket.id, walletAddress);

        if (result.success) {
            socket.walletAddress = walletAddress;
            socket.emit('lobby_joined', {
                success: true,
                playerId: socket.id,
                lobbyState: gameManager.getLobbyState()
            });
            io.emit('lobby_update', gameManager.getLobbyState());
        } else {
            socket.emit('lobby_joined', {
                success: false,
                reason: result.reason
            });
        }
    });

    // Player joins as spectator
    socket.on('join_spectator', () => {
        gameManager.addSpectator(socket.id);
        socket.join('spectators');
        socket.emit('spectator_joined', {
            gameState: gameManager.getGameState()
        });
    });

    // Player movement update
    socket.on('player_move', (data) => {
        gameManager.updatePlayerPosition(socket.id, data);
        socket.broadcast.emit('player_moved', {
            playerId: socket.id,
            ...data
        });
    });

    // Player collects penny
    socket.on('collect_penny', (data) => {
        const result = gameManager.collectPenny(socket.id, data.pennyId);
        if (result.success) {
            io.emit('penny_collected', {
                pennyId: data.pennyId,
                playerId: socket.id,
                playerScore: result.playerScore
            });
            io.emit('scores_update', gameManager.getScores());
        }
    });

    // Disconnect handling
    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);
        gameManager.removePlayer(socket.id);
        io.emit('lobby_update', gameManager.getLobbyState());
        io.emit('player_left', { playerId: socket.id });
    });
});

// REST endpoints
app.get('/api/status', (req, res) => {
    res.json({
        lobbyState: gameManager.getLobbyState(),
        gameState: gameManager.getGameState()
    });
});

app.get('/api/leaderboard', (req, res) => {
    res.json(gameManager.getLeaderboard());
});

server.listen(PORT, () => {
    console.log(`🪙 PennySniffer server running on port ${PORT}`);
});
