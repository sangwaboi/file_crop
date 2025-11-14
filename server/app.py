from flask import Flask, jsonify, request, send_from_directory
import os
import requests

app = Flask(__name__, static_folder="static")


def _load_env_file():
    try:
        root = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))
        env_path = os.path.join(root, ".env")
        if not os.path.exists(env_path):
            return
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    k, v = line.split("=", 1)
                    k = k.strip()
                    v = v.strip()
                    os.environ.setdefault(k, v)
    except Exception:
        pass


_load_env_file()

OPENWEATHER_API_KEY = os.environ.get("OPENWEATHER_API_KEY")


def get_openweather(lat: float, lon: float):
    try:
        url = "https://api.open-meteo.com/v1/forecast"
        params = {
            "latitude": lat,
            "longitude": lon,
            "daily": "temperature_2m_mean,precipitation_sum",
            "forecast_days": 7,
            "timezone": "auto",
        }
        r = requests.get(url, params=params, timeout=10)
        r.raise_for_status()
        return r.json()
    except Exception:
        return {
            "daily": {
                "temperature_2m_mean": [24, 25, 23, 22, 26, 24, 23],
                "precipitation_sum": [5, 12, 0, 20, 3, 0, 15],
            },
            "error": "weather_fetch_failed",
        }


def get_soilgrids(lat: float, lon: float):
    try:
        base = "https://rest.isric.org/soilgrids/v2.0/properties/query"
        params = {
            "lat": lat,
            "lon": lon,
            "property": "phh2o",
            "depth": "0-5cm",
            "value": "mean",
        }
        r = requests.get(base, params=params, timeout=10)
        r.raise_for_status()
        gj = r.json()
        layers = gj.get("properties", {}).get("layers", [])
        ph = None
        if layers:
            depths = layers[0].get("depths", [])
            if depths:
                values = depths[0].get("values", {})
                mapped = values.get("mean")
                if mapped is not None:
                    ph = mapped / 10.0
        return {"ph": ph, "raw": gj}
    except Exception:
        return {"ph": None, "error": "soil_fetch_failed"}


def summarize_weather(weather):
    daily_obj = weather.get("daily")
    avg_temp = None
    rainfall_mm = None
    if isinstance(daily_obj, dict):
        temps = daily_obj.get("temperature_2m_mean") or []
        rain = daily_obj.get("precipitation_sum") or []
        if temps:
            avg_temp = sum(t for t in temps if isinstance(t, (int, float))) / len(temps)
        if rain:
            rainfall_mm = sum(r for r in rain if isinstance(r, (int, float)))
    else:
        daily_list = weather.get("daily", [])
        temps = [d.get("temp", {}).get("day") for d in daily_list if d.get("temp", {}).get("day") is not None]
        avg_temp = sum(temps) / len(temps) if temps else weather.get("current", {}).get("temp")
        rainfall_mm = 0.0
        for d in daily_list:
            r = d.get("rain")
            if isinstance(r, (int, float)):
                rainfall_mm += r
    return {
        "avg_temp_c": avg_temp,
        "weekly_rain_mm": rainfall_mm,
    }


def recommend_crops(weather_summary, soil):
    temp = weather_summary.get("avg_temp_c")
    rain = weather_summary.get("weekly_rain_mm")
    ph = soil.get("ph")

    recs = []

    if temp is None or rain is None or ph is None:
        return [{"crop": "insufficient-data", "reason": "Missing temp/rain/pH"}]

    if rain >= 100 and 20 <= temp <= 32 and 5.5 <= ph <= 6.5:
        recs.append({"crop": "rice", "reason": "high rainfall, warm temp, mildly acidic pH"})

    if 10 <= rain <= 60 and 12 <= temp <= 25 and 6.0 <= ph <= 7.5:
        recs.append({"crop": "wheat", "reason": "moderate rainfall, cool temp, neutral pH"})

    if rain <= 40 and 18 <= temp <= 35 and 6.0 <= ph <= 7.5:
        recs.append({"crop": "millet", "reason": "low rainfall tolerance, warm temp, neutral pH"})

    if 40 <= rain <= 120 and 18 <= temp <= 30 and 5.5 <= ph <= 7.0:
        recs.append({"crop": "maize", "reason": "moderate rainfall, warm temp, slightly acidic pH"})

    if not recs:
        recs.append({"crop": "local-advisory", "reason": "No rule matched; consult regional guidelines"})

    return recs


@app.route("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


@app.route("/api/insights")
def insights():
    try:
        lat = float(request.args.get("lat"))
        lon = float(request.args.get("lon"))
    except (TypeError, ValueError):
        return jsonify({"error": "invalid_lat_lon"}), 400

    weather = get_openweather(lat, lon)
    soil = get_soilgrids(lat, lon)
    summary = summarize_weather(weather)
    recs = recommend_crops(summary, soil)

    return jsonify({
        "location": {"lat": lat, "lon": lon},
        "weather": summary,
        "soil": {"ph": soil.get("ph")},
        "recommendations": recs,
    })


@app.route("/static/<path:path>")
def static_files(path):
    return send_from_directory(app.static_folder, path)


@app.route("/config.js")
def config_js():
    key = os.environ.get("GMAPS_API_KEY") or os.environ.get("VITE_GOOGLE_MAPS_API_KEY", "")
    content = f"window.CONFIG={{GMAPS_API_KEY:'{key}'}};"
    return app.response_class(content, mimetype="application/javascript")


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)