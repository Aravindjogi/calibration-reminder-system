const { createClient } = require('@vercel/kv');

async function getKVClient() {
  try {
    return createClient({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    });
  } catch (err) {
    throw new Error('Failed to initialize KV client: ' + err.message);
  }
}

module.exports = async (req, res) => {
  try {
    const kv = await getKVClient();
    const EMAIL_LOG_KEY = 'email_log';
    let logs = (await kv.get(EMAIL_LOG_KEY)) || [];
    if (!Array.isArray(logs)) logs = [];
    return res.status(200).json(logs);
  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
};


