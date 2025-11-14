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
        const labels = ['Wk Rain (mm)'];
        const dataset = [data.weather?.weekly_rain_mm || 0];
        rainEl._chart = new Chart(rainEl.getContext('2d'), {
          type: 'bar',
          data: { labels, datasets: [{ label: 'Rainfall', data: dataset, backgroundColor: '#60a5fa' }] },
          options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
        });
      }
      if (phEl) {
        if (phEl._chart) phEl._chart.destroy();
        const labels = ['Soil pH'];
        const dataset = [data.soil?.ph ?? 0];
        phEl._chart = new Chart(phEl.getContext('2d'), {
          type: 'bar',
          data: { labels, datasets: [{ label: 'pH', data: dataset, backgroundColor: '#34d399' }] },
          options: { plugins: { legend: { display: false } }, scales: { y: { min: 3, max: 9 } } }
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
      e('div', { className: 'card', key: 'hdr' }, [
        e('div', { className: 'title', key: 't' }, 'Crop Recommendation & Weather Insights'),
        e('div', { className: 'small', key: 'sub' }, 'Use device location or search a place to fetch weather and soil data.'),
        e('div', { style: { display: 'flex', gap: 8, marginTop: 12 }, key: 'controls' }, [
          e('button', { key: 'loc', onClick: useMyLocation, disabled: loading }, loading ? 'Loading…' : 'Use my location'),
          e('input', { key: 'place', id: placeInputId, placeholder: 'Search place (Google Places)' })
        ])
      ]),

      e('div', { className: 'row', key: 'charts' }, [
        e('div', { className: 'col', key: 'col-rain' }, e(ChartCard, { title: 'Weekly Rainfall', id: 'rainChart' })),
        e('div', { className: 'col', key: 'col-ph' }, e(ChartCard, { title: 'Soil pH (0–5cm)', id: 'phChart' })),
      ]),

      e('div', { className: 'card', key: 'rec' }, [
        e('div', { className: 'title' }, 'Recommendations'),
        data && data.recommendations ? e('div', { className: 'chips' }, data.recommendations.map((r, idx) => e('div', { className: 'chip', key: idx }, `${r.crop}: ${r.reason}`))) : e('div', null, 'No data yet'),
      ]),

      error ? e('div', { className: 'card' }, `Error: ${error}`) : null,
    ]);
  }

  const root = ReactDOM.createRoot(document.getElementById('app'));
  root.render(e(App));
})();