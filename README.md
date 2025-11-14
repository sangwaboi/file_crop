# 🌾 Crop Recommendation & Weather Insights Platform

An Agritech platform that helps farmers decide which crops to plant based on soil nutrients, rainfall, and temperature conditions in their region.

## Features

- 🌤️ **Real-time Weather Data** - Fetches temperature and rainfall forecasts using OpenWeatherMap API
- 🌍 **Soil Analysis** - Gets soil pH levels from ISRIC SoilGrids (FAO-backed) API
- 🌾 **Smart Crop Recommendations** - Suggests crops (Rice, Wheat, Millet, Maize) based on environmental conditions
- 📊 **Visual Dashboard** - Interactive charts showing rainfall and soil pH data
- 📍 **Location Search** - Search any location using Google Places or use device GPS

## Setup Instructions

### 1. Install Dependencies

```bash
# Create a virtual environment (recommended)
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install required packages
pip install -r requirements.txt
```

### 2. Configure API Keys

Create a `.env` file in the project root with your API keys:

```bash
# Google Maps API Key (for Places Autocomplete)
VITE_GOOGLE_MAPS_API_KEY=AIzaSyBpzaUC2rdm66APk5MrvrqKwJttESA782I
GMAPS_API_KEY=AIzaSyBpzaUC2rdm66APk5MrvrqKwJttESA782I

# OpenWeatherMap API Key
# Sign up at: https://home.openweathermap.org/users/sign_up
OPENWEATHER_API_KEY=your_openweather_api_key_here
```

**Get your OpenWeatherMap API key:**
1. Go to https://openweathermap.org/api
2. Sign up for a free account
3. Generate an API key (free tier includes 1000 calls/day)
4. Replace `your_openweather_api_key_here` in `.env` file

### 3. Run the Server

```bash
cd server
python app.py
```

The app will be available at: http://localhost:5000

## APIs Used

### ✅ Weather Data: OpenWeatherMap API
- **Endpoint**: `https://api.openweathermap.org/data/2.5/forecast`
- **Data**: 5-day weather forecast with 3-hour intervals
- **Features**: Temperature (°C), Precipitation (mm)
- **Cost**: Free tier (1000 calls/day)
- **Docs**: https://openweathermap.org/forecast5

### ✅ Soil Data: ISRIC SoilGrids API (FAO)
- **Endpoint**: `https://rest.isric.org/soilgrids/v2.0/properties/query`
- **Data**: Soil pH at 0-5cm depth
- **Features**: Global soil property maps at 250m resolution
- **Cost**: Free (no API key required)
- **Docs**: https://rest.isric.org/soilgrids/v2.0/docs
- **Data Source**: Based on FAO global soil data

**Note about FAO Soil API:** 
The original requirement mentioned https://data.apps.fao.org/catalog/dataset/soilgrids, but this is a data catalog, not an API. We're using the **ISRIC SoilGrids REST API** which provides the actual FAO soil data programmatically. ISRIC is the official provider of SoilGrids data referenced by FAO.

### ✅ Location Services: Google Maps API
- **Features**: Places Autocomplete for location search
- **Docs**: https://developers.google.com/maps/documentation/javascript/places-autocomplete

## Crop Recommendation Logic

| Crop | Rainfall (mm/week) | Temperature (°C) | Soil pH |
|------|-------------------|------------------|---------|
| **Rice** | ≥ 100 | 20-32 | 5.5-6.5 |
| **Wheat** | 10-60 | 12-25 | 6.0-7.5 |
| **Millet** | ≤ 40 | 18-35 | 6.0-7.5 |
| **Maize** | 40-120 | 18-30 | 5.5-7.0 |

## Project Structure

```
crop_project/
├── .env                    # API keys (not committed)
├── .gitignore             # Git ignore rules
├── README.md              # This file
├── requirements.txt       # Python dependencies
└── server/
    ├── app.py            # Flask backend server
    └── static/
        ├── index.html    # HTML structure
        ├── styles.css    # Dark theme styling
        └── app.js        # React frontend app
```

## Technology Stack

- **Backend**: Flask (Python)
- **Frontend**: React 18 (vanilla, no build step)
- **Charts**: Chart.js
- **Styling**: Custom CSS (dark theme)
- **APIs**: OpenWeatherMap, ISRIC SoilGrids, Google Maps

## How It Works

1. User enters a location (search or GPS)
2. Backend receives latitude/longitude
3. **Weather API** fetches 5-day temperature and rainfall forecast
4. **Soil API** fetches soil pH data for that location
5. **Recommendation Engine** analyzes conditions against crop thresholds
6. **Dashboard** displays visual charts and crop suggestions

## Future Enhancements

- [ ] Add more crop types (cotton, sugarcane, vegetables)
- [ ] Historical weather data analysis
- [ ] Soil nutrients beyond pH (N, P, K)
- [ ] Multi-language support
- [ ] Mobile app version
- [ ] Export recommendations as PDF

## License

MIT
