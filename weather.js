const API_KEY = "e0de90e4e11d198d32c6ebfd2fd7f49e";
let isCelsius = true;
let lastWeatherData = null;

// ── DOM refs ──
const cityInput  = document.querySelector("#city-name");
const searchBtn  = document.querySelector("#search-btn");
const locateBtn  = document.querySelector("#locate-btn");
const dashboard  = document.querySelector("#dashboard");
const statusMsg  = document.querySelector("#status-msg");
const unitToggle = document.querySelector("#unit-toggle");
const unitKnob   = document.querySelector("#unit-knob");
const unitC      = document.querySelector("#unit-c");
const unitF      = document.querySelector("#unit-f");
const acList     = document.querySelector("#autocomplete-list");

// ── Helpers ──
const toF      = c => ((c * 9/5) + 32).toFixed(1);
const fmtTemp  = c => isCelsius ? `${parseFloat(c).toFixed(1)}°C` : `${toF(c)}°F`;
const fmtTime  = (unix, tz) => new Date((unix + tz) * 1000).toUTCString().slice(17,22);

function showStatus(msg, isError=false) {
  dashboard.style.display = "none";
  statusMsg.style.display = "block";
  statusMsg.style.color   = isError ? "#fca5a5" : "#fff";
  statusMsg.innerHTML = msg;
}
function showDashboard() {
  statusMsg.style.display  = "none";
  dashboard.style.display  = "block";
  // re-trigger cascade animations
  document.querySelectorAll(".card-cascade").forEach((el, i) => {
    el.style.animation = "none";
    el.offsetHeight; // reflow
    el.style.animation = `cascadeIn 0.6s ease forwards ${i * 0.07}s`;
  });
}

// ── Background ──
const BG_MAP = {
  Clear:"bg-clear", Clouds:"bg-clouds", Rain:"bg-rain", Drizzle:"bg-rain",
  Thunderstorm:"bg-thunder", Snow:"bg-snow", Mist:"bg-clouds", Fog:"bg-clouds", Haze:"bg-clouds"
};
function setBackground(cond, isNight) {
  const all = ["bg-clear","bg-clouds","bg-rain","bg-thunder","bg-snow","bg-night"];
  document.body.classList.remove(...all);
  document.body.classList.add(isNight ? "bg-night" : (BG_MAP[cond] || ""));
}

// ── AQI ──
const AQI_LABELS = ["","Good","Fair","Moderate","Poor","Very Poor"];
const AQI_COLORS = ["","#4ade80","#facc15","#fb923c","#ef4444","#a855f7"];

// ── UV ──
function uvLabel(uv) {
  if (uv<=2)  return ["Low","#4ade80"];
  if (uv<=5)  return ["Moderate","#facc15"];
  if (uv<=7)  return ["High","#fb923c"];
  if (uv<=10) return ["Very High","#ef4444"];
  return ["Extreme","#a855f7"];
}

// ── Wind dir ──
function windDir(deg) {
  return ["N","NE","E","SE","S","SW","W","NW"][Math.round(deg/45)%8];
}

// ── Lifestyle tips ──
function getLifestyleTips(data) {
  const tips=[], t=data.main.temp, c=data.weather[0].main;
  const uv=data.uv||0, aqi=data.aqi||1;
  if (c==="Rain"||c==="Drizzle") tips.push("🌂 Carry an umbrella today.");
  if (c==="Thunderstorm")        tips.push("⚡ Stay indoors — thunderstorm warning.");
  if (c==="Snow")                tips.push("🧤 Dress warmly, watch for icy roads.");
  if (t>35)      tips.push("🥵 Extreme heat — stay hydrated.");
  else if (t>28) tips.push("😎 Warm day — wear sunscreen.");
  else if (t<5)  tips.push("🧥 Very cold — bundle up.");
  if (uv>=6)     tips.push("🕶️ High UV — SPF 30+ recommended.");
  if (aqi>=4)    tips.push("😷 Poor air quality — consider a mask.");
  if (data.wind.speed>10) tips.push("💨 Strong winds — secure loose items.");
  if (!tips.length) tips.push("✅ Conditions look great — enjoy your day!");
  return tips;
}

