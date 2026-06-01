const API_KEY = "e0de90e4e11d198d32c6ebfd2fd7f49e";
let isCelsius = true;
let lastWeatherData = null; // cache for unit toggle

// ── DOM refs ──
const cityInput    = document.querySelector("#city-name");
const searchBtn    = document.querySelector("#search-btn");
const locateBtn    = document.querySelector("#locate-btn");
const dashboard    = document.querySelector("#dashboard");
const statusMsg    = document.querySelector("#status-msg");
const unitToggle   = document.querySelector("#unit-toggle");
const unitKnob     = document.querySelector("#unit-knob");
const unitC        = document.querySelector("#unit-c");
const unitF        = document.querySelector("#unit-f");
const acList       = document.querySelector("#autocomplete-list");

// ── Helpers ──
const toF = c => ((c * 9/5) + 32).toFixed(1);
const fmtTemp = c => isCelsius ? `${c}°C` : `${toF(c)}°F`;
const fmtTime = (unix, tz) => new Date((unix + tz) * 1000).toUTCString().slice(17, 22);

function showStatus(msg, isError = false) {
  dashboard.classList.add("hidden");
  statusMsg.classList.remove("hidden");
  statusMsg.className = `w-full max-w-4xl glass rounded-2xl p-5 text-center font-semibold text-lg ${isError ? "text-red-300" : "text-white"}`;
  statusMsg.innerHTML = msg;
}

function showDashboard() {
  statusMsg.classList.add("hidden");
  dashboard.classList.remove("hidden");
}

// ── Dynamic background ──
const BG_MAP = {
  Clear: "bg-clear", Clouds: "bg-clouds", Rain: "bg-rain",
  Drizzle: "bg-rain", Thunderstorm: "bg-thunder", Snow: "bg-snow",
  Mist: "bg-clouds", Fog: "bg-clouds", Haze: "bg-clouds",
};
function setBackground(condition, isNight) {
  const classes = ["bg-clear","bg-clouds","bg-rain","bg-thunder","bg-snow","bg-night","bg-default"];
  document.body.classList.remove(...classes);
  document.body.classList.add(isNight ? "bg-night" : (BG_MAP[condition] || "bg-default"));
}

// ── AQI label ──
const AQI_LABELS = ["","Good","Fair","Moderate","Poor","Very Poor"];
const AQI_COLORS = ["","text-green-300","text-yellow-300","text-orange-300","text-red-400","text-purple-400"];

// ── UV label ──
function uvLabel(uv) {
  if (uv <= 2) return ["Low","text-green-300"];
  if (uv <= 5) return ["Moderate","text-yellow-300"];
  if (uv <= 7) return ["High","text-orange-300"];
  if (uv <= 10) return ["Very High","text-red-400"];
  return ["Extreme","text-purple-400"];
}

// ── Wind direction ──
function windDir(deg) {
  const dirs = ["N","NE","E","SE","S","SW","W","NW"];
  return dirs[Math.round(deg / 45) % 8];
}

// ── Lifestyle suggestions ──
function getLifestyleTips(data) {
  const tips = [];
  const temp = data.main.temp;
  const cond = data.weather[0].main;
  const uv   = data.uv || 0;
  const aqi  = data.aqi || 1;

  if (cond === "Rain" || cond === "Drizzle") tips.push("🌂 Carry an umbrella today.");
  if (cond === "Thunderstorm") tips.push("⚡ Stay indoors — thunderstorm warning.");
  if (cond === "Snow") tips.push("🧤 Dress warmly and watch for icy roads.");
  if (temp > 35) tips.push("🥵 Extreme heat — stay hydrated and avoid midday sun.");
  else if (temp > 28) tips.push("😎 Warm day — wear light clothing and sunscreen.");
  else if (temp < 5) tips.push("🧥 Very cold — bundle up before heading out.");
  if (uv >= 6) tips.push("🕶️ High UV — apply SPF 30+ sunscreen.");
  if (aqi >= 4) tips.push("😷 Poor air quality — consider wearing a mask outdoors.");
  if (data.wind.speed > 10) tips.push("💨 Strong winds — secure loose outdoor items.");
  if (tips.length === 0) tips.push("✅ Conditions look great — enjoy your day!");
  return tips;
}

