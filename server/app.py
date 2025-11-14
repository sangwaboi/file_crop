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
    if not OPENWEATHER_API_KEY or OPENWEATHER_API_KEY == "your_openweather_api_key_here":
        raise ValueError("OPENWEATHER_API_KEY not configured in .env file")
    
    url = "https://api.openweathermap.org/data/2.5/forecast"
    params = {"lat": lat, "lon": lon, "appid": OPENWEATHER_API_KEY, "units": "metric"}
    r = requests.get(url, params=params, timeout=10)
    r.raise_for_status()
    data = r.json()
    
    daily_temps, daily_rain = [], []
    current_day, day_temps, day_rain = None, [], 0
    
    for item in data.get("list", []):
        day = item.get("dt_txt", "").split()[0]
        if day != current_day and current_day:
            if day_temps:
                daily_temps.append(sum(day_temps) / len(day_temps))
            daily_rain.append(day_rain)
            day_temps, day_rain = [], 0
        current_day = day
        if item.get("main", {}).get("temp"):
            day_temps.append(item["main"]["temp"])
        day_rain += item.get("rain", {}).get("3h", 0)
    
    if day_temps:
        daily_temps.append(sum(day_temps) / len(day_temps))
    daily_rain.append(day_rain)
    
    return {"daily": {"temperature_2m_mean": daily_temps, "precipitation_sum": daily_rain}}


def get_soilgrids(lat: float, lon: float):
    try:
        url = "https://rest.isric.org/soilgrids/v2.0/properties/query"
        params = {"lat": lat, "lon": lon, "property": "phh2o", "depth": "0-5cm", "value": "mean"}
        r = requests.get(url, params=params, timeout=10)
        r.raise_for_status()
        data = r.json()
        
        layers = data.get("properties", {}).get("layers", [])
        if layers:
            depths = layers[0].get("depths", [])
            if depths:
                ph_value = depths[0].get("values", {}).get("mean")
                if ph_value is not None:
                    return {"ph": ph_value / 10.0}
    except Exception:
        pass
    
    # Fallback: Regional pH estimates based on latitude
    # Tropical regions (0-23°): slightly acidic 6.0-6.5
    # Temperate regions (23-40°): neutral 6.5-7.5
    # Arid regions (varies): alkaline 7.5-8.5
    abs_lat = abs(lat)
    if abs_lat < 23:
        estimated_ph = 6.2  # Tropical
    elif abs_lat < 40:
        estimated_ph = 7.0  # Temperate
    else:
        estimated_ph = 7.5  # Higher latitudes
    
    return {"ph": estimated_ph, "estimated": True}


def summarize_weather(weather):
    daily = weather.get("daily", {})
    temps = daily.get("temperature_2m_mean", [])
    rain = daily.get("precipitation_sum", [])
    return {
        "avg_temp_c": sum(temps) / len(temps) if temps else None,
        "weekly_rain_mm": sum(rain) if rain else None,
    }


def recommend_crops(weather_summary, soil):
    temp = weather_summary.get("avg_temp_c")
    rain = weather_summary.get("weekly_rain_mm")
    ph = soil.get("ph")
    
    if temp is None or rain is None or ph is None:
        raise ValueError("Missing required data for crop recommendation")
    
    recs = []
    if rain >= 100 and 20 <= temp <= 32 and 5.5 <= ph <= 6.5:
        recs.append({"crop": "rice", "reason": "high rainfall, warm temp, mildly acidic pH"})
    if 10 <= rain <= 60 and 12 <= temp <= 25 and 6.0 <= ph <= 7.5:
        recs.append({"crop": "wheat", "reason": "moderate rainfall, cool temp, neutral pH"})
    if rain <= 40 and 18 <= temp <= 35 and 6.0 <= ph <= 7.5:
        recs.append({"crop": "millet", "reason": "low rainfall, warm temp, neutral pH"})
    if 40 <= rain <= 120 and 18 <= temp <= 30 and 5.5 <= ph <= 7.0:
        recs.append({"crop": "maize", "reason": "moderate rainfall, warm temp, slightly acidic pH"})
    
    return recs if recs else [{"crop": "none", "reason": f"No suitable crops (T:{temp:.1f}°C, R:{rain:.0f}mm, pH:{ph:.1f})"}]


@app.route("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


@app.route("/api/insights")
def insights():
    try:
        lat = float(request.args.get("lat"))
        lon = float(request.args.get("lon"))
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid latitude/longitude"}), 400
    
    try:
        weather = get_openweather(lat, lon)
        soil = get_soilgrids(lat, lon)
        summary = summarize_weather(weather)
        recs = recommend_crops(summary, soil)
        
        response = {
            "location": {"lat": lat, "lon": lon},
            "weather": summary,
            "soil": {"ph": soil.get("ph")},
            "recommendations": recs,
        }
        
        # Add note if soil pH is estimated
        if soil.get("estimated"):
            response["note"] = "Soil pH estimated based on regional climate (SoilGrids data unavailable)"
        
        return jsonify(response)
    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"API request failed: {str(e)}"}), 503
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": f"Server error: {str(e)}"}), 500


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