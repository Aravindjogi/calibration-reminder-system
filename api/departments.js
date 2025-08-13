const { google } = require('googleapis');

async function getSheetsClient() {
  try {
    const auth = new google.auth.JWT({
      email: JSON.parse(process.env."calib2001@calibrationremindersystem.iam.gserviceaccount.com).client_email,
      key: JSON.parse(process.env.  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEuwIBADANBgkqhkiG9w0BAQEFAASCBKUwggShAgEAAoIBAQDHZFKRR3cGCvrw\n7OQm9jf5KKk9JcBzUBOKohTSCVb8ag/mX5Ukpa2KzEra6o1ip6/4ovpDO3YXjAHA\nQwpB0D9dxSCiUOW6I9N5gjZckJPwJbtR1AYCYiXsY/oU9wZCn7tUMrJLU6ZkZ2bd\nA0UDrkFrFNjAlg0Nu2LW8r8Xzm//w94dWKzdYVkrTnkYK9EbX2ONB39NXmpnKLK5\nYWWg6Y0t+OQBz1zRh3LD4k5BG4iIscIpLWMtAhRnvNaPHTRxFT3DCzOS+1QKhj6Z\n7j86X3bmBk53RC8HtEFRouLFuHOoXNbGhHz5PxTi9PpllqkQc981z9i3G96hG+fX\neCLVj0QFAgMBAAECgf4y67uiL7QSKOQ7SfGcr9g5nTodUjlHN3KPXm2lPOWETEdO\n9FtlcJ6RGuBMb/bBas1XCK6oYOaLzJmpRotgrpse8S/7BleO/RcYFlfKyz5n2tU3\nRWUXcEfMMiXiZ1C9tgMMd3ASz5KTC9UX1c8HOisPNVMrx6JeEItMODuWjqdzU+Eu\n9RoUc700hryfoPtaNKv/njU1xBh7KvbTpBL8EaQin3jxoXIAyHtbDMyLKlxkW4GI\naZ/yTEn4o0Pdin7rp+lMdJInMm7rCcdIfuCtB5FZSSWcfVAXBD+liCIRxXy1X2Z1\nc9tw4OFsIN/iT7fLWgGGVlTkvUxqxrFkSsf/+wKBgQDp1UKpGmv2rwjbq3SxqXHD\nFgUtnWV0xy/PDIOcZMBOuDWFaw/ksM0XUD97ZyGtpa9bzPGMY/1rODAs/fG2/W9i\n7zed5rm3LfgEq0iRdd7uzAB9/E99rWnGd5BmXrAyVOOndbCdgzUFf5UEReNxm4UV\nw09PI8C9JhZ1YNgPwzq9HwKBgQDaSzt5FRZNOG1MlqeyXx/YuoiCILY71mhe/7Ix\nrMhO1wQiMCYcBc32BhQ9HVgqvHZeFlVUpoR+0XDHoeQ8Pa+/FdC/qleCXnNDRsrf\n0tmNeCf/Bjr5798GPVcwOTt0HBbX/9U4QSReChOesPO0gjlaA9VZyAqdoCAZfLUd\ncYa2WwKBgQDIdG/e862WHdskJcm1/CJwMVJjFklBYPhVMM8qpRxO34/SPkOzsvU+\nhSbGrVSrvhukQP7ZcWZwIgz6pQAv9PcmAxjUnlSa+idiKUvelwN0ByJs3n1uqdjB\nsQHzID1ACJHYnwW3IiG0AvlGXntqiv39+B7nIyk5fYtHOKxAZwbV1QKBgQC9YPc/\nnGO0qndoMmtZ+9yNEYbMHcT7NI9nmzzki5lbjH4xisQFG6QLBEsamhKbQNUP2yA8\nSBo6S0kkZ/axrHKDvFFVdlpk57vnacsnUq0aZluMi8MugkNiDmVNmNlTaesHiRNZ\nsmnyi5tp2OoUd8V5qkm1ki5jgT9X3TDjUlIkcQKBgBNEdz7imkiS5Q1GlzI3pQ/l\nIvRJVwnTVzFgw5p3+x0rFUfhbYyJy1w4z+O1/xQXuzrT9PDVCycEDmQhD2A6jZAK\nkFTGyg91zaVooCGWIHIebk+Uy5YifWus2qaPC25FdmXbrGHBvge8FreGI9+k9jvS\nTSIfx9IDVnJUzXpIFwY0\n-----END PRIVATE KEY-----\n",
).private_key,
      scopes: ['https://docs.google.com/spreadsheets/d/1tVUDv4urxLxTjHGv5X_ttpZ7oL1DpJR_aPlpfCOPxPY/edit?gid=0#gid=0'],
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
