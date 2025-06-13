const userIcon = L.icon({
  iconUrl: 'assets/user-icon.png',
  iconSize: [40, 40],
  iconAnchor: [20, 40]
});

const facilityIcon = L.icon({
  iconUrl: 'assets/facility-icon.png',
  iconSize: [36, 36],
  iconAnchor: [18, 36]
});

const map = L.map('map').setView([-7.7956, 110.3695], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19
}).addTo(map);

let userMarker = null;
let routingControl = null;
let apotekData = null; // ✅ Global variable
const infoBox = document.getElementById('infoBox');

// Haversine
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371e3, toRad = deg => deg * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Fetch GeoJSON and Init Map Layers
Promise.all([
  fetch('data/roads.geojson').then(res => res.json()),
  fetch('data/apotek.geojson').then(res => res.json())
]).then(([roads, apoteks]) => {
  apotekData = apoteks; // ✅ Save globally

  L.geoJSON(roads, {
    style: {
      color: '#e75480',
      weight: 4,
      opacity: 0.6,
      dashArray: '6 9'
    }
  }).addTo(map);

  L.geoJSON(apoteks, {
    pointToLayer: (feature, latlng) =>
      L.marker(latlng, {
        icon: facilityIcon,
        title: feature.properties.name || feature.properties.NAMA_RS || 'Unnamed Facility'
      }),
    onEachFeature: (feature, layer) => {
      const nama = feature.properties.name || feature.properties.NAMA_RS || 'Unnamed Facility';
      layer.bindPopup(`<strong>${nama}</strong>`);
    }
  }).addTo(map);

  function findNearest(lat, lng) {
    let minDist = Infinity, nearest = null;
    apoteks.features.forEach(f => {
      const [lon, lat_] = f.geometry.coordinates;
      const dist = haversineDistance(lat, lng, lat_, lon);
      const name = f.properties.name || f.properties.NAMA_RS || 'Unnamed Facility';
      if (dist < minDist) {
        minDist = dist;
        nearest = { lat: lat_, lng: lon, name, dist };
      }
    });
    return nearest;
  }

  function updateUserLocation(pos) {
    const lat = pos.coords.latitude, lng = pos.coords.longitude;

    if (!userMarker) {
      userMarker = L.marker([lat, lng], { icon: userIcon }).addTo(map);
      map.setView([lat, lng], 15);
    } else {
      userMarker.setLatLng([lat, lng]);
    }

    const nearest = findNearest(lat, lng);
    if (!nearest) return infoBox.textContent = 'Tidak ada fasilitas ditemukan.';

    infoBox.textContent =
      `Apotek Terdekat: ${nearest.name}, approx ${(nearest.dist / 1000).toFixed(2)} km away. Calculating route…`;

    if (routingControl) {
      routingControl.setWaypoints([L.latLng(lat, lng), L.latLng(nearest.lat, nearest.lng)]);
    } else {
      routingControl = L.Routing.control({
        waypoints: [L.latLng(lat, lng), L.latLng(nearest.lat, nearest.lng)],
        lineOptions: {
          styles: [{ color: '#e75480', opacity: 0.85, weight: 6 }]
        },
        createMarker: () => null,
        addWaypoints: false,
        draggableWaypoints: false,
        fitSelectedRoutes: true,
        showAlternatives: false
      }).addTo(map);
    }
  }

  if ('geolocation' in navigator) {
    navigator.geolocation.watchPosition(updateUserLocation, () => {
      infoBox.textContent = 'Aktifkan layanan lokasi.';
    }, {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 10000
    });
  } else {
    infoBox.textContent = 'Geolocation tidak didukung browser ini.';
  }

});

// Sidebar toggle
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebarToggle');
sidebarToggle.addEventListener('click', () => {
  sidebar.style.display = sidebar.style.display === 'flex' ? 'none' : 'flex';
});

// Tombol lihat daftar apotek
const listBtn = document.getElementById('listBtn');
listBtn.addEventListener('click', () => {
  if (!apotekData) {
    alert('Data apotek belum dimuat.');
    return;
  }

// Tombol pilih lokasi manual
const manualBtn = document.getElementById('manualBtn');
let manualMode = false;
let manualMarker = null;

manualBtn?.addEventListener('click', () => {
  manualMode = true;
  alert('Klik di peta untuk memilih lokasi secara manual.');
});

map.on('click', (e) => {
  if (!manualMode || !apotekData) return;

  manualMode = false;

  const { lat, lng } = e.latlng;

  // Hapus marker sebelumnya (jika ada)
  if (manualMarker) {
    map.removeLayer(manualMarker);
  }

  manualMarker = L.marker([lat, lng], {
    icon: userIcon,
    title: 'Lokasi Manual'
  }).addTo(map);

  map.setView([lat, lng], 15);

  const nearest = apotekData.features.reduce((acc, f) => {
    const [lon, lat_] = f.geometry.coordinates;
    const dist = haversineDistance(lat, lng, lat_, lon);
    const name = f.properties.name || f.properties.NAMA_RS || 'Unnamed Facility';
    return dist < acc.dist ? { lat: lat_, lng: lon, name, dist } : acc;
  }, { dist: Infinity });

  infoBox.textContent = `Apotek Terdekat: ${nearest.name}, approx ${(nearest.dist / 1000).toFixed(2)} km away.`;

  if (routingControl) {
    routingControl.setWaypoints([L.latLng(lat, lng), L.latLng(nearest.lat, nearest.lng)]);
  } else {
    routingControl = L.Routing.control({
      waypoints: [L.latLng(lat, lng), L.latLng(nearest.lat, nearest.lng)],
      lineOptions: {
        styles: [{ color: '#e75480', opacity: 0.85, weight: 6 }]
      },
      createMarker: () => null,
      addWaypoints: false,
      draggableWaypoints: false,
      fitSelectedRoutes: true,
      showAlternatives: false
    }).addTo(map);
  }
});

  
  const names = apotekData.features
    .map(f => f.properties.name || f.properties.NAMA_RS || 'Unnamed')
    .join('\n');

  alert(`Daftar Apotek:\n\n${names}`);
});

