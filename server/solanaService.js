const { Connection, Keypair, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } = require('@solana/web3.js');

class SolanaService {
    constructor() {
        this.apiKey = process.env.HELIUS_API_KEY;
        this.rpcUrl = this.apiKey && this.apiKey !== 'your_helius_api_key_here'
            ? `https://mainnet.helius-rpc.com/?api-key=${this.apiKey}`
            : 'https://api.mainnet-beta.solana.com';
        this.connection = null;
        this.rewardWallet = null;

        // Fee configuration (in SOL)
        this.feeReserve = parseFloat(process.env.FEE_RESERVE_SOL) || 0.01; // Keep 0.01 SOL for transaction fees

        this.initialize();
    }

    initialize() {
        try {
            this.connection = new Connection(this.rpcUrl, 'confirmed');

            // Load reward wallet if private key exists
            const privateKey = process.env.REWARD_WALLET_PRIVATE_KEY;
            if (privateKey && privateKey !== 'your_wallet_private_key_here') {
                try {
                    // Try base58 decode first
                    const bs58 = require('bs58');
                    const secretKey = bs58.decode(privateKey);
                    this.rewardWallet = Keypair.fromSecretKey(secretKey);
                    console.log('💰 Reward wallet loaded:', this.rewardWallet.publicKey.toString());
                } catch (e) {
                    // Try JSON array format
                    try {
                        const secretKeyArray = JSON.parse(privateKey);
                        this.rewardWallet = Keypair.fromSecretKey(Uint8Array.from(secretKeyArray));
                        console.log('💰 Reward wallet loaded:', this.rewardWallet.publicKey.toString());
                    } catch (e2) {
                        console.error('❌ Failed to load reward wallet - invalid private key format');
                    }
                }
            } else {
                console.log('⚠️ No reward wallet configured - rewards will be simulated');
            }
        } catch (error) {
            console.error('Failed to initialize Solana service:', error);
        }
    }

    // Validate a Solana wallet address
    isValidAddress(address) {
        try {
            new PublicKey(address);
            return true;
        } catch {
            return false;
        }
    }

    // Get wallet balance
    async getBalance(address) {
        try {
            const publicKey = new PublicKey(address);
            const balance = await this.connection.getBalance(publicKey);
            return balance / LAMPORTS_PER_SOL;
        } catch (error) {
            console.error('Error getting balance:', error);
            return 0;
        }
    }

    // Get reward pool balance
    async getRewardPoolBalance() {
        if (!this.rewardWallet) return 0;
        return await this.getBalance(this.rewardWallet.publicKey.toString());
    }

    // Get distributable amount (total - fee reserve)
    async getDistributableAmount() {
        const totalBalance = await this.getRewardPoolBalance();
        const distributable = Math.max(0, totalBalance - this.feeReserve);
        return {
            total: totalBalance,
            feeReserve: this.feeReserve,
            distributable: distributable
        };
    }

    // Send reward to winner
    async sendReward(recipientAddress, percentOfDistributable) {
        if (!this.rewardWallet) {
            console.log(`[SIMULATED] Sending ${percentOfDistributable}% of pool to ${recipientAddress}`);
            return { success: true, simulated: true, amount: 0 };
        }

        try {
            // Get distributable amount (excluding fee reserve)
            const { distributable, total, feeReserve } = await this.getDistributableAmount();

            console.log(`💰 Pool Status: Total=${total.toFixed(4)} SOL, Reserved for fees=${feeReserve} SOL, Distributable=${distributable.toFixed(4)} SOL`);

            if (distributable <= 0) {
                console.log('⚠️ Insufficient distributable balance (need to keep fee reserve)');
                return { success: false, error: 'Insufficient balance after fee reserve' };
            }

            const rewardAmount = (distributable * percentOfDistributable) / 100;
            const lamports = Math.floor(rewardAmount * LAMPORTS_PER_SOL);

            if (lamports <= 0) {
                console.log('⚠️ Reward amount too small to send');
                return { success: false, error: 'Reward amount too small' };
            }

            // Validate recipient address
            if (!this.isValidAddress(recipientAddress)) {
                console.log('❌ Invalid recipient address:', recipientAddress);
                return { success: false, error: 'Invalid recipient address' };
            }

            const recipientPubkey = new PublicKey(recipientAddress);

            // Get recent blockhash
            const { blockhash } = await this.connection.getLatestBlockhash();

            const transaction = new Transaction().add(
                SystemProgram.transfer({
                    fromPubkey: this.rewardWallet.publicKey,
                    toPubkey: recipientPubkey,
                    lamports
                })
            );

            transaction.recentBlockhash = blockhash;
            transaction.feePayer = this.rewardWallet.publicKey;

            // Sign and send transaction
            const signature = await this.connection.sendTransaction(transaction, [this.rewardWallet]);

            // Wait for confirmation
            console.log(`⏳ Waiting for confirmation... TX: ${signature}`);
            const confirmation = await this.connection.confirmTransaction(signature, 'confirmed');

            if (confirmation.value.err) {
                console.log('❌ Transaction failed:', confirmation.value.err);
                return { success: false, error: confirmation.value.err };
            }

            console.log(`✅ Sent ${rewardAmount.toFixed(4)} SOL to ${recipientAddress}`);
            console.log(`   Transaction: https://solscan.io/tx/${signature}`);

            return {
                success: true,
                signature,
                amount: rewardAmount,
                txUrl: `https://solscan.io/tx/${signature}`
            };
        } catch (error) {
            console.error('Error sending reward:', error.message);
            return { success: false, error: error.message };
        }
    }

    // Distribute rewards to top players (supports 1-3 winners with proportional rewards)
    async distributeRewards(winners, rewardPercents) {
        const results = [];

        // Get pool info first
        const poolInfo = await this.getDistributableAmount();
        console.log('\n🏆 === DISTRIBUTING REWARDS ===');
        console.log(`   Pool Total: ${poolInfo.total.toFixed(4)} SOL`);
        console.log(`   Fee Reserve: ${poolInfo.feeReserve} SOL`);
        console.log(`   Distributable: ${poolInfo.distributable.toFixed(4)} SOL`);
        console.log(`   Winners: ${winners.length}`);

        if (poolInfo.distributable <= 0) {
            console.log('❌ No funds available for distribution');
            return { success: false, results: [], error: 'Insufficient funds' };
        }

        // Handle any number of winners (1, 2, or 3)
        const numWinners = Math.min(winners.length, 3);
        
        // Normalize percentages to ensure they sum to 100%
        const totalPercent = rewardPercents.slice(0, numWinners).reduce((a, b) => a + b, 0);
        const normalizedPercents = rewardPercents.slice(0, numWinners).map(p => (p / totalPercent) * 100);

        for (let i = 0; i < numWinners; i++) {
            const winner = winners[i];
            const percent = normalizedPercents[i];

            console.log(`\n🎖️ Place ${i + 1}: ${winner.walletAddress.slice(0, 8)}... (${percent.toFixed(2)}% of pool)`);
            console.log(`   Coins collected: ${winner.score}`);

            const result = await this.sendReward(winner.walletAddress, percent);
            results.push({
                place: i + 1,
                wallet: winner.walletAddress,
                percent: percent,
                coins: winner.score,
                ...result
            });

            // Small delay between transactions to avoid rate limits
            if (i < numWinners - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        console.log('\n🏆 === DISTRIBUTION COMPLETE ===\n');

        return {
            success: results.some(r => r.success),
            results
        };
    }
}

module.exports = SolanaService;
