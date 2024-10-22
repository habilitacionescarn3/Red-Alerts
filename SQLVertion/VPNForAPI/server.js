//TODO make sure location is inserted to database
//libs
require("dotenv").config();
const axios = require("axios");
const express = require("express");
const date = require("date-and-time");
const sql = require("mssql");
const fs = require("fs");
const path = require("path");
const app = express();
const errorsFilePath = path.join(__dirname, "errors.json");
//network
const PORT = 3100;
//valuables
const setup = false; //npm start not nodemon//check for missing locations
let test = false;
const dates = new Date(); //"10/9/2024 12:00"
dates.setDate(dates.getDate()); // - 1TODO understand ehy this is nessery
dates.setHours(dates.getHours() + 3);
//DB config
app.use(express.json()); // Ensure this is placed at the top, before routes

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

// POST endpoint to receive the object and add it to errors.json if unique
app.post("/add-error", (req, res) => {
  const newError = req.body;

  // Verify the request body is received correctly
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
//start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
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
async function getAllAlerts() {
  try {
    let pool = await sql.connect(dbConfig);
    let result = await pool.request().execute("GetAllAlerts");
    if (result.recordset && result.recordset.length > 0) {
      const jsonFieldName = "JSON_F52E2B61-18A1-11d1-B105-00805F49916B";
      const alerts = result.recordset[0][jsonFieldName];
      return alerts ? JSON.parse(alerts) : [];
    } else {
      console.log("No alerts found.");
      return [];
    }
  } catch (err) {
    console.error("SQL error", err);
    return [];
  }
}
async function getLocationFromAlert(alerts) {
  const location = [];
  for (let i = 0; i < alerts.length; i++) {
    for (let j = 0; j < alerts[i].data.length; j++) {
      if (!location.includes(alerts[i].data[j].location_name)) {
        location.push(alerts[i].data[j].location_name);
      }
    }
  }
  return location;
}
async function getAllLocations() {
  try {
    let pool = await sql.connect(dbConfig);
    let result = await pool.request().execute("GetAllLocations");
    if (result.recordset && result.recordset.length > 0) {
      // console.log("SQL Result:", result.recordset);
      const jsonFieldName = "JSON_F52E2B61-18A1-11d1-B105-00805F49916B";
      const locations = result.recordset[0][jsonFieldName];
      return locations ? JSON.parse(locations).locations : [];
    } else {
      console.log("No locations found.");
      return [];
    }
  } catch (err) {
    console.error("SQL error", err);
    return [];
  }
}
async function updateOrInsertLocation(locationName, lat, lon) {
  try {
    let pool = await sql.connect(dbConfig);

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
  const al = await getAllAlerts();
  const alerts = al.alerts;
  console.log(alerts.length);
  const alertsLocation = await getLocationFromAlert(alerts);
  console.log(alertsLocation.length);
  const locations = await getAllLocations();
  console.log(locations.length);
  const errorMissing = [];
  let found = false;
  for (let i = 0; i < alertsLocation.length; i++) {
    found = false;
    for (let j = 0; j < locations.length; j++) {
      // console.log(alertsLocation[i]);
      // console.log(locations[j].address);
      if (alertsLocation[i].includes(locations[j].address)) {
        found = true;
      }
    }
    if (!found) {
      errorMissing.push(alertsLocation[i]);
    }
  }
  console.log(errorMissing.length);
  const errorWrong = [];
  for (let i = 0; i < locations.length; i++) {
    if (
      !(
        //lay =y//lon=x
        (
          locations[i].lon < 33.35468927091694 &&
          locations[i].lon > 29.489364393908087 &&
          locations[i].lat < 35.93310954929203 &&
          locations[i].lat > 34
        )
      )
    ) {
      errorWrong.push(locations[i].address);
    }
  }
  console.log(errorWrong.length);
  console.log(errorMissing);
  console.log(errorWrong);
  //fixing maualy
  // await updateOrInsertLocation(`חולתה`, 35.6091616, 33.0511117);
  return (errors = { missing: errorMissing, wrong: errorWrong });
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
    return []; // Return empty array on error
  }
}

// Helper function to write to errors.json
function writeErrorsFile(errors) {
  fs.writeFileSync(errorsFilePath, JSON.stringify(errors, null, 2), "utf8");
}

module.exports = app;
