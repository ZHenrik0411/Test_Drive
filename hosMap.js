/* Hospital Map */

function renderHospitalsMap(filteredHospitals) {
  const previewContainer = document.getElementById('map-preview-container');
  const floatingPillLocation = document.getElementById('map-floating-location');
  const floatingPillBlood = document.getElementById('map-floating-blood');

  if (floatingPillLocation) {
    floatingPillLocation.textContent = state.hospitalsFilter.municipality;
  }
  if (floatingPillBlood) {
    floatingPillBlood.textContent =
      state.hospitalsFilter.bloodType === 'All' ? 'All Blood' : state.hospitalsFilter.bloodType;
  }

  // Ensure active map hospital is within filtered or fallback
  if (!filteredHospitals.some((h) => h.id === state.activeMapHospital?.id)) {
    state.activeMapHospital = filteredHospitals[0] || state.hospitals[0];
  }

  const mapEl = document.getElementById('leaflet-map');
  if (!mapEl) return;

  const tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

  // Initialize map if not yet created
  if (!leafletMap) {
    leafletMap = L.map('leaflet-map', {
      center: [14.4600, 120.8950], // Cavite District 1 center
      zoom: 13,
      zoomControl: false,
      attributionControl: false,
    });

    L.control.zoom({ position: 'topright' }).addTo(leafletMap);

    leafletTileLayer = L.tileLayer(tileUrl, {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(leafletMap);

    markersLayer = L.layerGroup().addTo(leafletMap);

    // Wire up "Locate Me" GPS button
    document.getElementById('map-locate-me-btn')?.addEventListener('click', () => {
      if ('geolocation' in navigator) {
        showToast('Acquiring your location in Cavite...');
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const uLat = pos.coords.latitude;
            const uLng = pos.coords.longitude;
            if (userLocationMarker) {
              userLocationMarker.setLatLng([uLat, uLng]);
            } else {
              const userIcon = L.divIcon({
                className: '',
                html: `
                  <div class="user-location-marker">
                    <div class="user-location-pulse"></div>
                    <div class="user-location-core"></div>
                  </div>
                `,
                iconSize: [28, 28],
                iconAnchor: [14, 14],
              });
              userLocationMarker = L.marker([uLat, uLng], { icon: userIcon }).addTo(leafletMap);
              userLocationMarker.bindPopup('<b>Your Current Location</b>').openPopup();
            }
            leafletMap.flyTo([uLat, uLng], 14, { duration: 1.2 });
            showToast('Centered on your location!');
          },
          () => {
            showToast('Location access was denied or is unavailable.');
          }
        );
      } else {
        showToast('Geolocation is not supported by your browser.');
      }
    });
  }

  // Clear previous markers
  if (markersLayer) {
    markersLayer.clearLayers();
  }

  // Add Leaflet markers for each hospital
  const bounds = L.latLngBounds();

  filteredHospitals.forEach((hospital) => {
    if (!hospital.lat || !hospital.lng) return;

    const isSelected = state.activeMapHospital?.id === hospital.id;
    bounds.extend([hospital.lat, hospital.lng]);

    const markerIcon = L.divIcon({
      className: '',
      html: `
        <div class="bloodsync-marker-wrapper ${isSelected ? 'is-selected' : ''}" data-hospital-id="${hospital.id}">
          <div class="bloodsync-marker-pulse"></div>
          <div class="bloodsync-marker-core">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5C12 2.5 5 13 5 17.5C5 21.5 8.1 24 12 24C15.9 24 19 21.5 19 17.5C19 13 12 2.5 12 2.5Z"/></svg>
          </div>
        </div>
      `,
      iconSize: [44, 44],
      iconAnchor: [22, 22],
      popupAnchor: [0, -18],
    });

    const marker = L.marker([hospital.lat, hospital.lng], { icon: markerIcon });

    // Urgent blood badges for popup
    const urgentBadges = hospital.bloodNeeded
      .slice(0, 3)
      .map(
        (b) =>
          `<span class="px-1.5 py-0.5 rounded bg-rose-950 text-rose-200 font-bold text-[10px] border border-rose-800">${b.type} (${b.unitsNeeded}u)</span>`
      )
      .join(' ');

    const popupHtml = `
      <div class="w-64 p-3.5 space-y-2 text-stone-100 font-sans">
        <div class="h-24 w-full rounded-xl overflow-hidden mb-2 bg-stone-900 border border-rose-900/40">
          <img src="${hospital.image}" alt="${hospital.name}" class="w-full h-full object-cover" />
        </div>
        <h4 class="font-bold text-sm text-white leading-tight">${hospital.name}</h4>
        <p class="text-xs text-rose-200/80 leading-snug">${hospital.address}</p>
        <div class="flex flex-wrap gap-1 pt-1">${urgentBadges}</div>
        <button
          onclick="window.bloodsyncNavigateToHospital('${hospital.id}')"
          class="w-full mt-2.5 py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs uppercase tracking-wider text-center cursor-pointer shadow transition-colors block"
        >
          View Hospital Details →
        </button>
      </div>
    `;

    marker.bindPopup(popupHtml, { className: 'bloodsync-popup', maxWidth: 280 });

    marker.on('click', () => {
      state.activeMapHospital = hospital;
      renderMapDrawerPreview(hospital);
      renderHospitalsMap(filteredHospitals);
    });

    markersLayer.addLayer(marker);
  });

  // Fit bounds if valid
  if (filteredHospitals.length > 0 && bounds.isValid()) {
    leafletMap.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
  }

  // Invalidate map size so tiles render smoothly
  setTimeout(() => {
    if (leafletMap) leafletMap.invalidateSize();
  }, 100);

  // Render bottom drawer preview
  if (state.activeMapHospital) {
    renderMapDrawerPreview(state.activeMapHospital);
  }
}

function renderMapDrawerPreview(hospital) {
  const previewContainer = document.getElementById('map-preview-container');
  if (!previewContainer || !hospital) return;

  previewContainer.innerHTML = `
    <div class="bg-[#4E080C] text-white rounded-2xl p-4 sm:p-5 shadow-2xl border border-rose-900/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div class="flex items-start gap-3.5">
        <div class="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-rose-300 shrink-0 mt-0.5">
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
        </div>
        <div>
          <h4 class="text-base sm:text-lg font-bold text-white leading-tight">
            ${hospital.name}
          </h4>
          <p class="text-xs sm:text-sm text-stone-300 mt-0.5">
            ${hospital.address}
          </p>
          <div class="flex flex-wrap gap-2 mt-2">
            <span class="text-[11px] font-bold px-2 py-0.5 rounded bg-rose-950/80 text-rose-200 border border-rose-800/40">
              Urgent Needs: ${hospital.bloodNeeded.map((b) => `${b.type} (${b.unitsNeeded}u)`).join(', ')}
            </span>
          </div>
        </div>
      </div>

      <button
        id="choose-hospital-cta-btn"
        class="w-full sm:w-auto px-6 py-3 rounded-xl bg-white text-[#4E080C] hover:bg-rose-100 font-extrabold text-sm uppercase tracking-wider shadow-lg transition-all text-center shrink-0 cursor-pointer"
      >
        Choose this Hospital
      </button>
    </div>
  `;

  document.getElementById('choose-hospital-cta-btn')?.addEventListener('click', () => {
    navigateTo('hospitals', hospital);
  });
}
