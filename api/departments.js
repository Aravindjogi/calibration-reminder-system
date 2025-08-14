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
    const DEPARTMENTS_KEY = 'departments';

    if (req.method === 'GET') {
      let data = (await kv.get(DEPARTMENTS_KEY)) || [];
      if (!Array.isArray(data)) data = [];
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const departments = req.body;
      if (!Array.isArray(departments)) {
        return res.status(400).json({ error: 'Expected an array of departments' });
      }
      await kv.set(DEPARTMENTS_KEY, departments);
      return res.status(200).json({ message: 'Departments saved' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
};
