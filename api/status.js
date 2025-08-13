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
    let dueSoon = 0;
    let overdue = 0;
    let notDue = 0;

    rows.forEach(row => {
      const data = headers.reduce((obj, header, index) => {
        obj[header.toLowerCase().replace(/ /g, '_')] = row[index] || '';
        return obj;
      }, {});
      const calibDate = new Date(data.calibration_date);
      const interval = parseInt(data.recalibration_interval);
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