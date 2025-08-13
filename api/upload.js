const { google } = require('googleapis');
const nodemailer = require('nodemailer');
const csvParser = require('csv-parser');
const multer = require('multer');
const stream = require('stream');

const upload = multer({ storage: multer.memoryStorage() });

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
  try {
    await new Promise((resolve, reject) => {
      upload.single('file')(req, res, err => {
        if (err) reject(err);
        else resolve();
      });
    });

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const sendEmails = req.body.send_emails === 'true';
    const sheets = await getSheetsClient();
    const spreadsheetId = process.env.SPREADSHEET_ID;
    const values = [];
    const errors = [];
    const emailPromises = [];

    const parser = csvParser({
      mapHeaders: ({ header }) => header.toLowerCase().replace(/ /g, '_'),
      mapValues: ({ value }) => value.trim(),
    });

    const bufferStream = new stream.PassThrough();
    bufferStream.end(req.file.buffer);

    await new Promise((resolve, reject) => {
      bufferStream
        .pipe(parser)
        .on('data', row => {
          if (
            row.equipment_name &&
            row.make &&
            row.manufactured &&
            row.serial_number &&
            row.calibration_date &&
            row.number_of_instruments &&
            row.department &&
            row.team_emails &&
            row['interval_(months)']
          ) {
            const emails = row.team_emails.split(',').map(e => e.trim());
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            const validEmails = emails.every(e => emailRegex.test(e));
            const validDate = new Date(row.calibration_date) <= new Date();
            if (!validEmails) {
              errors.push(`Invalid emails in row for ${row.equipment_name}`);
              return;
            }
            if (!validDate) {
              errors.push(`Future calibration date in row for ${row.equipment_name}`);
              return;
            }
            values.push([
              Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
              row.equipment_name,
              row.make,
              row.manufactured,
              row.serial_number,
              row.calibration_date,
              row.number_of_instruments,
              row.department,
              row.team_emails,
              row['interval_(months)'],
              '',
            ]);

            if (sendEmails) {
              const dueDate = new Date(row.calibration_date);
              dueDate.setMonth(dueDate.getMonth() + parseInt(row['interval_(months)']));
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
                subject: `Calibration Reminder: ${row.equipment_name} (${type})`,
                text: `Equipment: ${row.equipment_name}\nSerial Number: ${row.serial_number}\nCalibration Date: ${row.calibration_date}\nDue Date: ${dueDate.toISOString().split('T')[0]}\nDepartment: ${row.department}\nPlease schedule calibration.`,
              };
              emailPromises.push(
                transporter.sendMail(mailOptions)
                  .then(() => logEmail(sheets, spreadsheetId, row.equipment_name, emails, type, true))
                  .catch(err => {
                    logEmail(sheets, spreadsheetId, row.equipment_name, emails, type, false);
                    console.error(`Failed to send email for ${row.equipment_name}:`, err.message);
                  })
              );
            }
          } else {
            errors.push(`Missing fields in row for ${row.equipment_name || 'unknown'}`);
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });

    if (errors.length > 0) {
      return res.status(400).json({ error: 'CSV processing errors: ' + errors.join('; ') });
    }

    if (values.length > 0) {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'CalibrationData!A:K',
        valueInputOption: 'RAW',
        resource: { values },
      });
    }

    if (sendEmails && emailPromises.length > 0) {
      await Promise.all(emailPromises);
    }

    return res.status(200).json({ message: `CSV processed: ${values.length} entries added` });
  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
};