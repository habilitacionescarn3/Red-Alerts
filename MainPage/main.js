// Initialize the map
const IP = "85.250.91.110";
let gotData = false; //maybe useless
// console.log(getTimeDifference(`2024/09/27 15:49:32`, `2024/09/27 15:59:32`));
let alerts = [];
let locations = [];
const timeLine = document.getElementById("timeline");
const time = document.getElementById("time");

const map = L.map("map").setView([32.0, 35.0], 8); // Default view
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap contributors",
}).addTo(map);
const markers = L.layerGroup().addTo(map);

getAlerts();

timeLine.addEventListener("input", (event) => {
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

  if ((gotData = true)) {
    addMarkers(`${formattedDate} ${time.textContent}:00`);
  }
  //function
});

function getAlerts() {
  fetch(`http://${IP}:3000/array`)
    .then((response) => response.json())
    .then((data) => {
      console.log(data.alerts);
      console.log(data.locations);
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
      console.log(time.textContent);

      if (gotData === true) {
        addMarkers(`${formattedDate} ${time.textContent}`);
      }
      return data;
    })
    .catch((error) => console.error("Error fetching array:", error));
}

function addMarkers(time) {
  markers.clearLayers();
  let markerCount = 0;
  for (let i = 0; i < alerts.length; i++) {
    for (let j = 0; j < alerts[i].data.length; j++) {
      let found = false;
      for (let k = 0; k < locations.length && !found; k++) {
        if (
          alerts[i].data[j].toString() === locations[k].address.toString() &&
          getTimeDifference(alerts[i].time, time) < 10
        ) {
          console.log(alerts[i]);

          found = true;
          L.marker([
            locations[k].coordinates.lon,
            locations[k].coordinates.lat,
          ]).addTo(markers);
          markerCount++;
        }
      }
      if (!found) {
        // console.log(`${alerts[i].data[j]} was not found`);
      }
      //title
    }
  }
  console.log(markerCount); //TODO :FIX
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
  console.log(time1, time2, diffInMinutes);

  return diffInMinutes;
}
