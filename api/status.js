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
    let dueSoon = 0;
    let overdue = 0;
    let notDue = 0;

    data.forEach(entry => {
      const calibDate = new Date(entry.calibration_date);
      const interval = parseInt(entry.recalibration_interval);
      const dueDate = new Date(calibDate.setMonth(calibDate.getMonth() + interval));
      const daysUntilDue = (dueDate - now) / (1000 * 60 * 60 * 24);
      if (daysUntilDue < 0) {
        overdue++;
      } else if (daysUntilDue <= 30) {
        dueSoon++;
      } else {
        notDue++;
      }
    });

    return res.status(200).json({ due_soon: dueSoon, overdue, not_due: notDue });
  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
};

