const { google } = require('googleapis');
const nodemailer = require('nodemailer');

async function getSheetsClient() {
  try {
    const auth = new google.auth.JWT({
      email: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY).client_email,
      key: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY).private_key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    return google.sheets({ version: 'v4', auth });
  } catch (err) {
    throw new Error('Failed to initialize Google Sheets client: ' + err.message);
  }
}

async function logEmail(sheets, spreadsheetId, equipmentName, emails, type, success) {
  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const values = [[timestamp, equipmentName, emails.join(','), type, success ? 'TRUE' : 'FALSE']];
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'EmailLog!A:E',
      valueInputOption: 'RAW',
      resource: { values },
    });
  } catch (err) {
    console.error('Failed to log email:', err.message);
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const sheets = await getSheetsClient();
    const spreadsheetId = process.env.SPREADSHEET_ID;
    const range = 'CalibrationData!A1:K';
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });
    const rows = response.data.values || [];
    const headers = rows.shift();
    const now = new Date();
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS,
      },
    });

    for (const [index, row] of rows.entries()) {
      const data = headers.reduce((obj, header, i) => {
        obj[header.toLowerCase().replace(/ /g, '_')] = row[i] || '';
        return obj;
      }, {});
      const calibDate = new Date(data.calibration_date);
      const interval = parseInt(data.recalibration_interval);
      const dueDate = new Date(calibDate.setMonth(calibDate.getMonth() + interval));
      const daysUntilDue = (dueDate - now) / (1000 * 60 * 60 * 24);
      const lastReminder = data.last_reminder ? parseInt(data.last_reminder) * 1000 : 0;
      const oneDayAgo = now.getTime() - (24 * 60 * 60 * 1000);

      if ((daysUntilDue <= 30 || daysUntilDue < 0) && (!lastReminder || lastReminder < oneDayAgo)) {
        const emails = data.emails.split(',').map(e => e.trim());
        const type = daysUntilDue < 0 ? 'Overdue' : 'Due Soon';
        const mailOptions = {
          from: process.env.GMAIL_USER,
          to: emails,
          subject: `Calibration Reminder: ${data.equipment_name} (${type})`,
          text: `Equipment: ${data.equipment_name}\nSerial Number: ${data.serial_number}\nCalibration Date: ${data.calibration_date}\nDue Date: ${dueDate.toISOString().split('T')[0]}\nDepartment: ${data.department}\nPlease schedule calibration.`,
        };

        try {
          await transporter.sendMail(mailOptions);
          const values = [[Math.floor(Date.now() / 1000)]];
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `CalibrationData!K${index + 2}`,
            valueInputOption: 'RAW',
            resource: { values },
          });
          await logEmail(sheets, spreadsheetId, data.equipment_name, emails, type, true);
        } catch (err) {
          await logEmail(sheets, spreadsheetId, data.equipment_name, emails, type, false);
          console.error(`Failed to send email for ${data.equipment_name}:`, err.message);
        }
      }
    }

    return res.status(200).json({ message: 'Reminders processed' });
  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
};