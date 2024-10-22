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
const PORT = 3000;
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
//in setup mode
if (setup) {
  convertToSql();
}
app.use(express.static(path.join(__dirname, "public")));
//api call for getting data
app.get("/array", async (req, res) => {
  try {
    console.log(dates);

    const fileData = await fetchEvents(formatDate(dates));
    const fileCord = await fetchCords(formatDate(dates));
    res.json({
      alerts: fileData,
      locations: fileCord,
    });
  } catch (error) {
    res.status(500).json({ message: "Error fetching data", error });
  }
});
//error handle
app.post("/send-error", async (req, res) => {
  const errorObject = req.body;

  console.log("Received Error Object:", errorObject); // Log to verify

  try {
    const response = await axios.post(
      "https://85.250.91.110:3100/add-error", // Assuming it's local for now
      errorObject
    );

    res.status(response.status).json(response.data);
  } catch (error) {
    console.error("Error sending object to second server:", error.message);
    res
      .status(500)
      .json({ message: "Failed to send the object to the second server." });
  }
});

//api gives page
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});
//start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
////stand by functions
//checks for alerts

//convert existing alerts to sql
async function convertToSql() {
  const dataArray = await readJsonFile(filePathData);
  for (let i = 0; i < dataArray.length; i++) {
    dataArray[i].time = moment
      .tz(dataArray[i].time, "Asia/Jerusalem")
      .utc()
      .format("YYYY-MM-DDTHH:mm:ss");
    await addNewAlert(dataArray[i]);
    console.log(i);
  }
  const cordArray = await readJsonFile(filePathCord);
  for (let i = 0; i < cordArray.length; i++) {
    await insertCoordinate(cordArray[i]);
  }
}
async function fetchEvents(date) {
  const arr = await getEventsByDate(date);

  return arr;
}

async function fetchCords(date) {
  const arr = await getCoordinatesByDate(date);
  return arr;
}
//insert to sql
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
async function getEventsByDate(date) {
  let pool = null;
  console.log(date);

  try {
    // Establish a new SQL connection pool
    pool = await sql.connect(dbConfig);

    // Prepare and execute the stored procedure with the given date
    const request = pool.request();
    request.input("input_date", sql.Date, date);

    const result = await request.execute("GetEventsByDate");
    console.log("SQL Result: ", result.recordset);

    // Check if we have valid data in the recordset
    if (
      result.recordset.length > 0 &&
      result.recordset[0]["JSON_F52E2B61-18A1-11d1-B105-00805F49916B"]
    ) {
      const eventsJson =
        result.recordset[0]["JSON_F52E2B61-18A1-11d1-B105-00805F49916B"];
      const events = JSON.parse(eventsJson);

      for (let i = 0; i < events.events.length; i++) {
        events.events[i].time = moment
          .utc(events.events[i].time) // Parse as UTC
          .tz("Asia/Jerusalem") // Convert to local timezone
          .format("YYYY-MM-DD HH:mm:ss")
          .toString(); // Correct format without 'T'
      }
      console.log(events);

      // Transform the data field from array of objects to array of strings
      const transformedEvents = events.events.map((event) => {
        return {
          ...event,
          data: event.data.map((locationObj) => locationObj.location_name), // Convert to array of strings
        };
      });

      return transformedEvents; // Return the transformed events array
    } else {
      console.log("No events found for the given date.");
      return []; // Return an empty array if no events found
    }
  } catch (err) {
    console.error("SQL error", err);
    return []; // Return an empty array if an error occurs
  } finally {
    // Ensure the connection is closed after use
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

      // Deduplicate the array based on the address
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
      console.log("No valid JSON returned.");
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
//red json for setup
function readJsonFile(filePathData) {
  return new Promise((resolve, reject) => {
    fs.readFile(filePathData, "utf8", (err, data) => {
      if (err) {
        reject(err);
      } else {
        try {
          const jsonArray = data ? JSON.parse(data) : [];
          resolve(jsonArray);
        } catch (parseErr) {
          reject(parseErr);
        }
      }
    });
  });
}
//format date
function formatDate(dateString) {
  const date = new Date(dateString); // Create a Date object from the string

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0"); // Months are zero-indexed, so we add 1
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}/${month}/${day}`;
}

module.exports = app;
