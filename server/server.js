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
    },
    maxHttpBufferSize: 1e8 // 100MB for voice data
});

const PORT = process.env.PORT || 3001;
const gameManager = new GameManager(io);

// Voice chat rooms - track who's in voice
const voiceRooms = new Map(); // socketId -> { inVoice: boolean, muted: boolean }

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

    // ============ VOICE CHAT SIGNALING ============

    // Player joins voice chat
    socket.on('voice_join', () => {
        voiceRooms.set(socket.id, { inVoice: true, muted: false });
        console.log(`🎤 Player ${socket.id} joined voice chat`);

        // Notify all other voice users about new peer
        socket.broadcast.emit('voice_peer_joined', { peerId: socket.id });

        // Send list of existing voice peers to new joiner
        const existingPeers = [];
        voiceRooms.forEach((state, peerId) => {
            if (peerId !== socket.id && state.inVoice) {
                existingPeers.push(peerId);
            }
        });
        socket.emit('voice_peers_list', { peers: existingPeers });
    });

    // Player leaves voice chat
    socket.on('voice_leave', () => {
        voiceRooms.delete(socket.id);
        console.log(`🔇 Player ${socket.id} left voice chat`);
        socket.broadcast.emit('voice_peer_left', { peerId: socket.id });
    });

    // WebRTC signaling - offer
    socket.on('voice_offer', (data) => {
        const { targetId, offer } = data;
        io.to(targetId).emit('voice_offer', {
            fromId: socket.id,
            offer
        });
    });

    // WebRTC signaling - answer
    socket.on('voice_answer', (data) => {
        const { targetId, answer } = data;
        io.to(targetId).emit('voice_answer', {
            fromId: socket.id,
            answer
        });
    });

    // WebRTC signaling - ICE candidate
    socket.on('voice_ice_candidate', (data) => {
        const { targetId, candidate } = data;
        io.to(targetId).emit('voice_ice_candidate', {
            fromId: socket.id,
            candidate
        });
    });

    // Toggle mute status
    socket.on('voice_mute_toggle', (data) => {
        const voiceState = voiceRooms.get(socket.id);
        if (voiceState) {
            voiceState.muted = data.muted;
            socket.broadcast.emit('voice_peer_muted', {
                peerId: socket.id,
                muted: data.muted
            });
        }
    });

    // ============ END VOICE CHAT ============

    // Disconnect handling
    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);

        // Clean up voice chat
        if (voiceRooms.has(socket.id)) {
            voiceRooms.delete(socket.id);
            socket.broadcast.emit('voice_peer_left', { peerId: socket.id });
        }

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
    console.log(`🪙 CoinSniffer server running on port ${PORT}`);
});
