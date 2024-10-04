// Initialize the map
const IP = "localhost"; //85.250.91.110
let gotData = false; //maybe useless
// console.log(getTimeDifference(`2024/09/27 15:49:32`, `2024/09/27 15:59:32`));
let alerts = [];
let locations = [];
const timeLine = document.getElementById("timeline");
const time = document.getElementById("time");
let checker = 0;
const map = L.map("map").setView([32.0, 35.0], 8); // Default view
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap contributors",
}).addTo(map);
const markers = L.layerGroup().addTo(map);
const now = new Date(`2024/10/05`);
getAlerts();
//"2024-10-03T13:30:13" to format
function updateBackground() {
  const alertTimes = alerts;
  const currentDate = new Date("2024/10/05"); // Set to the current day//TODO FIX
  // const currentDate = new Date(
  //   `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()}`
  // );
  console.log(alertTimes);

  console.log(currentDate);
  const startOfDay = new Date(currentDate.setHours(0, 0, 0, 0));
  const endOfDay = new Date(currentDate.setHours(23, 59, 59, 999));

  const highlightRanges = alertTimes
    .filter((alert) => {
      console.log(formatDate(alert.time));
      const alertTime = new Date(formatDate(alert.time));
      return alertTime >= startOfDay && alertTime <= endOfDay;
    })
    .map((alert) => {
      console.log(formatDate(alert.time));

      const alertTime = new Date(formatDate(alert.time));
      const start = new Date(alertTime.getTime() - 5 * 60000); // 5 minutes before
      const end = new Date(alertTime.getTime() + 5 * 60000); // 5 minutes after
      return { start, end };
    });

  let background = "linear-gradient(to right, ";
  let lastPosition = 0;
  console.log(highlightRanges);

  highlightRanges.forEach((range, index) => {
    const startPercentage = ((range.start - startOfDay) / 86400000) * 100;
    const endPercentage = ((range.end - startOfDay) / 86400000) * 100;

    if (startPercentage > lastPosition) {
      background += `#ddd ${lastPosition}%, #ddd ${startPercentage}%, `;
    }
    background += `#ff4500 ${startPercentage}%, #ff4500 ${endPercentage}%`;
    lastPosition = endPercentage;

    if (index < highlightRanges.length - 1) {
      background += ", ";
    }
  });

  if (lastPosition < 100) {
    background += `, #ddd ${lastPosition}%, #ddd 100%`;
  }

  background += ")";
  timeLine.style.background = background;
}

timeLine.addEventListener("input", async (event) => {
  const secondsInDay = 86400; // Total seconds in a day
  const value = event.target.value;
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);

  const formattedHours = String(hours).padStart(2, "0");
  const formattedMinutes = String(minutes).padStart(2, "0");
  const formattedTime = `${formattedHours}:${formattedMinutes}`;

  // Update the time display
  time.textContent = formattedTime;

  // Clear old markers
  markers.clearLayers();

  // Get current date (for current day timeline scrolling)
  const today = now;
  const formattedDate =
    today.getFullYear() +
    "/" +
    (today.getMonth() + 1).toString().padStart(2, "0") +
    "/" +
    today.getDate().toString().padStart(2, "0");

  // Check if we have alert data already
  console.log(gotData);

  if (gotData) {
    await addMarkers(`${formattedDate} ${formattedTime}:00`);
  }
});

async function getAlerts() {
  fetch(`http://${IP}:3001/array`)
    .then((response) => response.json())
    .then(async (data) => {
      alerts = data.alerts;
      console.log(alerts);

      locations = data.locations;
      console.log(locations);
      gotData = true;
      timeLine.style.display = "block";
      const today = new Date();

      const formattedDate =
        today.getFullYear() +
        "/" +
        (today.getMonth() + 1).toString().padStart(2, "0") +
        "/" +
        today.getDate().toString().padStart(2, "0");
      const formattedTime =
        today.getHours().toString().padStart(2, "0") +
        ":" +
        today.getMinutes().toString().padStart(2, "0") +
        ":00";
      time.textContent = formattedTime;
      console.log(data);
      updateBackground();
      if (gotData === true) {
        await addMarkers(`${formattedDate} ${time.textContent}`);
      }

      return data;
    })
    .catch((error) => console.error("Error fetching array:", error));
}
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function addMarkers(time, check) {
  markers.clearLayers();
  const markerArray = [];
  let markerCount = 0;
  for (let i = 0; i < alerts.length && check === checker; i++) {
    for (let j = 0; j < alerts[i].data.length && check === checker; j++) {
      let found = false;

      for (
        let k = 0;
        k < locations.length && !found && check === checker;
        k++
      ) {
        if (
          alerts[i].data[j].toString() === locations[k].address.toString() &&
          getTimeDifference(alerts[i].time, time) < 10
        ) {
          found = true;

          if (
            !has(markerArray, {
              lon: locations[k].coordinates.lon,
              lat: locations[k].coordinates.lat,
            })
          ) {
            console.log(markerCount);

            //gpt
            const { lon, lat } = locations[k].coordinates;
            if (isNaN(lon) || isNaN(lat)) {
              console.error(`Invalid coordinates for ${locations[k].address}`);
              continue; // Skip invalid coordinates
            }
            const marker = L.marker([lon, lat]).addTo(markers);
            marker
              .bindPopup(
                `<b>${alerts[i].data[j]}</b><br>${alerts[i].title}</br><br>${alerts[i].time}</br>`
              )
              .openPopup();

            markerArray.push({
              lon: locations[k].coordinates.lon,
              lat: locations[k].coordinates.lat,
            });
            markerCount++;
          } //else console.log(`found`);
        }
      }
      if (!found) {
        // console.log(`${alerts[i].data[j]} was not found`);
      }
      //title
    }
  }
  // console.log(markerCount); //TODO :FIX
  if (check !== checker) {
    // console.log("stop" + " " + check + "" + checker);

    markers.clearLayers();
    markerCount = 0;
  }
}

function getTimeDifference(time1, time2) {
  // Convert time strings to Date objects
  const date1 = new Date(time1);
  const date2 = new Date(time2);

  // Calculate the difference in milliseconds
  const diffInMs = Math.abs(date1 - date2);

  // Convert milliseconds to hours and minutes
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInMinutes = Math.floor(
    (diffInMs % (1000 * 60 * 60)) / (1000 * 60) + diffInHours * 60
  );

  return diffInMinutes;
}
function has(array, obj) {
  for (let i = 0; i < array.length; i++)
    if (array[i].lat === obj.lat && array[i].lon === obj.lon) {
      return true;
    }

  return false;
}
function formatDate(dateString) {
  const date = new Date(dateString); // Create a Date object from the string

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0"); // Months are zero-indexed, so we add 1
  const day = String(date.getDate()).padStart(2, "0");

  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
}
