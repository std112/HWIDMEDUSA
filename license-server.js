const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const SHEETSON_API_KEY = 'GfVV2ogNmpoL8_VGfljrHnCQ67vBGOp6XRx--9fubXY3lQ7UIZDPheMtuvg';
const SHEET_ID = '1CNHRStQXqTKVacFLLqBPaQP9gdnd02bhNwZCVFuOTv8';
const SHEET_NAME = 'Licenses';
const BASE_URL = `https://api.sheetson.com/v2/sheets/${SHEET_NAME}`;

const headers = {
  'X-Spreadsheet-Id': SHEET_ID,
  'Authorization': `Bearer ${SHEETSON_API_KEY}`,
  'Content-Type': 'application/json'
};

app.post('/check', async (req, res) => {
  const { key, hwid } = req.body;
  if (!key || !hwid) return res.status(400).json({ valid: false, message: 'Missing key or HWID' });

  try {
    const response = await fetch(`${BASE_URL}?search=license_key:${key}`, { headers });
    const data = await response.json();

    if (!data?.results?.length) return res.json({ valid: false, message: 'Key not found' });

    const record = data.results[0];
    const today = new Date();
    const isExpired = new Date(record.expiry_date) < today;
    const lastReset = new Date(record.last_reset || '2000-01-01');
    const daysSinceReset = Math.floor((today - lastReset) / (1000 * 60 * 60 * 24));

    if (record.status.toLowerCase() !== 'active' || isExpired) {
      return res.json({ valid: false, message: 'Key expired or inactive' });
    }

    if (!record.hwid) {
      await fetch(`${BASE_URL}/${record.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ hwid, last_reset: today.toISOString().split('T')[0] })
      });
      return res.json({ valid: true });
    }

    if (record.hwid === hwid) {
      return res.json({ valid: true });
    }

    if (daysSinceReset >= 30) {
      await fetch(`${BASE_URL}/${record.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ hwid, last_reset: today.toISOString().split('T')[0] })
      });
      return res.json({ valid: true, message: 'HWID reset allowed after 30 days.' });
    } else {
      const daysRemaining = 30 - daysSinceReset;
      return res.json({ valid: false, message: `HWID reset not allowed yet. Try again in ${daysRemaining} days.` });
    }

  } catch (err) {
    console.error(err);
    return res.status(500).json({ valid: false, message: 'Server error.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🔐 License server running on port ${PORT}`));
