require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

// Debug: Check all variables
console.log('=== ENVIRONMENT DEBUG ===');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL || 'NOT FOUND');
console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'OK' : 'NOT FOUND');
console.log('TIKTOK_USERNAME:', process.env.TIKTOK_USERNAME || 'NOT FOUND');
console.log('SESSION_ID:', process.env.SESSION_ID || 'NOT FOUND');
console.log('TIKTOK_SESSIONID:', process.env.TIKTOK_SESSIONID || 'NOT FOUND');
console.log('TIKTOK_TT_TARGET_IDC:', process.env.TIKTOK_TT_TARGET_IDC || 'NOT FOUND');

// Initialize Supabase admin client
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Debug: Check TikTok username
const tiktokUsername = process.env.TIKTOK_USERNAME;
if (!tiktokUsername) {
  throw new Error('TIKTOK_USERNAME is required!');
}

console.log('🚀 Starting TikTok listener for:', tiktokUsername);

// Track current auction round
let currentRound = 1;

// Load TikTokLiveConnection dynamically (ESM-only package)
(async () => {
  const TikTokLiveModule = await import('tiktok-live-connector');
  const TikTokLiveConnection = TikTokLiveModule.TikTokLiveConnection || TikTokLiveModule.default;

  console.log('TikTokLiveConnection type:', typeof TikTokLiveConnection);
  if (typeof TikTokLiveConnection !== 'function') {
    console.error('❌ TikTokLiveConnection is not a constructor');
    process.exit(1);
    return;
  }

  // Build session cookie object
  const sessionCookie = process.env.TIKTOK_SESSIONID && process.env.TIKTOK_TT_TARGET_IDC
    ? {
        type: 'cookie',
        value: {
          sessionId: process.env.TIKTOK_SESSIONID,
          ttTargetIdc: process.env.TIKTOK_TT_TARGET_IDC
        }
      }
    : undefined;

  // Create TikTok client WITH session (authenticated connection) + request headers
  const tiktokClient = new TikTokLiveConnection(tiktokUsername, {
    authenticateWs: true,
    session: sessionCookie,
    requestHeaders: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
  });

  // Handle connection events
  tiktokClient.on('connected', (data) => {
    console.log(`✅ Connected to TikTok LIVE: ${data.roomId}`);
  });

  tiktokClient.on('disconnected', () => {
    console.log('❌ Disconnected from TikTok LIVE');
  });

  // Handle error events
  tiktokClient.on('error', (err) => {
    console.error('❌ TikTok connection error:', err.message);
  });

  // Handle chat messages
  tiktokClient.on('chat', async (data) => {
    const message = data.message.trim();

    // Only process '1' or '2'
    if (message === '1' || message === '2') {
      const choice = message === '1' ? 'RAISE' : 'SURRENDER';
      const voterKey = data.uniqueId; // Use TikTok user ID as voter key

      try {
        // Insert vote into database
        const { error } = await supabase
          .from('votes')
          .insert({
            auction_id: process.env.SESSION_ID,
            voter_key: voterKey,
            choice: choice,
            round: currentRound,
            weight: 1,
            created_at: new Date().toISOString()
          });

        if (error) {
          console.error('❌ Failed to insert vote:', error);
        } else {
          console.log(`✅ Vote recorded: ${voterKey} → ${choice} (Round ${currentRound})`);
        }
      } catch (err) {
        console.error('❌ Database error:', err);
      }
    }
  });

  // Handle gift events (donations)
  tiktokClient.on('gift', async (data) => {
    const { coins, sender } = data;

    if (coins > 0) {
      try {
        const { error } = await supabase.rpc('record_donation', {
          p_session_id: process.env.SESSION_ID,
          p_external_id: `gift_${Date.now()}_${sender.uniqueId}`,
          p_donor_name: sender.uniqueId,
          p_coins: coins,
          p_time_seconds: Math.floor(coins / 20), // Rough estimate: 1 sec per 20 coins
          p_capital_added: Math.floor(coins / 100) // $1 per 100 coins
        });

        if (error) {
          console.error('❌ Failed to record donation:', error);
        } else {
          console.log(`🎁 Donation: ${sender.uniqueId} gave ${coins} coins`);
        }
      } catch (err) {
        console.error('❌ Donation error:', err);
      }
    }
  });

  // Start the client
  try {
    await tiktokClient.connect();
    console.log('🟢 Connected to TikTok LIVE!');
  } catch (connectErr) {
    console.error('❌ Failed to connect to TikTok LIVE:', connectErr.message);
    console.error('   Tips: Pastikan Anda sedang LIVE di TikTok, dan session ID valid.');
    process.exit(1);
  }

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('🛑 Shutting down...');
    tiktokClient.disconnect();
    process.exit(0);
  });
})().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});