//to do add validate cord
//libs
require("dotenv").config();
const axios = require("axios");
const express = require("express");
const fs = require("fs");
const path = require("path");
const date = require("date-and-time");
const sql = require("mssql");
const moment = require("moment-timezone");
const app = express();
//files and network
const PORT = 3100;
const filePathData = path.join(__dirname, "data.json");
const filePathCord = path.join(__dirname, "coordinates.json");
const filePathError = path.join(__dirname, "errors.json");
// const dates = new Date("10/9/2024 12:00");
let running = false;
//valuables
const setup = false; //npm start not nodemon
let test = true;
const dates = new Date(); //"10/9/2024 12:00"
dates.setDate(dates.getDate()); // - 1TODO understand ehy this is nessery
dates.setHours(dates.getHours() + 3);
//DB config
const dbConfig = {
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
  port: parseInt(process.env.DB_PORT) || 1433,
  options: {
    encrypt: false,
    trustServerCertificate: true,
    trustedConnection: true,
    connectTimeout: 30000,
  },
};
if (test) {
  test = false;
  addNewAlert({
    id: "393",
    cat: "1",
    title: "TEST",
    data: ["מרום גולן"],
    desc: "היכנסו למרחב המוגן ושהו בו 10 דקות",
    time: "2024-10-12T18:09:20",
  });
}
//start server
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
    console.log(data);

    if (data && typeof data === "object" && Object.keys(data).length > 0) {
      console.log("Data received:", data);

      const now = new Date();
      const formattedDate = date.format(now, "YYYY/MM/DD HH:mm:ss");
      data.time = formattedDate;
      addNewAlert(data);
      console.log(1);
    } else {
      // If the data is empty, retry after 4.7 seconds
      console.log("Received empty data, retrying in 4.7 seconds...");
    }
  } catch (error) {
    console.error(
      "Error fetching data, retrying in 2.49 seconds...",
      error.message,
      error
    );
    // Wait for 2.49 seconds and retry
  }
};
// fetchData();

async function insertCoordinate(location) {
  const pool = await sql.connect(dbConfig);

  const request = pool.request();

  // Extract the address and coordinates from the location object
  const { address, coordinates } = location;
  const { lat, lon } = coordinates;

  // Pass parameters to the stored procedure
  request.input("address", sql.NVarChar(255), address);
  request.input("lat", sql.Float, lat);
  request.input("lon", sql.Float, lon);

  try {
    // Execute the stored procedure
    const result = await request.execute("InsertOrUpdateCoordinates");
  } catch (err) {
    console.error("SQL error", err);
  }
}
async function addNewAlert(eventData) {
  try {
    const pool = await sql.connect(dbConfig);

    const request = pool.request();

    request.input("id", sql.VarChar(50), eventData.id);
    request.input("category", sql.VarChar(50), eventData.cat);
    request.input("title", sql.VarChar(255), eventData.title);
    request.input("description", sql.VarChar(500), eventData.desc);
    request.input("event_time", sql.DateTime, eventData.time);
    request.input(
      "locations",
      sql.NVarChar(sql.MAX),
      JSON.stringify(eventData.data)
    );
    try {
      const result = await request.execute("AddNewEvent");
      console.log(result);
    } catch (err) {
      console.error("SQL error", err);
    }
  } catch (err) {
    console.log(err);
  }
}
//gets from sql
setInterval(async () => {
  await fetchData();
}, 4700);
module.exports = app;
