const SolanaService = require('./solanaService');

class GameManager {
    constructor(io) {
        this.io = io;
        this.solanaService = new SolanaService();

        // Game configuration
        this.maxPlayers = parseInt(process.env.MAX_PLAYERS) || 10;
        this.lobbyTimerSeconds = parseInt(process.env.LOBBY_TIMER_SECONDS) || 180;
        this.gameDurationSeconds = parseInt(process.env.GAME_DURATION_SECONDS) || 120;
        this.totalPennies = parseInt(process.env.TOTAL_PENNIES) || 75;

        // State
        this.lobby = new Map(); // socketId -> { walletAddress, joinTime }
        this.players = new Map(); // socketId -> { walletAddress, position, score }
        this.spectators = new Set();
        this.cooldownPlayers = new Set(); // walletAddresses on cooldown
        this.pennies = new Map(); // pennyId -> { position, collected }

        this.gamePhase = 'lobby'; // lobby, playing, results
        this.lobbyTimer = null;
        this.gameTimer = null;
        this.lobbyStartTime = null;
        this.gameStartTime = null;
        this.lastGamePlayers = [];
    }

    // Add player to lobby
    addPlayerToLobby(socketId, walletAddress) {
        // Check if wallet is valid
        if (!walletAddress || walletAddress.length < 32) {
            return { success: false, reason: 'Invalid wallet address' };
        }

        // Check cooldown
        if (this.cooldownPlayers.has(walletAddress)) {
            return { success: false, reason: 'You must wait one game before playing again. You can spectate!' };
        }

        // Check if already in lobby
        for (const [, player] of this.lobby) {
            if (player.walletAddress === walletAddress) {
                return { success: false, reason: 'Wallet already in lobby' };
            }
        }

        // Check if lobby is full
        if (this.lobby.size >= this.maxPlayers) {
            return { success: false, reason: 'Lobby is full. You can spectate!' };
        }

        // Check if game is in progress
        if (this.gamePhase === 'playing') {
            return { success: false, reason: 'Game in progress. You can spectate!' };
        }

        // Add to lobby
        this.lobby.set(socketId, {
            walletAddress,
            joinTime: Date.now()
        });

        // Start lobby timer if first player
        if (this.lobby.size === 1) {
            this.startLobbyTimer();
        }

        // Start game if lobby is full
        if (this.lobby.size >= this.maxPlayers) {
            this.startGame();
        }

        return { success: true };
    }

    // Start lobby countdown
    startLobbyTimer() {
        this.lobbyStartTime = Date.now();

        this.lobbyTimer = setInterval(() => {
            const elapsed = (Date.now() - this.lobbyStartTime) / 1000;
            const remaining = Math.max(0, this.lobbyTimerSeconds - elapsed);

            this.io.emit('lobby_timer', {
                remaining: Math.ceil(remaining),
                total: this.lobbyTimerSeconds
            });

            if (remaining <= 0 && this.lobby.size >= 2) {
                this.startGame();
            } else if (remaining <= 0) {
                // Not enough players, reset timer
                this.lobbyStartTime = Date.now();
                this.io.emit('lobby_message', { message: 'Need at least 2 players to start!' });
            }
        }, 1000);
    }

    // Start the game
    startGame() {
        if (this.lobbyTimer) {
            clearInterval(this.lobbyTimer);
            this.lobbyTimer = null;
        }

        this.gamePhase = 'playing';
        this.gameStartTime = Date.now();

        // Convert lobby players to active players
        for (const [socketId, lobbyPlayer] of this.lobby) {
            this.players.set(socketId, {
                walletAddress: lobbyPlayer.walletAddress,
                position: this.getRandomSpawnPosition(),
                rotation: { x: 0, y: 0 },
                score: 0
            });
        }
        this.lobby.clear();

        // Generate pennies
        this.generatePennies();

        // Notify all players
        this.io.emit('game_start', {
            players: Array.from(this.players.entries()).map(([id, p]) => ({
                id,
                walletAddress: p.walletAddress,
                position: p.position
            })),
            pennies: Array.from(this.pennies.entries()).map(([id, p]) => ({
                id,
                position: p.position
            })),
            duration: this.gameDurationSeconds
        });

        // Start game timer
        this.gameTimer = setInterval(() => {
            const elapsed = (Date.now() - this.gameStartTime) / 1000;
            const remaining = Math.max(0, this.gameDurationSeconds - elapsed);

            this.io.emit('game_timer', {
                remaining: Math.ceil(remaining),
                total: this.gameDurationSeconds
            });

            if (remaining <= 0) {
                this.endGame();
            }
        }, 1000);
    }

    // Generate pennies in the world
    generatePennies() {
        this.pennies.clear();

        // Penny spawn positions (spread around the map)
        const mapSize = 100;

        for (let i = 0; i < this.totalPennies; i++) {
            const id = `penny_${i}`;
            this.pennies.set(id, {
                position: {
                    x: (Math.random() - 0.5) * mapSize,
                    y: 0.1, // Slightly above ground
                    z: (Math.random() - 0.5) * mapSize
                },
                collected: false
            });
        }
    }