// ── Ticker animation helper ──
function setTick(el, text) {
  if (!el) return;
  el.style.animation = "none";
  el.offsetHeight;
  el.textContent = text;
  el.style.animation = "tickUp 0.4s ease forwards";
}

// ── Render Current ──
function renderCurrent(data) {
  const icon    = data.weather[0].icon;
  const isNight = icon.endsWith("n");
  setBackground(data.weather[0].main, isNight);

  document.querySelector("#city-display").textContent = `${data.name}, ${data.sys.country}`;
  document.querySelector("#weather-desc").textContent = data.weather[0].description;
  document.querySelector("#weather-icon").src         = `https://openweathermap.org/img/wn/${icon}@2x.png`;
  document.querySelector("#temp-main").textContent    = fmtTemp(data.main.temp);
  document.querySelector("#feels-like").textContent   = fmtTemp(data.main.feels_like);
  document.querySelector("#temp-max").textContent     = fmtTemp(data.main.temp_max);
  document.querySelector("#temp-min").textContent     = fmtTemp(data.main.temp_min);
  document.querySelector("#humidity").textContent     = `${data.main.humidity}%`;
  document.querySelector("#wind-speed").textContent   = `${data.wind.speed} m/s`;
  document.querySelector("#wind-dir").textContent     = windDir(data.wind.deg||0);
  document.querySelector("#visibility").textContent   = `${(data.visibility/1000).toFixed(1)} km`;
  document.querySelector("#pressure").textContent     = `${data.main.pressure} hPa`;
  document.querySelector("#sunrise").textContent      = fmtTime(data.sys.sunrise, data.timezone);
  document.querySelector("#sunset").textContent       = fmtTime(data.sys.sunset, data.timezone);
  document.querySelector("#precip-value").textContent = data.rain?.["1h"] ?? "0";

  // Solar orb position (0% = sunrise, 100% = sunset)
  const now = Math.floor(Date.now()/1000);
  const sr  = data.sys.sunrise, ss = data.sys.sunset;
  const pct = Math.min(100, Math.max(0, ((now - sr)/(ss - sr))*100));
  const orb = document.querySelector("#solar-orb");
  if (orb) orb.style.left = `calc(${pct}% - 8px)`;

  // Local time
  const localMs = (Date.now()/1000 + data.timezone)*1000;
  document.querySelector("#local-time").textContent = new Date(localMs).toUTCString().slice(0,25);

  // Lifestyle tips
  document.querySelector("#lifestyle-tips").innerHTML =
    getLifestyleTips(data).map(t=>`<li style="display:flex;align-items:flex-start;gap:8px;">${t}</li>`).join("");
}

// ── Render AQI ──
function renderAQI(aqiData) {
  const aqi = aqiData.list[0], idx = aqi.main.aqi;
  document.querySelector("#aqi-value").textContent = idx;
  const labelEl = document.querySelector("#aqi-label");
  labelEl.textContent = AQI_LABELS[idx];
  labelEl.style.color = AQI_COLORS[idx];
  labelEl.style.background = AQI_COLORS[idx]+"22";
  document.querySelector("#aqi-bar").style.width = `${(idx/5)*100}%`;
  document.querySelector("#pm25").textContent = aqi.components.pm2_5.toFixed(1);
  document.querySelector("#pm10").textContent = aqi.components.pm10.toFixed(1);
  document.querySelector("#o3").textContent   = aqi.components.o3.toFixed(1);
  document.querySelector("#no2").textContent  = aqi.components.no2.toFixed(1);
}

