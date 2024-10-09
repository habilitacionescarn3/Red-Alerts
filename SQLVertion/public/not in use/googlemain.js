const key = `REDACTED`;
// const key = process.env.GOOGLE_MAPS_API_KEY;

let p = "חיפה";
const iframe = document.getElementById("iframe");
iframe.src = `https://www.google.com/maps/embed/v1/place?key=${key}&q=${p}`;
