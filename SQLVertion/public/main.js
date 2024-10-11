// network
const currentUrl = window.location.href;
// const currentUrl = `https://red-alerts-mauve.vercel.app/`;
console.log(currentUrl);
fetch(`/array`)
  .then((response) => response.json())
  .then(async (data) => {
    console.log(data);
  });
// const IP = "85.250.91.110"; //85.250.91.110 localhost
//valuables
let gotData = false; //maybe useless
let alerts = [];
let locations = [];
let checker = 0;
const now = new Date(); //"10/9/2024 9:00"// mm/dd/yyyy
//elements
const timeLine = document.getElementById("timeline");
const time = document.getElementById("time");
const map = L.map("map").setView([32.0, 35.0], 8); // Default view
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap contributors",
}).addTo(map);
const markers = L.layerGroup().addTo(map);
const midnight = new Date(now);
midnight.setHours(0);
midnight.setMinutes(0);
midnight.setSeconds(0);
timeLine.value = getTimeDifference(midnight, now) * 60 + 60 * 3;
//add event listener
timeLine.addEventListener("input", async (event) => {
  const secondsInDay = 86400;
  const value = event.target.value;
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);

  const formattedHours = String(hours).padStart(2, "0");
  const formattedMinutes = String(minutes).padStart(2, "0");
  const formattedTime = `${formattedHours}:${formattedMinutes}`;
  time.textContent = formattedTime;

  markers.clearLayers();

  // Get current date (for current day timeline scrolling)
  const today = new Date(now);
  const formattedDate =
    today.getFullYear() +
    "/" +
    (today.getMonth() + 1).toString().padStart(2, "0") +
    "/" +
    today.getDate().toString().padStart(2, "0");

  // Check if we have alert data already

  if (gotData) {
    await addMarkers(`${formattedDate} ${formattedTime}:00`);
  }
});

getAlerts();
console.log(`${currentUrl}array`);

//get alerts from server
async function getAlerts() {
  fetch(`/array`)
    .then((response) => response.json())
    .then(async (data) => {
      console.log(data);

      alerts = data.alerts;

      locations = data.locations;
      console.log(alerts);
      console.log(locations);
      gotData = true;
      timeLine.style.display = "block";
      console.log(timeLine.style.display);
      const today = new Date(now); //new Date();
      console.log(today);

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
      console.log("timeline");

      updateBackground();
      if (gotData === true) {
        await addMarkers(`${formattedDate} ${formattedTime}`, 0);
      }

      return data;
    })
    .catch((error) => console.error("Error fetching array:", error));
}

//set scroll background
function updateBackground() {
  const alertTimes = alerts;
  const currentDate = now;

  const startOfDay = new Date(currentDate.setHours(0, 0, 0, 0));
  const endOfDay = new Date(currentDate.setHours(23, 59, 59, 999));
  console.log(alertTimes);

  const highlightRanges = alertTimes
    .filter((alert) => {
      console.log("filter", alert);
      console.log(formatDate(alert.time));

      const alertTime = new Date(formatDate(alert.time));
      console.log(formatDate(alertTime));
      console.log("start", startOfDay);
      console.log("end", endOfDay);

      console.log(
        alertTime >= startOfDay,
        alertTime <= endOfDay,
        alertTime >= startOfDay && alertTime <= endOfDay
      );

      return alertTime >= startOfDay && alertTime <= endOfDay;
    })
    .map((alert) => {
      console.log("map", alert);

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
    console.log(highlightRanges);

    if (index < highlightRanges.length - 1) {
      background += ", ";
    }
  });

  if (lastPosition < 100) {
    background += `, #ddd ${lastPosition}%, #ddd 100%`;
  }
  console.log(highlightRanges);

  background += ")";
  timeLine.style.background = background;
  console.log(timeLine.style.background);
}

async function addMarkers(time, check) {
  markers.clearLayers();
  const markerArray = [];
  let markerCount = 0;

  for (let i = 0; i < alerts.length; i++) {
    for (let j = 0; j < alerts[i].data.length; j++) {
      for (let k = 0; k < locations.length; k++) {
        if (
          alerts[i].data[j].toString() === locations[k].address.toString() &&
          getTimeDifference(alerts[i].time, time) < 10
        ) {
          if (
            !has(markerArray, {
              lon: locations[k].lon,
              lat: locations[k].lat,
            })
          ) {
            //gpt
            console.log("found");
            const { address, lon, lat } = locations[k];
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
              lon: locations[k].lon,
              lat: locations[k].lat,
            });
            markerCount++;
          }
        }
      }
    }
  }
}

//retuen time diff in minutes
function getTimeDifference(time1, time2) {
  const date1 = new Date(time1);
  const date2 = new Date(time2);

  // Ensure both Date objects are valid
  if (isNaN(date1.getTime()) || isNaN(date2.getTime())) {
    console.error(`Invalid date(s) found: ${time1}, ${time2}`);
    return Number.MAX_SAFE_INTEGER; // Return a large number to skip invalid dates
  }

  // Calculate the difference in milliseconds
  const diffInMs = Math.abs(date2 - date1);

  // Convert milliseconds to minutes
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));

  return diffInMinutes;
}

//check if obj is in array
function has(array, obj) {
  for (let i = 0; i < array.length; i++)
    if (array[i].lat === obj.lat && array[i].lon === obj.lon) {
      return true;
    }

  return false;
}

//format date
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
