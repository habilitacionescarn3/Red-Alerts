require("dotenv").config();
const axios = require("axios");
const express = require("express");
const fs = require("fs");
const path = require("path");
const dates = new Date(`2024/10/05`); //new Date()+1
const date = require("date-and-time");
const sql = require("mssql");
const app = express();
const PORT = 3001;
const filePathData = "/Projects/red Alerts/data.json";
const filePathCord = "/Projects/red Alerts/coordinates.json";
const filePathError = "/Projects/red Alerts/errors.json";
const setup = true; //npm start not nodemon
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
    trustServerCertificate: true,
    trustedConnection: true,
    connectTimeout: 30000,
  },
};
if (setup) {
  convertToSql();
}
app.get("/array", async (req, res) => {
  // const formatDate = `${dates.getFullYear()}/${dates.getMonth() + 1}/${
  //   dates.getDate
  // }`;
  // console.log(formatDate);
  console.log(formatDate(dates));

  const fileData = await fetchEvents(formatDate(dates)); //TODO Replace with dates//"2024-10-05"
  const fileCord = await fetchCords(formatDate(dates));
  res.json({
    alerts: fileData,
    locations: fileCord,
  });
});

app.use(express.static(path.join(__dirname, "MainPage")));

app.get("/map", (req, res) => {
  res.sendFile(path.join(__dirname, "MainPage", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
////////////////////////////////////////////////////////////////////////////////////////////

async function convertToSql() {
  const dataArray = await readJsonFile(filePathData);
  for (let i = 0; i < dataArray.length; i++) {
    addNewAlert(dataArray[i]);
    // console.log(i);
  }
  const cordArray = await readJsonFile(filePathCord);
  for (let i = 0; i < cordArray.length; i++) {
    insertCoordinate(cordArray[i]);
    // console.log(i);
  }
}
const fetchData = async () => {
  try {
    console.log("Attempting to fetch data...");
    let response = await axios.get(
      `https://www.oref.org.il/WarningMessages/alert/alerts.json`
    );

    let data = response.data;

    // Check if response.data is an object and not empty
    if (data && typeof data === "object" && Object.keys(data).length > 0) {
      console.log("Data received:", data);

      const now = new Date();
      const formattedDate = date.format(now, "YYYY/MM/DD HH:mm:ss");
      data.time = formattedDate;
      addNewAlert(data);
      setTimeout(fetchData, 4700);
    } else {
      // If the data is empty, retry after 4.7 seconds
      console.log("Received empty data, retrying in 4.7 seconds...");
      setTimeout(fetchData, 4700);
    }
  } catch (error) {
    console.error(
      "Error fetching data, retrying in 2.49 seconds...",
      error.message
    );
    // Wait for 2.49 seconds and retry
    setTimeout(fetchData, 2490);
  }
};
fetchData();

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
    // console.log(result); // Log the result (you can customize this)
  } catch (err) {
    console.error("SQL error", err);
  }
}

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
async function addNewAlert(eventData) {
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
}
async function getEventsByDate(date) {
  let pool = null;

  try {
    // Establish a new SQL connection pool
    pool = await sql.connect(dbConfig);

    // Prepare and execute the stored procedure with the given date
    const request = pool.request();
    request.input("input_date", sql.Date, date);

    const result = await request.execute("GetEventsByDate");

    // Check if we have valid data in the recordset
    if (result.recordset.length > 0) {
      const eventsJson =
        result.recordset[0]["JSON_F52E2B61-18A1-11d1-B105-00805F49916B"]; // Adjust alias if needed
      const events = JSON.parse(eventsJson);

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
async function fetchEvents(date) {
  const arr = await getEventsByDate(date);
  return arr;
}
async function fetchCords(date) {
  const arr = await getCoordinatesByDate(date);
  // console.log(arr);

  return arr;
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
function formatDate(dateString) {
  const date = new Date(dateString); // Create a Date object from the string

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0"); // Months are zero-indexed, so we add 1
  const day = String(date.getDate() + 1).padStart(2, "0");
  return `${year}/${month}/${day}`;
}
module.exports = app;
