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

  const id = req.url.split('/').pop();
  if (!id) {
    return res.status(400).json({ error: 'ID is required' });
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
    const entry = rows.find(row => row[0] === id);
    if (!entry) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    const data = headers.reduce((obj, header, index) => {
      obj[header.toLowerCase().replace(/ /g, '_')] = entry[index] || '';
      return obj;
    }, {});
    const emails = data.emails.split(',').map(e => e.trim());
    const dueDate = new Date(data.calibration_date);
    dueDate.setMonth(dueDate.getMonth() + parseInt(data.recalibration_interval));
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
      subject: `Calibration Reminder: ${data.equipment_name} (${type})`,
      text: `Equipment: ${data.equipment_name}\nSerial Number: ${data.serial_number}\nCalibration Date: ${data.calibration_date}\nDue Date: ${dueDate.toISOString().split('T')[0]}\nDepartment: ${data.department}\nPlease schedule calibration.`,
    };

    await transporter.sendMail(mailOptions);
    const rowIndex = rows.findIndex(row => row[0] === id);
    const values = [[Math.floor(Date.now() / 1000)]];
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `CalibrationData!K${rowIndex + 2}`,
      valueInputOption: 'RAW',
      resource: { values },
    });

    await logEmail(sheets, spreadsheetId, data.equipment_name, emails, type, true);
    return res.status(200).json({ message: 'Email sent and entry updated' });
  } catch (err) {
    try {
      const sheets = await getSheetsClient();
      await logEmail(sheets, process.env.SPREADSHEET_ID, data?.equipment_name || 'Unknown', emails || [], type || 'Unknown', false);
    } catch (logErr) {
      console.error('Failed to log email error:', logErr.message);
    }
    return res.status(500).json({ error: 'Failed to send email: ' + err.message });
  }
};