// ── Render UV ──
function renderUV(uvVal) {
  const [label, color] = uvLabel(uvVal);
  document.querySelector("#uv-value").textContent = uvVal.toFixed(1);
  document.querySelector("#uv-value").style.color = color;
  document.querySelector("#uv-label").textContent = label;
  document.querySelector("#uv-label").style.color = color;
  const pct = Math.min((uvVal/12)*100, 100);
  document.querySelector("#uv-indicator").style.left = `calc(${pct}% - 7px)`;
}

// ── Render Hourly ──
function renderHourly(forecastData) {
  const container = document.querySelector("#hourly-forecast");
  container.innerHTML = forecastData.list.slice(0,10).map(item => {
    const time  = new Date(item.dt*1000).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
    const icon  = item.weather[0].icon;
    const cond  = item.weather[0].main;
    const pop   = Math.round((item.pop||0)*100);
    const isLightning = cond==="Thunderstorm";
    const animClass   = isLightning ? "lightning-flash" : cond==="Clouds"||cond==="Rain" ? "drift-cloud" : "pulse-icon";
    return `
    <div style="flex-shrink:0;width:76px;padding:12px 8px;border-radius:16px;text-align:center;
                background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);">
      <p style="font-size:.65rem;color:rgba(255,255,255,.5);margin-bottom:6px;">${time}</p>
      <img src="https://openweathermap.org/img/wn/${icon}.png" class="${animClass}"
           style="width:40px;height:40px;margin:0 auto;display:block;filter:drop-shadow(0 0 6px rgba(255,255,255,0.3));"/>
      <p style="font-size:.85rem;font-weight:700;color:#fff;margin-top:4px;">${fmtTemp(item.main.temp)}</p>
      <p style="font-size:.65rem;color:#93c5fd;margin-top:2px;">${pop}%</p>
    </div>`;
  }).join("");
}

// ── Render Daily (vertical) ──
function renderDaily(forecastData) {
  const days={};
  forecastData.list.forEach(item => {
    const day = new Date(item.dt*1000).toLocaleDateString("en",{weekday:"short",month:"short",day:"numeric"});
    if (!days[day]) days[day]=item;
  });
  const container = document.querySelector("#daily-forecast");
  container.innerHTML = Object.entries(days).slice(0,5).map(([day, item], i) => {
    const icon     = item.weather[0].icon;
    const cond     = item.weather[0].main;
    const pop      = Math.round((item.pop||0)*100);
    const animClass= cond==="Thunderstorm" ? "lightning-flash" : cond==="Snow" ? "pulse-icon" : "drift-cloud";
    const delays   = [0, 0.3, 0.6, 0.9, 1.2];
    return `
    <div style="display:flex;align-items:center;justify-content:space-between;
                padding:12px 16px;border-radius:14px;background:rgba(255,255,255,0.07);
                border:1px solid rgba(255,255,255,0.12);animation:cascadeIn .5s ease both ${delays[i]}s;">
      <p style="font-size:.85rem;font-weight:600;color:rgba(255,255,255,.8);width:110px;">${day}</p>
      <img src="https://openweathermap.org/img/wn/${icon}.png" class="${animClass}"
           style="width:38px;height:38px;filter:drop-shadow(0 0 6px rgba(255,255,255,0.3));"/>
      <p style="font-size:.78rem;color:rgba(255,255,255,.5);width:40px;text-align:center;">${pop}%🌧</p>
      <p style="font-size:.9rem;font-weight:700;color:#ff6b6b;width:56px;text-align:right;">${fmtTemp(item.main.temp_max)}</p>
      <p style="font-size:.82rem;color:#93c5fd;width:56px;text-align:right;">${fmtTemp(item.main.temp_min)}</p>
    </div>`;
  }).join("");
}

function renderPrecipPop(forecastData) {
  const pop = Math.round((forecastData.list[0]?.pop||0)*100);
  document.querySelector("#precip-pop").textContent = `${pop}%`;
  document.querySelector("#precip-bar").style.width = `${pop}%`;
}

