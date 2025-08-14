const { createClient } = require('@vercel/kv');
const nodemailer = require('nodemailer');

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

async function logEmail(kv, equipmentName, emails, type, success) {
  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const EMAIL_LOG_KEY = 'email_log';
    let logs = (await kv.get(EMAIL_LOG_KEY)) || [];
    if (!Array.isArray(logs)) logs = [];
    logs.push({ timestamp, equipment_name: equipmentName, emails: emails.join(','), type, success });
    await kv.set(EMAIL_LOG_KEY, logs);
  } catch (err) {
    console.error('Failed to log email:', err.message);
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const id = req.url.split('/').pop();
  if (!id) {
    return res.status(400).json({ error: 'ID is required' });
  }

  try {
    const kv = await getKVClient();
    const CALIBRATION_KEY = 'calibration_data';
    let data = (await kv.get(CALIBRATION_KEY)) || [];
    if (!Array.isArray(data)) data = [];
    const entry = data.find(item => item.id === id);
    if (!entry) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    const emails = entry.emails.split(',').map(e => e.trim());
    const dueDate = new Date(entry.calibration_date);
    dueDate.setMonth(dueDate.getMonth() + parseInt(entry.recalibration_interval));
    const type = dueDate < new Date() ? 'Overdue' : 'Due Soon';

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: emails,
      subject: `Calibration Reminder: ${entry.equipment_name} (${type})`,
      text: `Equipment: ${entry.equipment_name}\nSerial Number: ${entry.serial_number}\nCalibration Date: ${entry.calibration_date}\nDue Date: ${dueDate.toISOString().split('T')[0]}\nDepartment: ${entry.department}\nPlease schedule calibration.`,
    };

    await transporter.sendMail(mailOptions);
    const index = data.findIndex(item => item.id === id);
    data[index].last_reminder = Math.floor(Date.now() / 1000);
    await kv.set(CALIBRATION_KEY, data);

    await logEmail(kv, entry.equipment_name, emails, type, true);
    return res.status(200).json({ message: 'Email sent and entry updated' });
  } catch (err) {
    try {
      const kv = await getKVClient();
      await logEmail(kv, entry?.equipment_name || 'Unknown', emails || [], type || 'Unknown', false);
    } catch (logErr) {
      console.error('Failed to log email error:', logErr.message);
    }
    return res.status(500).json({ error: 'Failed to send email: ' + err.message });
  }
};


