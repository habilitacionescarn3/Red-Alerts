require("dotenv").config();
const axios = require("axios");
const express = require("express");
const fs = require("fs");
const path = require("path");
const date = require("date-and-time");
require("dotenv").config();
const app = express();
const PORT = 3000;
const filePathData = "/Projects/red Alerts/data.json";
const filePathCord = "/Projects/red Alerts/coordinates.json";
const setup = false;
const setCord = async () => {
  try {
    const fileData = await readJsonFile(filePathData);

    const fileCord = await readJsonFile(filePathCord);
    console.log(fileData.length);
    console.log(fileData[1].data.length);
    console.log(fileCord.length);
    let found = false;
    for (let i = 0; i < fileData.length; i++) {
      for (let j = 0; j < fileData[i].data.length; j++) {
        for (let k = 0; k < fileCord.length; k++) {
          console.log(fileData[i].data[j]);
          console.log(fileCord[k].address);

          found = false;
          if (fileData[i].data[j] === fileCord[k].address) {
            found = true;
          }
        }
        if (!found) {
          console.log(fileData[i].data[j]);
          console.log("1");

          let query = encodeURIComponent(fileData[i].data[j]);
          let response = await axios.get(
            `https://photon.komoot.io/api/?q=${query}`
          );
          const obj = {
            address: fileData[i].data[j],
            coordinates: {
              lat: response.data.features[0].geometry.coordinates[0],
              lon: response.data.features[0].geometry.coordinates[1],
            },
          };
          console.log(obj);

          await saveObjectToFileCord(filePathCord, obj);
          console.log("Data saved successfully");
        }
      }
    }
  } catch {}
};
if (setup) {
  setCord();
}
app.use(express.static(path.join(__dirname, "MainPage")));
app.get("/map", (req, res) => {
  res.sendFile(path.join(__dirname, "MainPage", "index.html"));
});
app.get("/array", async (req, res) => {
  const fileData = await readJsonFile(filePathData);
  const fileCord = await readJsonFile(filePathCord);
  res.json({ alerts: fileData, locations: fileCord });
});
// Start server and periodically update coordinates.json
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
////////////////////////////////////////////////////////////////////////////////////////////

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

      await saveObjectToFile(filePathData, data);
      console.log("Data saved successfully");

      // Read the updated JSON file
      const fileData = await readJsonFile(filePathData);
      console.log("File data:", fileData);

      // Check if the file contains 100 objects
      if (fileData.length < 100) {
        // Continue fetching data
        setTimeout(fetchData, 4700);
      } else {
        console.log("File contains 100 objects. Stopping fetch.");
      }
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
// Start fetching data
fetchData();

function saveObjectToFile(filePathData, newObject) {
  return new Promise((resolve, reject) => {
    readJsonFile(filePathData)
      .then((jsonArray) => {
        // Check if the object already exists in the array
        const exists = jsonArray.some((obj) => obj.id === newObject.id);
        if (!exists) {
          jsonArray.push(newObject);
          const jsonData = JSON.stringify(jsonArray, null, 2);
          fs.writeFile(filePathData, jsonData, (err) => {
            if (err) {
              reject(err);
            } else {
              resolve("Object saved successfully");
            }
          });
        } else {
          resolve("Object already exists");
        }
      })
      .catch((err) => reject(err));
  });
}
function saveObjectToFileCord(filePathData, newObject) {
  return new Promise((resolve, reject) => {
    readJsonFile(filePathData)
      .then((jsonArray) => {
        const exists = jsonArray.some(
          (obj) => obj.address === newObject.address
        );
        if (!exists) {
          jsonArray.push(newObject);
          const jsonData = JSON.stringify(jsonArray, null, 2);
          fs.writeFile(filePathData, jsonData, (err) => {
            if (err) {
              reject(err);
            } else {
              resolve("Object saved successfully");
            }
          });
        } else {
          resolve("Object already exists");
        }
      })
      .catch((err) => reject(err));
  });
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

module.exports = app;