// ══════════════════════════════════════
// RADAR CANVAS
// ══════════════════════════════════════
let radarAnimId=null, radarPlaying=false, radarFrame=0, radarLat=0, radarLon=0;

function initRadar(lat, lon) {
  radarLat=lat; radarLon=lon;
  drawRadarFrame(0);
  const playBtn   = document.querySelector("#radar-play");
  const slider    = document.querySelector("#radar-slider");
  const timeLabel = document.querySelector("#radar-time-label");

  slider.addEventListener("input", ()=> {
    radarFrame = parseInt(slider.value);
    timeLabel.textContent = `T+${radarFrame}h`;
    drawRadarFrame(radarFrame);
  });

  playBtn.addEventListener("click", ()=> {
    radarPlaying = !radarPlaying;
    playBtn.textContent = radarPlaying ? "⏸ Pause" : "▶ Play";
    if (radarPlaying) animateRadar(slider, timeLabel);
    else cancelAnimationFrame(radarAnimId);
  });
}

function animateRadar(slider, timeLabel) {
  let last=0;
  function step(ts) {
    if (!radarPlaying) return;
    if (ts-last>900) {
      radarFrame=(radarFrame+1)%6;
      slider.value=radarFrame;
      timeLabel.textContent=`T+${radarFrame}h`;
      drawRadarFrame(radarFrame);
      last=ts;
    }
    radarAnimId=requestAnimationFrame(step);
  }
  radarAnimId=requestAnimationFrame(step);
}

function drawRadarFrame(frame) {
  const canvas = document.querySelector("#radar-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const W   = canvas.offsetWidth||600;
  const H   = 220;
  canvas.width=W; canvas.height=H;

  // Background map-like gradient
  const bg = ctx.createLinearGradient(0,0,W,H);
  bg.addColorStop(0,"#0d1b4b");
  bg.addColorStop(0.5,"#0a2c5e");
  bg.addColorStop(1,"#0e3460");
  ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);

  // Grid lines
  ctx.strokeStyle="rgba(255,255,255,0.07)"; ctx.lineWidth=1;
  for (let x=0;x<W;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
  for (let y=0;y<H;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}

  // Precipitation blobs (seeded by frame for animation)
  const rng = seededRand(frame*7+42);
  const blobs = [
    {x:.3,y:.4,r:70,  intensity:0.7+rng()*0.3},
    {x:.6,y:.3,r:55,  intensity:0.5+rng()*0.4},
    {x:.5,y:.65,r:90, intensity:0.4+rng()*0.5},
    {x:.75,y:.55,r:45,intensity:0.6+rng()*0.3},
    {x:.18,y:.7,r:50, intensity:0.3+rng()*0.4},
  ];
  blobs.forEach(b=>{
    const cx=b.x*W, cy=b.y*H;
    const gr=ctx.createRadialGradient(cx,cy,0,cx,cy,b.r);
    const alpha=b.intensity*(0.6+frame*0.06);
    gr.addColorStop(0, `rgba(0,200,255,${Math.min(alpha,0.85)})`);
    gr.addColorStop(0.4,`rgba(0,80,220,${Math.min(alpha*0.7,0.6)})`);
    gr.addColorStop(0.7,`rgba(80,0,160,${Math.min(alpha*0.4,0.35)})`);
    gr.addColorStop(1,  "rgba(0,0,0,0)");
    ctx.fillStyle=gr; ctx.beginPath(); ctx.arc(cx,cy,b.r,0,Math.PI*2); ctx.fill();
  });

  // Center crosshair (current location)
  const cx=W/2, cy=H/2;
  ctx.strokeStyle="rgba(245,200,66,0.8)"; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.moveTo(cx-14,cy); ctx.lineTo(cx+14,cy); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx,cy-14); ctx.lineTo(cx,cy+14); ctx.stroke();
  ctx.strokeStyle="rgba(245,200,66,0.5)"; ctx.lineWidth=1;
  ctx.beginPath(); ctx.arc(cx,cy,24,0,Math.PI*2); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx,cy,48,0,Math.PI*2); ctx.stroke();

  // Sweep line
  const angle=(frame/6)*Math.PI*2;
  const gr2=ctx.createLinearGradient(
    cx, cy,
    cx+Math.cos(angle)*80, cy+Math.sin(angle)*80
  );
  gr2.addColorStop(0,"rgba(245,200,66,0.6)");
  gr2.addColorStop(1,"rgba(245,200,66,0)");
  ctx.strokeStyle=gr2; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(cx,cy);
  ctx.lineTo(cx+Math.cos(angle)*W*0.6, cy+Math.sin(angle)*H*0.8);
  ctx.stroke();

  // Labels
  ctx.fillStyle="rgba(255,255,255,0.35)"; ctx.font="11px Inter,sans-serif";
  ctx.fillText("N",cx-4,14); ctx.fillText("S",cx-4,H-4);
  ctx.fillText("W",4,cy+4);  ctx.fillText("E",W-14,cy+4);

  // Legend
  const legX=12, legY=H-38;
  ctx.fillStyle="rgba(0,0,0,0.4)"; ctx.fillRect(legX-4,legY-14,120,28); 
  const lgr=ctx.createLinearGradient(legX,0,legX+112,0);
  lgr.addColorStop(0,"rgba(0,200,255,0.9)");
  lgr.addColorStop(0.5,"rgba(0,80,220,0.9)");
  lgr.addColorStop(1,"rgba(80,0,160,0.9)");
  ctx.fillStyle=lgr; ctx.fillRect(legX,legY,112,6);
  ctx.fillStyle="rgba(255,255,255,0.5)"; ctx.font="9px Inter,sans-serif";
  ctx.fillText("Light",legX,legY+18); ctx.fillText("Heavy",legX+82,legY+18);
}

