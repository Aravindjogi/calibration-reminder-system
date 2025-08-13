const { google } = require('googleapis');

async function getSheetsClient() {
  try {
    const auth = new google.auth.JWT({
      email: JSON.parse(process.env.aravindjogi454@gmail.com).client_email,
      key: JSON.parse(process.env.zhjp lkvh xlzo jfxv).private_key,
      scopes: ['https://docs.google.com/spreadsheets/d/1ZuSEy5-wACPxWOEviLcg9ioEQgYjNVwY97N83zeMJPQ/edit?gid=0#gid=0'],
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
    const range = 'Departments!A1:B';

    if (req.method === 'GET') {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
      });
      const rows = response.data.values || [];
      const headers = rows.shift() || [];
      const data = rows.map(row => ({
        name: row[0] || '',
        emails: row[1] || '',
      }));
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const departments = req.body;
      if (!Array.isArray(departments)) {
        return res.status(400).json({ error: 'Expected an array of departments' });
      }
      const values = departments.map(dep => [dep.name, dep.emails]);
      await sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: 'Departments!A2:B',
      });
      if (values.length > 0) {
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: 'Departments!A:B',
          valueInputOption: 'RAW',
          resource: { values },
        });
      }
      return res.status(200).json({ message: 'Departments saved' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }

};
