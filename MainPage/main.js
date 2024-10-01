// Initialize the map
const IP = "85.250.91.110";
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
const now = new Date();
getAlerts();
function updateBackground() {
  const alertTimes = alerts;
  // const currentDate = new Date("2024/09/30"); // Set to the current day//TODO FIX
  const currentDate = new Date(
    `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()}`
  );
  // console.log(currentDate);
  const startOfDay = new Date(currentDate.setHours(0, 0, 0, 0));
  const endOfDay = new Date(currentDate.setHours(23, 59, 59, 999));

  const highlightRanges = alertTimes
    .filter((alert) => {
      const alertTime = new Date(alert.time);
      return alertTime >= startOfDay && alertTime <= endOfDay;
    })
    .map((alert) => {
      const alertTime = new Date(alert.time);
      const start = new Date(alertTime.getTime() - 5 * 60000); // 5 minutes before
      const end = new Date(alertTime.getTime() + 5 * 60000); // 5 minutes after
      return { start, end };
    });

  let background = "linear-gradient(to right, ";
  let lastPosition = 0;

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
  const hours = Math.floor(event.target.value / 3600);
  const minutes = Math.floor((event.target.value % 3600) / 60);
  const formattedHours = String(hours).padStart(2, "0");
  const formattedMinutes = String(minutes).padStart(2, "0");
  const text = `${formattedHours}:${formattedMinutes}`;
  time.textContent = text;
  markers.clearLayers();
  const today = new Date(); //TODO: get fed by input (for history check)
  const formattedDate =
    today.getFullYear() +
    "/" +
    (today.getMonth() + 1).toString().padStart(2, "0") +
    "/" +
    today.getDate().toString().padStart(2, "0");
  checker++;
  if ((gotData = true)) {
    await addMarkers(`${formattedDate} ${time.textContent}:00`, checker);
  }
  //function
});

async function getAlerts() {
  fetch(`http://${IP}:3000/array`)
    .then((response) => response.json())
    .then(async (data) => {
      alerts = data.alerts;
      locations = data.locations;
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
