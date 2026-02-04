export class UI {
    private lobbyScreen: HTMLElement | null;
    private gameScreen: HTMLElement | null;
    private resultsScreen: HTMLElement | null;
    private loadingScreen: HTMLElement | null;

    constructor() {
        this.lobbyScreen = document.getElementById('lobby-screen');
        this.gameScreen = document.getElementById('game-screen');
        this.resultsScreen = document.getElementById('results-screen');
        this.loadingScreen = document.getElementById('loading-screen');
    }

    showScreen(screen: 'lobby' | 'game' | 'results' | 'loading'): void {
        // Hide all screens
        this.lobbyScreen?.classList.remove('active');
        this.gameScreen?.classList.remove('active');
        this.resultsScreen?.classList.remove('active');
        this.loadingScreen?.classList.remove('active');

        // Show requested screen
        switch (screen) {
            case 'lobby':
                this.lobbyScreen?.classList.add('active');
                break;
            case 'game':
                this.gameScreen?.classList.add('active');
                break;
            case 'results':
                this.resultsScreen?.classList.add('active');
                break;
            case 'loading':
                this.loadingScreen?.classList.add('active');
                break;
        }
    }

    showMessage(message: string, type: 'success' | 'error' | 'info'): void {
        const msgEl = document.getElementById('lobby-message');
        if (msgEl) {
            msgEl.textContent = message;
            msgEl.className = 'lobby-message ' + type;

            // Auto-hide after 5 seconds
            setTimeout(() => {
                msgEl.className = 'lobby-message';
            }, 5000);
        }
    }

    updateLobby(lobbyState: any): void {
        // Update player count
        const countEl = document.getElementById('player-count');
        const maxEl = document.getElementById('max-players');
        if (countEl) countEl.textContent = lobbyState.playerCount.toString();
        if (maxEl) maxEl.textContent = lobbyState.maxPlayers.toString();

        // Update player list
        const listEl = document.getElementById('lobby-players');
        if (listEl) {
            listEl.innerHTML = '';
            lobbyState.players.forEach((player: any) => {
                const li = document.createElement('li');
                li.textContent = player.wallet;
                listEl.appendChild(li);
            });
        }
    }

    updateLobbyTimer(seconds: number): void {
        const timerEl = document.getElementById('lobby-timer');
        if (timerEl) {
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            timerEl.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
        }
    }

    updateGameTimer(seconds: number): void {
        const timerEl = document.getElementById('hud-timer');
        if (timerEl) {
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            timerEl.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;

            // Change color when low time
            if (seconds <= 10) {
                timerEl.style.color = '#ff4444';
                timerEl.style.animation = 'pulseGold 0.5s ease-in-out infinite';
            } else {
                timerEl.style.color = '';
                timerEl.style.animation = '';
            }
        }
    }

    updateScore(score: number): void {
        const scoreEl = document.getElementById('hud-score');
        if (scoreEl) {
            scoreEl.textContent = score.toString();

            // Pop animation
            scoreEl.style.transform = 'scale(1.3)';
            setTimeout(() => {
                scoreEl.style.transform = 'scale(1)';
            }, 100);
        }
    }

    updatePenniesLeft(count: number): void {
        const penniesEl = document.getElementById('hud-pennies-left');
        if (penniesEl) {
            penniesEl.textContent = count.toString();
        }
    }

    updateLeaderboard(scores: any[]): void {
        const listEl = document.getElementById('live-scores');
        if (listEl) {
            listEl.innerHTML = '';
            scores.slice(0, 5).forEach((player, index) => {
                const li = document.createElement('li');
                li.innerHTML = `
          <span>${index + 1}. ${player.wallet}</span>
          <span>${player.score} 🪙</span>
        `;
                listEl.appendChild(li);
            });
        }
    }

    showResults(rankings: any[], winners: any[]): void {
        // Podium places
        const places = ['first', 'second', 'third'];

        winners.forEach((winner, index) => {
            const walletEl = document.getElementById(`${places[index]}-wallet`);
            const scoreEl = document.getElementById(`${places[index]}-score`);

            if (walletEl) {
                walletEl.textContent = winner.walletAddress.slice(0, 6) + '...' + winner.walletAddress.slice(-4);
            }
            if (scoreEl) {
                scoreEl.textContent = `${winner.score} 🪙`;
            }
        });

        // Full rankings
        const rankingsEl = document.getElementById('final-rankings');
        if (rankingsEl) {
            rankingsEl.innerHTML = '';
            rankings.forEach((player, index) => {
                const li = document.createElement('li');
                const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';
                li.innerHTML = `
          <span>${index + 1}. ${medal} ${player.walletAddress.slice(0, 6)}...${player.walletAddress.slice(-4)}</span>
          <span>${player.score} 🪙</span>
        `;
                rankingsEl.appendChild(li);
            });
        }

        // Next game countdown
        this.startNextGameCountdown(10);
    }

    private startNextGameCountdown(seconds: number): void {
        const timerEl = document.querySelector('#next-game-timer span');
        let remaining = seconds;

        const interval = setInterval(() => {
            remaining--;
            if (timerEl) {
                timerEl.textContent = remaining.toString();
            }

            if (remaining <= 0) {
                clearInterval(interval);
                const playAgainBtn = document.getElementById('play-again-btn') as HTMLButtonElement;
                if (playAgainBtn) {
                    playAgainBtn.disabled = false;
                }
            }
        }, 1000);
    }

    showCooldownMessage(message: string): void {
        const msgEl = document.getElementById('cooldown-message');
        const playAgainBtn = document.getElementById('play-again-btn') as HTMLButtonElement;

        if (msgEl) {
            msgEl.textContent = message;
        }

        if (playAgainBtn) {
            playAgainBtn.disabled = true;
        }
    }

    // Show reward distribution results with Solscan links
    showRewardResults(results: Array<{
        place: number;
        wallet: string;
        amount: number;
        success: boolean;
        txUrl: string | null;
        simulated: boolean;
        error: string | null;
    }>): void {
        // Create a modal/overlay to show reward results
        let overlay = document.getElementById('reward-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'reward-overlay';
            overlay.className = 'reward-overlay';
            document.body.appendChild(overlay);
        }

        let html = `
            <div class="reward-modal">
                <h2>🎉 Rewards Distributed!</h2>
                <div class="reward-list">
        `;

        for (const result of results) {
            const medal = result.place === 1 ? '🥇' : result.place === 2 ? '🥈' : '🥉';
            const walletShort = result.wallet.slice(0, 6) + '...' + result.wallet.slice(-4);
            const statusIcon = result.success ? '✅' : '❌';
            const statusText = result.simulated ? '(Simulated)' : result.success ? 'Sent!' : result.error || 'Failed';

            html += `
                <div class="reward-item ${result.success ? 'success' : 'failed'}">
                    <div class="reward-place">${medal} #${result.place}</div>
                    <div class="reward-wallet">${walletShort}</div>
                    <div class="reward-amount">${result.amount.toFixed(6)} SOL</div>
                    <div class="reward-status">${statusIcon} ${statusText}</div>
                    ${result.txUrl ? `<a href="${result.txUrl}" target="_blank" class="reward-link">🔗 View on Solscan</a>` : ''}
                </div>
            `;
        }

        html += `
                </div>
                <button class="reward-close-btn" onclick="document.getElementById('reward-overlay').style.display='none'">Close</button>
            </div>
        `;

        overlay.innerHTML = html;
        overlay.style.display = 'flex';

        // Auto-hide after 15 seconds
        setTimeout(() => {
            if (overlay) overlay.style.display = 'none';
        }, 15000);
    }

    // Voice chat UI methods
    updateVoiceStatus(inVoice: boolean, muted: boolean): void {
        const voiceBtn = document.getElementById('voice-btn');
        const muteBtn = document.getElementById('mute-btn');
        const voiceIndicator = document.getElementById('voice-indicator');

        if (voiceBtn) {
            voiceBtn.textContent = inVoice ? '🔇 Leave Voice' : '🎤 Join Voice';
            voiceBtn.classList.toggle('active', inVoice);
        }

        if (muteBtn) {
            muteBtn.style.display = inVoice ? 'block' : 'none';
            muteBtn.textContent = muted ? '🔇 Unmute' : '🎤 Mute';
            muteBtn.classList.toggle('muted', muted);
        }

        if (voiceIndicator) {
            voiceIndicator.style.display = inVoice ? 'flex' : 'none';
            voiceIndicator.classList.toggle('muted', muted);
            voiceIndicator.innerHTML = muted 
                ? '<span class="voice-icon">🔇</span> Muted'
                : '<span class="voice-icon">🎤</span> Voice Active';
        }
    }

    updateVoicePeerMuted(peerId: string, muted: boolean): void {
        // Could update a voice participants list UI here
        console.log(`Peer ${peerId} ${muted ? 'muted' : 'unmuted'}`);
    }

    // Update results to show proportional rewards
    showResultsWithProportional(rankings: any[], winners: any[], totalTop3Coins: number): void {
        // Podium places
        const places = ['first', 'second', 'third'];

        winners.forEach((winner, index) => {
            const walletEl = document.getElementById(`${places[index]}-wallet`);
            const scoreEl = document.getElementById(`${places[index]}-score`);
            const rewardEl = document.querySelector(`#results-screen .podium-place.${places[index]} .place-reward`);

            if (walletEl) {
                walletEl.textContent = winner.walletAddress.slice(0, 6) + '...' + winner.walletAddress.slice(-4);
            }
            if (scoreEl) {
                scoreEl.textContent = `${winner.score} 🪙`;
            }
            if (rewardEl) {
                // Show proportional percentage
                const percent = totalTop3Coins > 0 
                    ? Math.round((winner.score / totalTop3Coins) * 100)
                    : Math.round(100 / winners.length);
                rewardEl.textContent = `${percent}% SOL`;
            }
        });

        // Hide unused podium places if less than 3 winners
        for (let i = winners.length; i < 3; i++) {
            const placeEl = document.querySelector(`#results-screen .podium-place.${places[i]}`);
            if (placeEl) {
                (placeEl as HTMLElement).style.display = 'none';
            }
        }

        // Full rankings
        const rankingsEl = document.getElementById('final-rankings');
        if (rankingsEl) {
            rankingsEl.innerHTML = '';
            rankings.forEach((player, index) => {
                const li = document.createElement('li');
                const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';
                const isTop3 = index < 3;
                const rewardInfo = isTop3 && totalTop3Coins > 0
                    ? ` (${Math.round((player.score / totalTop3Coins) * 100)}% reward)`
                    : '';
                li.innerHTML = `
          <span>${index + 1}. ${medal} ${player.walletAddress.slice(0, 6)}...${player.walletAddress.slice(-4)}</span>
          <span>${player.score} 🪙${rewardInfo}</span>
        `;
                rankingsEl.appendChild(li);
            });
        }

        // Next game countdown
        this.startNextGameCountdown(10);
    }
}
