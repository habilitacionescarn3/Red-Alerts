//libs

const axios = require("axios");
const express = require("express");
const app = express();
//files and network
const PORT = 3100;
// const dates = new Date("10/9/2024 12:00");
let alert;

app.get("/alert", async (req, res) => {
  try {
    console.log(alert);

    res.json(alert);
  } catch (error) {
    res.status(500).json({ message: "Error fetching data", error });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
//checks for alerts

const fetchData = async () => {
  try {
    console.log("Attempting to fetch data...");
    let response = await axios.get(
      `https://www.oref.org.il/WarningMessages/alert/alerts.json`
    );
    let data = response.data;
    if (data && typeof data === "object" && Object.keys(data).length > 0) {
      console.log("Data received:", data);
      alert = data;
      setTimeout(fetchData, 4700);
    } else {
      alert = undefined;
      console.log("Received empty data, retrying in 4.7 seconds...");
      setTimeout(fetchData, 4700);
    }
  } catch (error) {
    console.error(
      "Error fetching data, retrying in 2.49 seconds...",
      error.message,
      error
    );
    // Wait for 2.49 seconds and retry
    setTimeout(fetchData, 2490);
  }
};
fetchData();
module.exports = app;
