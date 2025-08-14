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

  try {
    const kv = await getKVClient();
    const CALIBRATION_KEY = 'calibration_data';
    let data = (await kv.get(CALIBRATION_KEY)) || [];
    if (!Array.isArray(data)) data = [];
    const now = new Date();
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS,
      },
    });

    for (const [index, entry] of data.entries()) {
      const calibDate = new Date(entry.calibration_date);
      const interval = parseInt(entry.recalibration_interval);
      const dueDate = new Date(calibDate.setMonth(calibDate.getMonth() + interval));
      const daysUntilDue = (dueDate - now) / (1000 * 60 * 60 * 24);
      const lastReminder = entry.last_reminder ? parseInt(entry.last_reminder) * 1000 : 0;
      const oneDayAgo = now.getTime() - (24 * 60 * 60 * 1000);

      if ((daysUntilDue <= 30 || daysUntilDue < 0) && (!lastReminder || lastReminder < oneDayAgo)) {
        const emails = entry.emails.split(',').map(e => e.trim());
        const type = daysUntilDue < 0 ? 'Overdue' : 'Due Soon';
        const mailOptions = {
          from: process.env.GMAIL_USER,
          to: emails,
          subject: `Calibration Reminder: ${entry.equipment_name} (${type})`,
          text: `Equipment: ${entry.equipment_name}\nSerial Number: ${entry.serial_number}\nCalibration Date: ${entry.calibration_date}\nDue Date: ${dueDate.toISOString().split('T')[0]}\nDepartment: ${entry.department}\nPlease schedule calibration.`,
        };

        try {
          await transporter.sendMail(mailOptions);
          data[index].last_reminder = Math.floor(Date.now() / 1000);
          await kv.set(CALIBRATION_KEY, data);
          await logEmail(kv, entry.equipment_name, emails, type, true);
        } catch (err) {
          await logEmail(kv, entry.equipment_name, emails, type, false);
          console.error(`Failed to send email for ${entry.equipment_name}:`, err.message);
        }
      }
    }

    return res.status(200).json({ message: 'Reminders processed' });
  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
};


