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
        this.feeReserve = parseFloat(process.env.FEE_RESERVE_SOL) || 0.01;

        // Total reward pool per game (in SOL) - configurable via env
        this.rewardPoolPerGame = parseFloat(process.env.REWARD_POOL_PER_GAME) || 0.05;

        this.initialize();
    }

    initialize() {
        try {
            this.connection = new Connection(this.rpcUrl, 'confirmed');
            console.log('🌐 Connected to Solana RPC:', this.rpcUrl.includes('helius') ? 'Helius RPC' : 'Public RPC');

            // Load reward wallet if private key exists
            let privateKey = process.env.REWARD_WALLET_PRIVATE_KEY;

            // Debug: Log raw private key info
            console.log('\n🔑 ═══════════════════════════════════════');
            console.log('🔑 PRIVATE KEY DEBUG INFO');
            console.log('🔑 ═══════════════════════════════════════');
            console.log('   Raw value exists:', !!privateKey);
            console.log('   Raw value type:', typeof privateKey);
            console.log('   Raw value length:', privateKey ? privateKey.length : 0);
            console.log('   Raw value (first 20 chars):', privateKey ? privateKey.substring(0, 20) + '...' : 'N/A');
            console.log('   Raw value (last 10 chars):', privateKey ? '...' + privateKey.substring(privateKey.length - 10) : 'N/A');
            console.log('   Starts with "[":', privateKey ? privateKey.startsWith('[') : false);
            console.log('   Contains quotes:', privateKey ? (privateKey.includes('"') || privateKey.includes("'")) : false);
            console.log('🔑 ═══════════════════════════════════════\n');

            if (privateKey && privateKey !== 'your_wallet_private_key_here') {
                // Remove whitespace/newlines which usually cause decode errors
                privateKey = privateKey.trim();
                
                // Remove surrounding quotes if present (common .env issue)
                if ((privateKey.startsWith('"') && privateKey.endsWith('"')) ||
                    (privateKey.startsWith("'") && privateKey.endsWith("'"))) {
                    console.log('⚠️ Removing surrounding quotes from private key');
                    privateKey = privateKey.slice(1, -1);
                }

                console.log('   After trim/cleanup length:', privateKey.length);
                console.log('   After cleanup (first 20 chars):', privateKey.substring(0, 20) + '...');

                try {
                    // Try base58 decode first
                    const bs58 = require('bs58');
                    console.log('   bs58 module type:', typeof bs58);
                    console.log('   bs58.decode type:', typeof bs58.decode);
                    console.log('   bs58.default?.decode type:', typeof bs58.default?.decode);
                    
                    // Handle potential ESM/CommonJS import mismatch for bs58 v6+
                    const decode = bs58.decode || bs58.default?.decode || bs58;

                    if (typeof decode !== 'function') {
                        throw new Error(`bs58.decode is not a function. Got: ${typeof decode}`);
                    }

                    const secretKey = decode(privateKey);
                    console.log('   Decoded secret key length:', secretKey.length, '(expected: 64)');
                    
                    this.rewardWallet = Keypair.fromSecretKey(secretKey);

                    console.log('💰 Reward wallet loaded successfully!');
                    console.log('   Public Key:', this.rewardWallet.publicKey.toString());

                    // Check balance on startup
                    this.getBalance(this.rewardWallet.publicKey.toString()).then(balance => {
                        console.log(`   Balance: ${balance.toFixed(4)} SOL`);
                        if (balance < this.rewardPoolPerGame + this.feeReserve) {
                            console.warn(`⚠️ Warning: Low balance! Need at least ${(this.rewardPoolPerGame + this.feeReserve).toFixed(4)} SOL`);
                        }
                    });

                } catch (e) {
                    // Log the base58 error to help debug
                    console.warn(`⚠️ Base58 decode failed: ${e.message}. Trying JSON format...`);

                    // Try JSON array format
                    try {
                        const secretKeyArray = JSON.parse(privateKey);
                        this.rewardWallet = Keypair.fromSecretKey(Uint8Array.from(secretKeyArray));
                        console.log('💰 Reward wallet loaded (JSON format):', this.rewardWallet.publicKey.toString());
                    } catch (e2) {
                        console.error('❌ Failed to load reward wallet');
                        console.error('   Error 1 (Base58):', e.message);
                        console.error('   Error 2 (JSON):', e2.message);
                        console.error('   Key length:', privateKey.length);
                        console.error('   First 5 chars:', privateKey.substring(0, 5));
                    }
                }
            } else {
                console.log('⚠️ No reward wallet configured - rewards will be SIMULATED');
                console.log('   Set REWARD_WALLET_PRIVATE_KEY in .env to enable real rewards');
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

    // Send SOL to a recipient
    async sendSOL(recipientAddress, amountSOL) {
        if (!this.rewardWallet) {
            console.log(`[SIMULATED] Would send ${amountSOL.toFixed(6)} SOL to ${recipientAddress}`);
            return {
                success: true,
                simulated: true,
                amount: amountSOL,
                signature: 'SIMULATED_' + Date.now(),
                txUrl: null
            };
        }

        try {
            const lamports = Math.floor(amountSOL * LAMPORTS_PER_SOL);

            if (lamports <= 0) {
                return { success: false, error: 'Amount too small to send' };
            }

            if (!this.isValidAddress(recipientAddress)) {
                return { success: false, error: 'Invalid recipient address' };
            }

            // Check balance
            const balance = await this.getBalance(this.rewardWallet.publicKey.toString());
            if (balance < amountSOL + 0.001) { // 0.001 SOL for tx fee
                console.error(`❌ Insufficient balance: ${balance.toFixed(4)} SOL, need ${(amountSOL + 0.001).toFixed(4)} SOL`);
                return { success: false, error: 'Insufficient balance in reward wallet' };
            }

            const recipientPubkey = new PublicKey(recipientAddress);
            const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('confirmed');

            const transaction = new Transaction().add(
                SystemProgram.transfer({
                    fromPubkey: this.rewardWallet.publicKey,
                    toPubkey: recipientPubkey,
                    lamports
                })
            );

            transaction.recentBlockhash = blockhash;
            transaction.feePayer = this.rewardWallet.publicKey;

            // Sign and send
            console.log(`📤 Sending ${amountSOL.toFixed(6)} SOL to ${recipientAddress.slice(0, 8)}...`);
            const signature = await this.connection.sendTransaction(transaction, [this.rewardWallet], {
                skipPreflight: false,
                preflightCommitment: 'confirmed'
            });

            // Wait for confirmation with timeout
            console.log(`⏳ Waiting for confirmation... TX: ${signature}`);
            const confirmation = await this.connection.confirmTransaction({
                signature,
                blockhash,
                lastValidBlockHeight
            }, 'confirmed');

            if (confirmation.value.err) {
                console.error('❌ Transaction failed:', confirmation.value.err);
                return { success: false, error: 'Transaction failed on chain', signature };
            }

            const txUrl = `https://solscan.io/tx/${signature}`;
            console.log(`✅ Sent ${amountSOL.toFixed(6)} SOL to ${recipientAddress.slice(0, 8)}...`);
            console.log(`   🔗 ${txUrl}`);

            return {
                success: true,
                signature,
                amount: amountSOL,
                txUrl
            };
        } catch (error) {
            console.error('Error sending SOL:', error.message);
            return { success: false, error: error.message };
        }
    }

    // Distribute rewards to top players with proportional rewards
    async distributeRewards(winners, rewardPercents) {
        const results = [];

        console.log('\n🏆 ═══════════════════════════════════════');
        console.log('🏆 DISTRIBUTING REWARDS');
        console.log('🏆 ═══════════════════════════════════════');

        if (!winners || winners.length === 0) {
            console.log('❌ No winners to reward');
            return { success: false, results: [], error: 'No winners' };
        }

        // Get current balance
        const balance = await this.getRewardPoolBalance();
        console.log(`💰 Reward Wallet Balance: ${balance.toFixed(4)} SOL`);
        console.log(`💰 Reward Pool Per Game: ${this.rewardPoolPerGame} SOL`);
        console.log(`👥 Winners: ${winners.length}`);

        // Check if we have enough balance
        const totalNeeded = this.rewardPoolPerGame + this.feeReserve;
        if (balance < totalNeeded && this.rewardWallet) {
            console.error(`❌ Insufficient balance! Have: ${balance.toFixed(4)} SOL, Need: ${totalNeeded.toFixed(4)} SOL`);
            return {
                success: false,
                results: [],
                error: `Insufficient balance. Need ${totalNeeded.toFixed(4)} SOL but only have ${balance.toFixed(4)} SOL`
            };
        }

        // Normalize percentages to ensure they sum to 100%
        const numWinners = Math.min(winners.length, 3);
        const totalPercent = rewardPercents.slice(0, numWinners).reduce((a, b) => a + b, 0);

        console.log('\n📊 Reward Distribution:');

        for (let i = 0; i < numWinners; i++) {
            const winner = winners[i];
            const rawPercent = rewardPercents[i];
            const normalizedPercent = (rawPercent / totalPercent) * 100;
            const amountSOL = (this.rewardPoolPerGame * normalizedPercent) / 100;

            console.log(`\n🎖️ Place ${i + 1}: ${winner.walletAddress}`);
            console.log(`   Coins: ${winner.score}`);
            console.log(`   Share: ${normalizedPercent.toFixed(2)}%`);
            console.log(`   Amount: ${amountSOL.toFixed(6)} SOL`);

            const result = await this.sendSOL(winner.walletAddress, amountSOL);

            results.push({
                place: i + 1,
                wallet: winner.walletAddress,
                coins: winner.score,
                percent: normalizedPercent,
                amount: amountSOL,
                success: result.success,
                signature: result.signature || null,
                txUrl: result.txUrl || null,
                simulated: result.simulated || false,
                error: result.error || null
            });

            // Small delay between transactions
            if (i < numWinners - 1 && result.success && !result.simulated) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        const successCount = results.filter(r => r.success).length;
        const totalDistributed = results.filter(r => r.success).reduce((sum, r) => sum + r.amount, 0);

        console.log('\n🏆 ═══════════════════════════════════════');
        console.log(`🏆 DISTRIBUTION COMPLETE`);
        console.log(`   ✅ Successful: ${successCount}/${numWinners}`);
        console.log(`   💰 Total Distributed: ${totalDistributed.toFixed(6)} SOL`);
        console.log('🏆 ═══════════════════════════════════════\n');

        return {
            success: successCount > 0,
            results,
            totalDistributed,
            successCount
        };
    }
}

module.exports = SolanaService;
