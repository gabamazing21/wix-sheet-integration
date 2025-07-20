
require('dotenv').config()
const express = require("express");
const cors = require("cors");
const { google } = require("googleapis");
const process = require('node:process');
const app = express();


app.use(cors());
const auth = new google.auth.GoogleAuth({
    // keyFile: 'service-account.json',
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],

});

app.get("/", (req, res) => {
  res.send("google sheets api is working. try /inventory");
})
app.get("/inventory", async (req, res) => {
  try {
    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client });

    const spreadsheetId = "1DFbCd0_wrz_x2Egf139tDtlpM7afohhhGFi_Pca1QuI";
    const range = "inventory!A:L";

    // fetch the sheet values
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const rows = response.data.values; // array of arrays

    if (!rows || rows.length === 0) {
      return res.status(404).json({ message: "No data found" });
    }

    const headers = rows[0]; // first row is headers: ["item Name", "set", "quantity", ...]
    const data = rows.slice(1).map((row) => {
      let item = {};
      headers.forEach((h, i) => {
        item[h] = row[i] || ""; // if row[i] is undefined, set it to an empty string
      });
      return item;
    });

      // Add price from pricecharting using productID
      const apikey = process.env.PRICECHARTING_API_KEY;
      
      const enrichedData = await Promise.all(
        data.map(async (item) => {
            const id = item["Id"];
            if (!id) {
                item.marketValue = null;
                return item;
            }

            const url = `https://www.pricecharting.com/api/product?t=${apikey}&id=${id}`;
            try {
                const response = await fetch(url);
                const result = await response.json();

                item.marketValue = result["loose-price"] ? result["loose-price"] / 100 : null;
            } catch(err) {
                console.error( `Failed to fetch for IS ${id}:`, err.message);
                item.marketValue = null;
            }
            return item;
        })
      );
    res.json(data);
  } catch (err) {
    console.error(err); // Log error in console
    res.status(500).json({ error: "failed to fetch data" });
  }
});

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});