// ── Render current weather ──
function renderCurrent(data) {
  const icon    = data.weather[0].icon;
  const isNight = icon.endsWith("n");
  setBackground(data.weather[0].main, isNight);

  document.querySelector("#city-display").textContent  = `${data.name}, ${data.sys.country}`;
  document.querySelector("#weather-desc").textContent  = data.weather[0].description;
  document.querySelector("#weather-icon").src          = `https://openweathermap.org/img/wn/${icon}@2x.png`;
  document.querySelector("#temp-main").textContent     = fmtTemp(data.main.temp);
  document.querySelector("#feels-like").textContent    = fmtTemp(data.main.feels_like);
  document.querySelector("#temp-max").textContent      = fmtTemp(data.main.temp_max);
  document.querySelector("#temp-min").textContent      = fmtTemp(data.main.temp_min);
  document.querySelector("#humidity").textContent      = `${data.main.humidity}%`;
  document.querySelector("#wind-speed").textContent    = `${data.wind.speed} m/s`;
  document.querySelector("#wind-dir").textContent      = windDir(data.wind.deg || 0);
  document.querySelector("#visibility").textContent    = `${(data.visibility / 1000).toFixed(1)} km`;
  document.querySelector("#pressure").textContent      = `${data.main.pressure} hPa`;
  document.querySelector("#sunrise").textContent       = fmtTime(data.sys.sunrise, data.timezone);
  document.querySelector("#sunset").textContent        = fmtTime(data.sys.sunset, data.timezone);
  document.querySelector("#precip-value").textContent  = data.rain?.["1h"] ?? "0";

  // Local time
  const localMs = (Date.now() / 1000 + data.timezone) * 1000;
  document.querySelector("#local-time").textContent = new Date(localMs).toUTCString().slice(0, 25);

  // Lifestyle tips
  const tipsEl = document.querySelector("#lifestyle-tips");
  tipsEl.innerHTML = getLifestyleTips(data).map(t => `<li>${t}</li>`).join("");
}

// ── Render AQI ──
function renderAQI(aqiData) {
  const aqi = aqiData.list[0];
  const idx = aqi.main.aqi;
  document.querySelector("#aqi-value").textContent = idx;
  const label = document.querySelector("#aqi-label");
  label.textContent = AQI_LABELS[idx];
  label.className = `mt-2 text-sm font-semibold px-3 py-1 rounded-full inline-block bg-white/20 ${AQI_COLORS[idx]}`;
  document.querySelector("#pm25").textContent = aqi.components.pm2_5.toFixed(1);
  document.querySelector("#pm10").textContent = aqi.components.pm10.toFixed(1);
  document.querySelector("#o3").textContent   = aqi.components.o3.toFixed(1);
  document.querySelector("#no2").textContent  = aqi.components.no2.toFixed(1);
}

// ── Render UV ──
function renderUV(uvVal) {
  const [label, color] = uvLabel(uvVal);
  document.querySelector("#uv-value").textContent = uvVal.toFixed(1);
  const uvLabelEl = document.querySelector("#uv-label");
  uvLabelEl.textContent = label;
  uvLabelEl.className = `text-sm ${color}`;
  // Move indicator (UV max ~12)
  const pct = Math.min((uvVal / 12) * 100, 100);
  document.querySelector("#uv-indicator").style.left = `calc(${pct}% - 6px)`;
}

