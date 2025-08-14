const { createClient } = require('@vercel/kv');

async function getKVClient() {
  try {
    return createClient({
      url: process.env.https://ecfg_zerfdduvbcumr44psawcq9nnh2yb.kv.vercel-storage.com,
      token: process.env.5bf6b008a9ec05f6870c476d10b53211797aa000f95aae344ae60f9b422286da,
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

