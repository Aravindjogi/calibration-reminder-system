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
    let data = (await kv.get(CALIBRATION_KEY)) || [];
    if (!Array.isArray(data)) data = [];
    const now = new Date();
    const overdue = [];

    data.forEach(entry => {
      const calibDate = new Date(entry.calibration_date);
      const interval = parseInt(entry.recalibration_interval);
      const dueDate = new Date(calibDate.setMonth(calibDate.getMonth() + interval));
      if (dueDate < now) {
        overdue.push({
          equipment_name: entry.equipment_name,
          due_date: dueDate.toISOString().split('T')[0],
        });
      }
    });

    if (req.query.download === 'true') {
      res.setHeader('Content-Disposition', 'attachment; filename=overdue_instruments.json');
      res.setHeader('Content-Type', 'application/json');
    }
    return res.status(200).json(overdue);
  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
};