// ── Render Hourly Forecast ──
function renderHourly(forecastData) {
  const container = document.querySelector("#hourly-forecast");
  // Next 8 entries = 24h
  container.innerHTML = forecastData.list.slice(0, 8).map(item => {
    const time = new Date(item.dt * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const icon = item.weather[0].icon;
    const pop  = Math.round((item.pop || 0) * 100);
    return `
      <div class="flex-shrink-0 glass rounded-2xl p-3 text-center w-20">
        <p class="text-white/60 text-xs">${time}</p>
        <img src="https://openweathermap.org/img/wn/${icon}.png" class="w-10 h-10 mx-auto" />
        <p class="text-white font-semibold text-sm">${fmtTemp(item.main.temp)}</p>
        <p class="text-blue-200 text-xs">${pop}%</p>
      </div>`;
  }).join("");
}

// ── Render Daily Forecast ──
function renderDaily(forecastData) {
  // Group by day, pick midday entry
  const days = {};
  forecastData.list.forEach(item => {
    const day = new Date(item.dt * 1000).toLocaleDateString("en", { weekday: "short" });
    if (!days[day]) days[day] = item;
  });

  const container = document.querySelector("#daily-forecast");
  container.innerHTML = Object.entries(days).slice(0, 5).map(([day, item]) => {
    const icon = item.weather[0].icon;
    const pop  = Math.round((item.pop || 0) * 100);
    return `
      <div class="glass rounded-2xl p-3 text-center">
        <p class="text-white/60 text-xs font-semibold">${day}</p>
        <img src="https://openweathermap.org/img/wn/${icon}.png" class="w-10 h-10 mx-auto" />
        <p class="text-white font-semibold text-sm">${fmtTemp(item.main.temp_max)}</p>
        <p class="text-white/50 text-xs">${fmtTemp(item.main.temp_min)}</p>
        <p class="text-blue-200 text-xs">${pop}%</p>
      </div>`;
  }).join("");
}

// ── Precipitation pop from forecast ──
function renderPrecipPop(forecastData) {
  const pop = Math.round((forecastData.list[0]?.pop || 0) * 100);
  document.querySelector("#precip-pop").textContent = `${pop}%`;
}

// ── Main fetch ──
async function fetchWeather(query) {
  showStatus(`<div class="flex justify-center items-center gap-3"><div class="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin"></div><span>Fetching weather data...</span></div>`);

  try {
    // 1. Current weather
    const weatherRes = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?${query}&appid=${API_KEY}&units=metric`
    );
    if (!weatherRes.ok) { showStatus("❌ City not found. Please try again.", true); return; }
    const weatherData = await weatherRes.json();

    const { lat, lon } = weatherData.coord;

    // 2. AQI, UV, Forecast — parallel
    const [aqiRes, uvRes, forecastRes] = await Promise.all([
      fetch(`https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`),
      fetch(`https://api.openweathermap.org/data/2.5/uvi?lat=${lat}&lon=${lon}&appid=${API_KEY}`),
      fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`),
    ]);

    const [aqiData, uvData, forecastData] = await Promise.all([
      aqiRes.json(), uvRes.json(), forecastRes.json()
    ]);

    // Attach extras to weatherData for lifestyle tips
    weatherData.aqi = aqiData.list[0].main.aqi;
    weatherData.uv  = uvData.value;

    // Cache for unit toggle
    lastWeatherData = { weatherData, aqiData, uvData, forecastData };

    renderCurrent(weatherData);
    renderAQI(aqiData);
    renderUV(uvData.value);
    renderHourly(forecastData);
    renderDaily(forecastData);
    renderPrecipPop(forecastData);
    showDashboard();

  } catch (err) {
    console.error(err);
    showStatus("❌ Something went wrong. Check your connection.", true);
  }
}

// ── Unit toggle ──
unitToggle.addEventListener("click", () => {
  isCelsius = !isCelsius;
  unitKnob.style.left = isCelsius ? "2px" : "22px";
  unitC.className = `font-bold cursor-pointer text-sm ${isCelsius ? "text-white" : "text-white/40"}`;
  unitF.className = `font-bold cursor-pointer text-sm ${!isCelsius ? "text-white" : "text-white/40"}`;
  if (lastWeatherData) {
    renderCurrent(lastWeatherData.weatherData);
    renderHourly(lastWeatherData.forecastData);
    renderDaily(lastWeatherData.forecastData);
  }
});

// ── Search ──
searchBtn.addEventListener("click", () => {
  const city = cityInput.value.trim();
  if (!city) { showStatus("Please enter a city name.", true); return; }
  acList.classList.add("hidden");
  fetchWeather(`q=${encodeURIComponent(city)}`);
});

cityInput.addEventListener("keydown", e => {
  if (e.key === "Enter") searchBtn.click();
});

// ── Geolocation ──
locateBtn.addEventListener("click", () => {
  if (!navigator.geolocation) { showStatus("Geolocation not supported.", true); return; }
  showStatus(`<div class="flex justify-center items-center gap-3"><div class="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin"></div><span>Detecting location...</span></div>`);
  navigator.geolocation.getCurrentPosition(
    pos => fetchWeather(`lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`),
    ()  => showStatus("❌ Location access denied.", true)
  );
});

// ── Autocomplete (OpenWeatherMap Geo API) ──
let acTimer;
cityInput.addEventListener("input", () => {
  clearTimeout(acTimer);
  const q = cityInput.value.trim();
  if (q.length < 3) { acList.classList.add("hidden"); return; }
  acTimer = setTimeout(async () => {
    try {
      const res  = await fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(q)}&limit=5&appid=${API_KEY}`);
      const data = await res.json();
      if (!data.length) { acList.classList.add("hidden"); return; }
      acList.innerHTML = data.map((c, i) =>
        `<li data-idx="${i}" class="px-4 py-2 text-white hover:bg-white/20 cursor-pointer text-sm border-b border-white/10 last:border-0"
          data-name="${c.name}" data-country="${c.country}" data-state="${c.state || ""}">
          ${c.name}${c.state ? ", " + c.state : ""}, ${c.country}
        </li>`
      ).join("");
      acList.classList.remove("hidden");
    } catch { acList.classList.add("hidden"); }
  }, 350);
});

acList.addEventListener("click", e => {
  const li = e.target.closest("li");
  if (!li) return;
  cityInput.value = `${li.dataset.name}${li.dataset.state ? ", " + li.dataset.state : ""}, ${li.dataset.country}`;
  acList.classList.add("hidden");
  fetchWeather(`q=${encodeURIComponent(li.dataset.name)}&countrycodes=${li.dataset.country}`);
});

document.addEventListener("click", e => {
  if (!e.target.closest("#search-wrapper")) acList.classList.add("hidden");
});
