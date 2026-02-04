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

        if (!winners || winners.length === 0) {
            return { success: false, error: 'No winners to reward' };
        }

        console.log(`\n💳 SOLANA SERVICE: Distributing rewards to ${winners.length} winners`);
        let successCount = 0;

        try {
            // Check balance first
            const balance = await this.connection.getBalance(this.rewardWallet.publicKey);
            console.log(`💳 Wallet Balance: ${balance / LAMPORTS_PER_SOL} SOL`);

            // Total pool (this logic might need adjustment based on how 'pool' is defined, 
            // for now assume we send a fixed amount per game or based on accumulation)
            // But here we use 'rewardPercents' to distribute the FEE_RESERVE_SOL (or a specific pool amount)
            // WARNING: The previous logic sent 0.05 * percent. Let's make it clearer.
            // Let's assume the TOTAL reward pool for this round is 0.1 SOL (example) or derived from fees.
            // For this implementation, we'll keep the logic simple: distribute a fixed pot of e.g. 0.05 SOL
            const TOTAL_POT = 0.05;
            console.log(`💰 Total Pot for this round: ${TOTAL_POT} SOL`);

            for (let i = 0; i < winners.length; i++) {
                const winner = winners[i];
                const percent = rewardPercents[i]; // 0-100
                const amountSOL = (TOTAL_POT * percent) / 100;

                console.log(`   Processing Winner #${i + 1}: ${winner.walletAddress}`);
                console.log(`      Share: ${percent.toFixed(2)}% -> ${amountSOL.toFixed(6)} SOL`);

                if (amountSOL < 0.000001) {
                    console.log('      ⚠️ Amount too small, skipping.');
                    results.push({ wallet: winner.walletAddress, status: 'skipped_too_small', amount: amountSOL });
                    continue;
                }

                try {
                    const signature = await this.sendSOL(winner.walletAddress, amountSOL);
                    console.log(`      ✅ Sent! Sig: ${signature}`);
                    results.push({ wallet: winner.walletAddress, status: 'sent', signature, amount: amountSOL });
                    successCount++;
                } catch (err) {
                    console.error(`      ❌ Failed to send to ${winner.walletAddress}:`, err.message);
                    results.push({ wallet: winner.walletAddress, status: 'failed', error: err.message, amount: amountSOL });
                }
            }

            return {
                success: successCount > 0,
                results,
                totalDistributed: results.filter(r => r.status === 'sent').reduce((acc, r) => acc + r.amount, 0)
            };

        } catch (error) {
            console.error('💳 SOLANA SERVICE ERROR:', error);
            return { success: false, error: error.message };
        }
    }

    // New method to send a direct SOL amount (inferred from the user's requested change)
    async sendSOL(recipientAddress, amountSOL) {
        if (!this.rewardWallet) {
            console.log(`[SIMULATED] Sending ${amountSOL.toFixed(6)} SOL to ${recipientAddress}`);
            return 'SIMULATED_TX_SIGNATURE'; // Return a dummy signature for simulation
        }

        try {
            const lamports = Math.floor(amountSOL * LAMPORTS_PER_SOL);

            if (lamports <= 0) {
                throw new Error('Amount too small to send');
            }

            if (!this.isValidAddress(recipientAddress)) {
                throw new Error('Invalid recipient address');
            }

            const recipientPubkey = new PublicKey(recipientAddress);
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

            const signature = await this.connection.sendTransaction(transaction, [this.rewardWallet]);
            await this.connection.confirmTransaction(signature, 'confirmed');

            return signature;
        } catch (error) {
            console.error('Error in sendSOL:', error.message);
            throw error; // Re-throw to be caught by distributeRewards
        }
    }
}

module.exports = SolanaService;
