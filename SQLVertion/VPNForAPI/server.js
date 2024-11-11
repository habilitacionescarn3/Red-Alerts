// Import environment configuration
import dotenv from "dotenv";
dotenv.config();

import axios from "axios";
import express from "express";
import date from "date-and-time";
import sql from "mssql";
import fs from "fs";
import path from "path";

const app = express();
const __dirname = path.resolve();
const errorsFilePath = path.join(__dirname, "errors.json");

// Network configuration
const PORT = 3100;

// Global variables
const setup = false;

const dates = new Date();
dates.setDate(dates.getDate());
dates.setHours(dates.getHours() + 2);

// Database configuration
app.use(express.json());

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

// POST endpoint to receive and add unique errors
app.post("/add-error", (req, res) => {
  const newError = req.body;
  console.log("Received New Error:", newError);

  if (!newError || Object.keys(newError).length === 0) {
    return res.status(400).json({ message: "Invalid error object received." });
  }

  const existingErrors = readErrorsFile();
  const isDuplicate = existingErrors.some(
    (error) => JSON.stringify(error) === JSON.stringify(newError)
  );

  if (!isDuplicate) {
    existingErrors.push(newError);
    writeErrorsFile(existingErrors);
    res.json({ message: "Error successfully added." });
  } else {
    res.json({ message: "Duplicate error. Not added." });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

// Functions for fetching, updating, and handling alerts
const fetchData = async () => {
  try {
    console.log("Attempting to fetch data...");
    const response = await axios.get(
      `https://www.oref.org.il/WarningMessages/alert/alerts.json`
    );

    const data = response.data;
    console.log(data);

    if (data && typeof data === "object" && Object.keys(data).length > 0) {
      const now = new Date();
      const formattedDate = date.format(now, "YYYY/MM/DD HH:mm:ss");
      data.time = formattedDate;
      await addNewAlert(data);
    } else {
      console.log("Received empty data, retrying in 4.7 seconds...");
    }
  } catch (error) {
    console.error(
      "Error fetching data, retrying in 2.49 seconds...",
      error.message
    );
  }
};

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

// Additional utility functions
async function getAllAlerts() {
  try {
    const pool = await sql.connect(dbConfig);
    const result = await pool.request().execute("GetAllAlerts");
    const jsonFieldName = "JSON_F52E2B61-18A1-11d1-B105-00805F49916B";
    return result.recordset.length > 0
      ? JSON.parse(result.recordset[0][jsonFieldName])
      : [];
  } catch (err) {
    console.error("SQL error", err);
    return [];
  }
}

async function getLocationFromAlert(alerts) {
  const locations = [];
  for (const alert of alerts) {
    for (const loc of alert.data) {
      if (!locations.includes(loc.location_name)) {
        locations.push(loc.location_name);
      }
    }
  }
  return locations;
}

async function getAllLocations() {
  try {
    const pool = await sql.connect(dbConfig);
    const result = await pool.request().execute("GetAllLocations");
    const jsonFieldName = "JSON_F52E2B61-18A1-11d1-B105-00805F49916B";
    return result.recordset.length > 0
      ? JSON.parse(result.recordset[0][jsonFieldName]).locations
      : [];
  } catch (err) {
    console.error("SQL error", err);
    return [];
  }
}
//importent
async function updateOrInsertLocation(locationName, lat, lon) {
  try {
    const pool = await sql.connect(dbConfig);
    await pool
      .request()
      .input("location_name", sql.NVarChar(255), locationName)
      .input("lat", sql.Float, lat)
      .input("lon", sql.Float, lon)
      .execute("UpdateOrInsertLocationAndCoordinates");
    console.log(`Location ${locationName} updated/inserted successfully.`);
  } catch (err) {
    console.error(
      "SQL error while updating/inserting location and coordinates:",
      err
    );
  }
}

async function testing() {
  const alerts = await getAllAlerts();
  const alertsLocation = await getLocationFromAlert(alerts);
  const locations = await getAllLocations();
  const errorMissing = [];
  const errorWrong = [];

  for (const alertLoc of alertsLocation) {
    if (!locations.some((loc) => alertLoc.includes(loc.address))) {
      errorMissing.push(alertLoc);
    }
  }

  for (const loc of locations) {
    if (
      !(
        loc.lon < 33.35468927091694 &&
        loc.lon > 29.489364393908087 &&
        loc.lat < 35.93310954929203 &&
        loc.lat > 34
      )
    ) {
      errorWrong.push(loc.address);
    }
  }

  console.log(errorMissing, errorWrong);
  return { missing: errorMissing, wrong: errorWrong };
}

if (setup) {
  testing();
}

setInterval(async () => {
  await fetchData();
}, 4700);

function readErrorsFile() {
  try {
    const data = fs.readFileSync(errorsFilePath, "utf8");
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error("Error reading errors.json:", error.message);
    return [];
  }
}

function writeErrorsFile(errors) {
  fs.writeFileSync(errorsFilePath, JSON.stringify(errors, null, 2), "utf8");
}

export default app;
