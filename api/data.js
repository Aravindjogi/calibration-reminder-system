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
    const CALIBRATION_KEY = 'calibration_data';

    if (req.method === 'GET') {
      const download = req.query.download === 'true';
      let data = (await kv.get(CALIBRATION_KEY)) || [];
      if (!Array.isArray(data)) data = [];
      if (download) {
        res.setHeader('Content-Disposition', 'attachment; filename=calibration_data.json');
        res.setHeader('Content-Type', 'application/json');
      }
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const data = req.body;
      if (!data.id || !data.equipment_name || !data.make || !data.manufactured || !data.serial_number || !data.calibration_date || !data.number_of_instruments || !data.department || !data.emails || !data.recalibration_interval) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      let currentData = (await kv.get(CALIBRATION_KEY)) || [];
      if (!Array.isArray(currentData)) currentData = [];
      currentData.push(data);
      await kv.set(CALIBRATION_KEY, currentData);
      return res.status(200).json({ message: 'Data saved' });
    }

    if (req.method === 'PUT') {
      const data = req.body;
      if (!data.id) {
        return res.status(400).json({ error: 'ID is required' });
      }
      let currentData = (await kv.get(CALIBRATION_KEY)) || [];
      if (!Array.isArray(currentData)) currentData = [];
      const index = currentData.findIndex(item => item.id === data.id);
      if (index === -1) {
        return res.status(404).json({ error: 'Entry not found' });
      }
      currentData[index] = data;
      await kv.set(CALIBRATION_KEY, currentData);
      return res.status(200).json({ message: 'Data updated' });
    }

    if (req.method === 'DELETE') {
      const { id, all } = req.body;
      if (all) {
        await kv.set(CALIBRATION_KEY, []);
        return res.status(200).json({ message: 'All data cleared' });
      }
      if (!id) {
        return res.status(400).json({ error: 'ID is required' });
      }
      let currentData = (await kv.get(CALIBRATION_KEY)) || [];
      if (!Array.isArray(currentData)) currentData = [];
      const index = currentData.findIndex(item => item.id === id);
      if (index === -1) {
        return res.status(404).json({ error: 'Entry not found' });
      }
      currentData.splice(index, 1);
      await kv.set(CALIBRATION_KEY, currentData);
      return res.status(200).json({ message: 'Data deleted' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
};

