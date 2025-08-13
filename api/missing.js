const { google } = require('googleapis');

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

module.exports = async (req, res) => {
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
    const overdue = [];

    rows.forEach(row => {
      const data = headers.reduce((obj, header, index) => {
        obj[header.toLowerCase().replace(/ /g, '_')] = row[index] || '';
        return obj;
      }, {});
      const calibDate = new Date(data.calibration_date);
      const interval = parseInt(data.recalibration_interval);
      const dueDate = new Date(calibDate.setMonth(calibDate.getMonth() + interval));
      if (dueDate < now) {
        overdue.push({
          equipment_name: data.equipment_name,
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