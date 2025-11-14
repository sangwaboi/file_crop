(() => {
  const e = React.createElement;

  function useInsights() {
    const [state, setState] = React.useState({ loading: false, data: null, error: null });

    const fetchByLatLon = async (lat, lon) => {
      try {
        setState(s => ({ ...s, loading: true, error: null }));
        const res = await fetch(`/api/insights?lat=${lat}&lon=${lon}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setState({ loading: false, data, error: null });
      } catch (err) {
        setState({ loading: false, data: null, error: String(err) });
      }
    };

    const useMyLocation = () => {
      if (!navigator.geolocation) {
        setState({ loading: false, data: null, error: "Geolocation unavailable" });
        return;
      }
      setState(s => ({ ...s, loading: true, error: null }));
      navigator.geolocation.getCurrentPosition(
        pos => {
          const { latitude, longitude } = pos.coords;
          fetchByLatLon(latitude, longitude);
        },
        err => setState({ loading: false, data: null, error: err.message })
      );
    };

    return { ...state, fetchByLatLon, useMyLocation };
  }

  function ChartCard({ title, id }) {
    React.useEffect(() => {
      const ctx = document.getElementById(id);
      if (!ctx) return;
      if (ctx._chart) { ctx._chart.destroy(); }
    }, [id]);
    return e('div', { className: 'card' }, [
      e('div', { className: 'title', key: 't' }, title),
      e('canvas', { id, key: 'c', height: 160 }),
    ]);
  }

  const cropIcons = {
    rice: '🌾',
    wheat: '🌾',
    millet: '🌾',
    maize: '🌽',
    none: '❌'
  };

  function App() {
    const { loading, data, error, useMyLocation, fetchByLatLon } = useInsights();
    const [lat, setLat] = React.useState('');
    const [lon, setLon] = React.useState('');
    const placeInputId = 'placeInput';

    React.useEffect(() => {
      if (!data) return;
      const rainId = 'rainChart';
      const phId = 'phChart';
      const rainEl = document.getElementById(rainId);
      const phEl = document.getElementById(phId);
      if (rainEl) {
        if (rainEl._chart) rainEl._chart.destroy();
        const labels = ['Weekly Rainfall'];
        const dataset = [data.weather?.weekly_rain_mm || 0];
        rainEl._chart = new Chart(rainEl.getContext('2d'), {
          type: 'bar',
          data: { 
            labels, 
            datasets: [{ 
              label: 'Rainfall (mm)', 
              data: dataset, 
              backgroundColor: 'rgba(102, 126, 234, 0.8)',
              borderRadius: 8
            }] 
          },
          options: { 
            plugins: { legend: { display: false } }, 
            scales: { y: { beginAtZero: true, grid: { display: false } } }
          }
        });
      }
      if (phEl) {
        if (phEl._chart) phEl._chart.destroy();
        const labels = ['Soil pH'];
        const dataset = [data.soil?.ph ?? 0];
        phEl._chart = new Chart(phEl.getContext('2d'), {
          type: 'bar',
          data: { 
            labels, 
            datasets: [{ 
              label: 'pH Level', 
              data: dataset, 
              backgroundColor: 'rgba(16, 185, 129, 0.8)',
              borderRadius: 8
            }] 
          },
          options: { 
            plugins: { legend: { display: false } }, 
            scales: { y: { min: 3, max: 9, grid: { display: false } } }
          }
        });
      }
    }, [data]);

    React.useEffect(() => {
      const key = window.CONFIG && window.CONFIG.GMAPS_API_KEY;
      if (!key) return;
      if (window.google && window.google.maps && window.google.maps.places) {
        initPlaces();
        return;
      }
      const s = document.createElement('script');
      s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places&callback=initPlaces`;
      s.async = true;
      document.head.appendChild(s);
      window.initPlaces = function initPlaces() {
        const input = document.getElementById(placeInputId);
        if (!input || !window.google || !window.google.maps || !window.google.maps.places) return;
        const ac = new window.google.maps.places.Autocomplete(input, { fields: ['geometry'] });
        ac.addListener('place_changed', () => {
          const place = ac.getPlace();
          const loc = place && place.geometry && place.geometry.location;
          if (loc) {
            const plat = loc.lat();
            const plon = loc.lng();
            setLat(String(plat));
            setLon(String(plon));
            fetchByLatLon(plat, plon);
          }
        });
      };
    }, []);

    return e('div', { className: 'container' }, [
      e('div', { className: 'header', key: 'hdr' }, [
        e('h1', { key: 't' }, '🌾 Crop Recommendation System'),
        e('p', { key: 'sub' }, 'Get intelligent crop recommendations based on real-time weather and soil data'),
        e('div', { className: 'search-box', key: 'controls' }, [
          e('input', { key: 'place', id: placeInputId, placeholder: '🔍 Search location (e.g., Hisar, Haryana)' }),
          e('button', { key: 'loc', onClick: useMyLocation, disabled: loading }, loading ? '⏳ Loading...' : '📍 My Location')
        ])
      ]),

      data ? e('div', { className: 'card', key: 'stats' }, [
        e('div', { className: 'title', key: 't' }, '🌡️ Environmental Data'),
        e('div', { className: 'stat-grid', key: 'grid' }, [
          e('div', { className: 'stat-box', key: 's1' }, [
            e('div', { className: 'stat-label' }, 'Temperature'),
            e('div', { className: 'stat-value' }, `${data.weather?.avg_temp_c?.toFixed(1) || 0}°C`)
          ]),
          e('div', { className: 'stat-box', key: 's2' }, [
            e('div', { className: 'stat-label' }, 'Rainfall'),
            e('div', { className: 'stat-value' }, `${data.weather?.weekly_rain_mm?.toFixed(0) || 0}mm`)
          ]),
          e('div', { className: 'stat-box', key: 's3' }, [
            e('div', { className: 'stat-label' }, 'Soil pH'),
            e('div', { className: 'stat-value' }, `${data.soil?.ph?.toFixed(1) || 0}`)
          ]),
          e('div', { className: 'stat-box', key: 's4' }, [
            e('div', { className: 'stat-label' }, 'Location'),
            e('div', { className: 'stat-value', style: {fontSize: '16px'} }, `${data.location?.lat?.toFixed(2)}, ${data.location?.lon?.toFixed(2)}`)
          ])
        ])
      ]) : null,

      e('div', { className: 'row', key: 'charts' }, [
        e('div', { key: 'col-rain' }, e(ChartCard, { title: '💧 Weekly Rainfall', id: 'rainChart' })),
        e('div', { key: 'col-ph' }, e(ChartCard, { title: '🌱 Soil pH Level', id: 'phChart' })),
      ]),

      e('div', { className: 'card', key: 'rec' }, [
        e('div', { className: 'title' }, '✅ Recommended Crops'),
        data && data.recommendations ? 
          e('div', { className: 'chips' }, data.recommendations.map((r, idx) => 
            e('div', { className: 'chip', key: idx }, [
              e('span', { key: 'icon' }, cropIcons[r.crop] || '🌾'),
              e('span', { key: 'text' }, `${r.crop.toUpperCase()}: ${r.reason}`)
            ])
          )) : 
          e('p', { style: {color: '#718096', textAlign: 'center', padding: '20px'} }, '👆 Search a location to get crop recommendations'),
      ]),

      data && data.note ? e('div', { className: 'card warning', key: 'note' }, `ℹ️ ${data.note}`) : null,

      error ? e('div', { className: 'card error', key: 'err' }, `❌ ${error}`) : null,
    ]);
  }

  const root = ReactDOM.createRoot(document.getElementById('app'));
  root.render(e(App));
})();