    // Get random spawn position for player
    getRandomSpawnPosition() {
        const angle = Math.random() * Math.PI * 2;
        const radius = 10 + Math.random() * 20;
        return {
            x: Math.cos(angle) * radius,
            y: 1.7, // Player eye height
            z: Math.sin(angle) * radius
        };
    }

    // Update player position
    updatePlayerPosition(socketId, data) {
        const player = this.players.get(socketId);
        if (player) {
            player.position = data.position;
            player.rotation = data.rotation;
        }
    }

    // Collect penny
    collectPenny(socketId, pennyId) {
        const player = this.players.get(socketId);
        const penny = this.pennies.get(pennyId);

        if (!player || !penny || penny.collected) {
            return { success: false };
        }

        penny.collected = true;
        player.score += 1;

        return { success: true, playerScore: player.score };
    }

    // End the game
    endGame() {
        if (this.gameTimer) {
            clearInterval(this.gameTimer);
            this.gameTimer = null;
        }

        this.gamePhase = 'results';

        // Calculate winners
        const rankings = Array.from(this.players.entries())
            .map(([id, p]) => ({
                id,
                walletAddress: p.walletAddress,
                score: p.score
            }))
            .sort((a, b) => b.score - a.score);

        const winners = rankings.slice(0, 3);

        // Set cooldown for all players who played
        this.lastGamePlayers = [];
        for (const [, player] of this.players) {
            this.cooldownPlayers.add(player.walletAddress);
            this.lastGamePlayers.push(player.walletAddress);
        }

        // Emit results
        this.io.emit('game_end', {
            rankings,
            winners: winners.map((w, i) => ({
                ...w,
                place: i + 1,
                rewardPercent: i === 0 ? 50 : i === 1 ? 30 : 20
            }))
        });

        // Distribute rewards (async)
        this.distributeRewards(winners);

        // Reset for next game after delay
        setTimeout(() => {
            this.resetGame();
        }, 10000); // 10 second delay before next game
    }

    // Distribute Solana rewards
    async distributeRewards(winners) {
        try {
            console.log('\n🏆 Starting reward distribution...');

            // Actually distribute rewards via Solana
            const result = await this.solanaService.distributeRewards(winners, [50, 30, 20]);

            // Emit results to clients
            this.io.emit('rewards_distributed', {
                winners: result.results,
                success: result.success
            });

            if (result.success) {
                console.log('✅ Rewards distributed successfully!');
            } else {
                console.log('⚠️ Some rewards may not have been distributed');
            }
        } catch (error) {
            console.error('Error distributing rewards:', error);
            this.io.emit('rewards_distributed', {
                winners: [],
                success: false,
                error: error.message
            });
        }
    }

    // Reset for next game
    resetGame() {
        // Clear cooldown from previous previous game
        this.cooldownPlayers.clear();

        // Add last game players to cooldown
        for (const wallet of this.lastGamePlayers) {
            this.cooldownPlayers.add(wallet);
        }

        this.players.clear();
        this.pennies.clear();
        this.gamePhase = 'lobby';
        this.spectators.clear();

        this.io.emit('game_reset', {
            message: 'New game starting! Enter your wallet to join.',
            cooldownPlayers: this.lastGamePlayers.map(w => w.slice(0, 6) + '...')
        });
    }

    // Add spectator
    addSpectator(socketId) {
        this.spectators.add(socketId);
    }

    // Remove player
    removePlayer(socketId) {
        this.lobby.delete(socketId);
        this.players.delete(socketId);
        this.spectators.delete(socketId);
    }

    // Get lobby state
    getLobbyState() {
        return {
            players: Array.from(this.lobby.entries()).map(([id, p]) => ({
                id,
                wallet: p.walletAddress.slice(0, 6) + '...' + p.walletAddress.slice(-4)
            })),
            playerCount: this.lobby.size,
            maxPlayers: this.maxPlayers,
            timeRemaining: this.lobbyStartTime
                ? Math.max(0, this.lobbyTimerSeconds - (Date.now() - this.lobbyStartTime) / 1000)
                : this.lobbyTimerSeconds,
            gamePhase: this.gamePhase
        };
    }

    // Get game state
    getGameState() {
        return {
            phase: this.gamePhase,
            players: Array.from(this.players.entries()).map(([id, p]) => ({
                id,
                position: p.position,
                score: p.score
            })),
            penniesRemaining: Array.from(this.pennies.values()).filter(p => !p.collected).length,
            timeRemaining: this.gameStartTime
                ? Math.max(0, this.gameDurationSeconds - (Date.now() - this.gameStartTime) / 1000)
                : this.gameDurationSeconds
        };
    }

    // Get scores
    getScores() {
        return Array.from(this.players.entries())
            .map(([id, p]) => ({
                id,
                wallet: p.walletAddress.slice(0, 6) + '...',
                score: p.score
            }))
            .sort((a, b) => b.score - a.score);
    }

    // Get leaderboard
    getLeaderboard() {
        return this.getScores();
    }
}

module.exports = GameManager;
