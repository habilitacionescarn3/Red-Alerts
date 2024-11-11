// Import environment configuration
import dotenv from "dotenv";
dotenv.config();

import axios from "axios";
import express from "express";
import fs from "fs";
import path from "path";
import date from "date-and-time";
import sql from "mssql";
import moment from "moment-timezone";
import { fileURLToPath } from "url";
// Manually define __dirname
const app = express();
app.use(express.json());
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
console.log(__filename);
console.log(__dirname);

app.use(express.static(path.join(__dirname, "public")));

// File paths and network configurations
const PORT = 3000;
// const __dirname = path.resolve();

// Global variables
const dates = new Date();
dates.setDate(dates.getDate());
dates.setHours(dates.getHours() + 2); // Ensure correct timezone offset

// Database configuration
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

// API endpoint for fetching data
app.get("/array", async (req, res) => {
  try {
    console.log("Request date:", dates);

    const formattedDate = formatDate(dates);
    const fileData = await fetchEvents(formattedDate);
    const fileCord = await fetchCords(formattedDate);

    res.json({
      alerts: fileData,
      locations: fileCord,
    });
  } catch (error) {
    res.status(500).json({ message: "Error fetching data", error });
  }
});

// Error handling endpoint
app.post("/send-error", async (req, res) => {
  console.log(req.body);

  const errorObject = JSON.stringify(req.body);
  console.log("Received Error Object:", errorObject);

  try {
    const response = await axios.post(
      "http://85.250.91.110:3100/add-error",
      req.body
    );
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error("Error sending object to second server:", error.message);
    res
      .status(500)
      .json({ message: "Failed to send the object to the second server." });
  }
});

// Serve index.html for any other routes
app.get("*", (req, res) => {
  console.log(path.join(__dirname, "public", "index.html"));

  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

// Helper functions

async function fetchEvents(date) {
  return await getEventsByDate(date);
}

async function fetchCords(date) {
  return await getCoordinatesByDate(date);
}

async function insertCoordinate(location) {
  const pool = await sql.connect(dbConfig);
  const request = pool.request();
  const { address, coordinates } = location;
  const { lat, lon } = coordinates;

  request.input("address", sql.NVarChar(255), address);
  request.input("lat", sql.Float, lat);
  request.input("lon", sql.Float, lon);

  try {
    await request.execute("InsertOrUpdateCoordinates");
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

async function getEventsByDate(date) {
  let pool = null;
  try {
    pool = await sql.connect(dbConfig);
    const request = pool.request();
    request.input("input_date", sql.Date, date);

    const result = await request.execute("GetEventsByDate");
    if (
      result.recordset.length > 0 &&
      result.recordset[0]["JSON_F52E2B61-18A1-11d1-B105-00805F49916B"]
    ) {
      const eventsJson =
        result.recordset[0]["JSON_F52E2B61-18A1-11d1-B105-00805F49916B"];
      const events = JSON.parse(eventsJson);

      const transformedEvents = events.events.map((event) => ({
        ...event,
        time: moment
          .utc(event.time)
          .tz("Asia/Jerusalem")
          .format("YYYY-MM-DD HH:mm:ss"),
        data: event.data.map((locationObj) => ({
          location_name: locationObj.location_name,
        })),
      }));
      return transformedEvents;
    } else {
      return [];
    }
  } catch (err) {
    console.error("SQL error", err);
    return [];
  } finally {
    if (pool) {
      pool.close();
    }
  }
}

async function getCoordinatesByDate(inputDate) {
  const pool = await sql.connect(dbConfig);
  const request = pool.request();
  request.input("input_date", sql.Date, inputDate);

  try {
    const result = await request.execute("GetCoordinatesByEventDate");
    const coordinatesJson =
      result.recordset[0]["JSON_F52E2B61-18A1-11d1-B105-00805F49916B"];
    if (coordinatesJson) {
      const coordinatesArray = JSON.parse(coordinatesJson);
      const uniqueCoordinates = [];
      const addressSet = new Set();

      coordinatesArray.coordinates.forEach((coordinate) => {
        if (!addressSet.has(coordinate.address)) {
          uniqueCoordinates.push(coordinate);
          addressSet.add(coordinate.address);
        }
      });
      return uniqueCoordinates;
    } else {
      return [];
    }
  } catch (err) {
    console.error("SQL error", err);
    return [];
  } finally {
    if (pool) {
      pool.close();
    }
  }
}

// Utility to format dates
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default app;