// Simple seeded RNG
function seededRand(seed) {
  let s=seed;
  return function(){ s=(s*1664525+1013904223)&0xffffffff; return (s>>>0)/4294967296; };
}

// ══════════════════════════════════════
// LIVE LOCATION MODULE
// ══════════════════════════════════════
function initLiveLocation() {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(async pos => {
    try {
      const r = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&appid=${API_KEY}&units=metric`
      );
      const d = await r.json();
      const liveCity = document.querySelector("#live-city");
      const liveTemp = document.querySelector("#live-temp");
      liveCity.textContent = `📍 ${d.name}, ${d.sys.country}`;
      setTick(liveTemp, fmtTemp(d.main.temp));
    } catch{}
  }, ()=>{});
}

// ══════════════════════════════════════
// MAIN FETCH
// ══════════════════════════════════════
async function fetchWeather(query) {
  showStatus(`<div style="display:flex;align-items:center;justify-content:center;gap:12px;">
    <div style="width:22px;height:22px;border:3px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spinSlow 0.7s linear infinite;"></div>
    <span>Fetching weather data…</span></div>`);
  try {
    const weatherRes = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?${query}&appid=${API_KEY}&units=metric`
    );
    if (!weatherRes.ok) { showStatus("❌ City not found. Try again.", true); return; }
    const weatherData = await weatherRes.json();
    const {lat, lon}  = weatherData.coord;

    const [aqiRes, uvRes, forecastRes] = await Promise.all([
      fetch(`https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`),
      fetch(`https://api.openweathermap.org/data/2.5/uvi?lat=${lat}&lon=${lon}&appid=${API_KEY}`),
      fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`),
    ]);
    const [aqiData, uvData, forecastData] = await Promise.all([
      aqiRes.json(), uvRes.json(), forecastRes.json()
    ]);

    weatherData.aqi = aqiData.list[0].main.aqi;
    weatherData.uv  = uvData.value;
    lastWeatherData = { weatherData, aqiData, uvData, forecastData };

    renderCurrent(weatherData);
    renderAQI(aqiData);
    renderUV(uvData.value);
    renderHourly(forecastData);
    renderDaily(forecastData);
    renderPrecipPop(forecastData);
    showDashboard();
    initRadar(lat, lon);

  } catch(err) {
    console.error(err);
    showStatus("❌ Something went wrong. Check your connection.", true);
  }
}

// ── Unit toggle ──
unitToggle.addEventListener("click", () => {
  isCelsius = !isCelsius;
  unitKnob.style.left = isCelsius ? "3px" : "21px";
  unitC.style.color = isCelsius ? "#fff" : "rgba(255,255,255,.4)";
  unitF.style.color = !isCelsius ? "#fff" : "rgba(255,255,255,.4)";
  if (lastWeatherData) {
    renderCurrent(lastWeatherData.weatherData);
    renderHourly(lastWeatherData.forecastData);
    renderDaily(lastWeatherData.forecastData);
    const liveTemp = document.querySelector("#live-temp");
    // live temp unit not cached, just indicate
  }
});

// ── Search ──
searchBtn.addEventListener("click", () => {
  const city = cityInput.value.trim();
  if (!city) { showStatus("Please enter a city name.", true); return; }
  acList.style.display = "none";
  fetchWeather(`q=${encodeURIComponent(city)}`);
});
cityInput.addEventListener("keydown", e => { if (e.key==="Enter") searchBtn.click(); });

// ── Locate button with pulse ──
locateBtn.addEventListener("click", () => {
  locateBtn.classList.add("locate-pulse");
  locateBtn.addEventListener("animationend", ()=>locateBtn.classList.remove("locate-pulse"), {once:true});
  if (!navigator.geolocation) { showStatus("Geolocation not supported.", true); return; }
  showStatus(`<div style="display:flex;align-items:center;justify-content:center;gap:12px;">
    <div style="width:22px;height:22px;border:3px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spinSlow 0.7s linear infinite;"></div>
    <span>Detecting location…</span></div>`);
  navigator.geolocation.getCurrentPosition(
    pos => fetchWeather(`lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`),
    ()  => showStatus("❌ Location access denied.", true)
  );
});

// ── Autocomplete ──
let acTimer;
cityInput.addEventListener("input", () => {
  clearTimeout(acTimer);
  const q = cityInput.value.trim();
  if (q.length<3) { acList.style.display="none"; return; }
  acTimer = setTimeout(async ()=>{
    try {
      const res  = await fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(q)}&limit=5&appid=${API_KEY}`);
      const data = await res.json();
      if (!data.length) { acList.style.display="none"; return; }
      acList.innerHTML = data.map(c=>
        `<li data-name="${c.name}" data-country="${c.country}" data-state="${c.state||""}"
          style="padding:10px 16px;font-size:.85rem;color:#fff;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.08);
                 transition:background .2s;"
          onmouseover="this.style.background='rgba(255,255,255,0.12)'"
          onmouseout="this.style.background=''"
        >${c.name}${c.state?", "+c.state:""}, ${c.country}</li>`
      ).join("");
      acList.style.display="block";
    } catch { acList.style.display="none"; }
  }, 350);
});
acList.addEventListener("click", e=>{
  const li=e.target.closest("li"); if (!li) return;
  cityInput.value=`${li.dataset.name}${li.dataset.state?", "+li.dataset.state:""}, ${li.dataset.country}`;
  acList.style.display="none";
  fetchWeather(`q=${encodeURIComponent(li.dataset.name)}&countrycodes=${li.dataset.country}`);
});
document.addEventListener("click", e=>{
  if (!e.target.closest("#search-wrapper")) acList.style.display="none";
});

// ── Init ──
initLiveLocation();
fetchWeather("q=Gwalior,IN");
