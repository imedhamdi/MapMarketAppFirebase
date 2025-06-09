/**
 * =================================================================
 * MAPMARKET - GESTION DE LA CARTE (map.js)
 * =================================================================
 * Rôle : Initialiser et gérer toutes les interactions avec la carte Leaflet.
 */
import { fetchAds } from './services.js';
import { showToast } from './utils.js';
import { openAdDetail } from './ad-detail.js';

let map;
let markerClusterGroup;
let adsDataCache = []; // Cache pour les données des annonces

function getMap() {
    return map;
}

function initializeMap(mapId) {
    try {
        map = L.map(mapId, { zoomControl: false }).setView([46.6, 1.88], 6);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);

        L.control.zoom({ position: 'bottomright' }).addTo(map);
        markerClusterGroup = L.markerClusterGroup().addTo(map);

        document.getElementById('nav-explore-btn').addEventListener('click', geolocateUser);
        document.getElementById('map-geolocate-btn').addEventListener('click', geolocateUser);
        
        // CORRECTION: Event delegation for popups
        map.getContainer().addEventListener('click', (e) => {
            if (e.target.dataset.action === 'open-ad-detail') {
                const adId = e.target.dataset.id;
                if (adId) {
                    openAdDetail(adId);
                }
            }
        });
        
        loadAndDisplayAds();
        console.log("Carte Leaflet initialisée.");
    } catch (error) {
        console.error("Erreur init carte:", error);
    }
}

async function loadAndDisplayAds(filters = {}) {
    try {
        const ads = await fetchAds(filters);
        adsDataCache = ads; // Met en cache les annonces
        displayAdsOnMap(adsDataCache);
    } catch (error) {
        console.error("Erreur chargement annonces:", error);
        showToast("Impossible de charger les annonces.", "error");
    }
}

function displayAdsOnMap(ads) {
    markerClusterGroup.clearLayers();
    ads.forEach(ad => {
        if (ad.location?.coordinates) {
            const { latitude, longitude } = ad.location.coordinates;
            const marker = L.marker([latitude, longitude]);
            
            const popupContent = `
                <div style="text-align:center;">
                    <strong>${ad.title}</strong><br>
                    <p style="font-size:1.1em; color:var(--primary-color); font-weight:bold; margin:4px 0;">${ad.price} €</p>
                    <img src="${ad.images?.[0] || 'https://placehold.co/100x80'}" alt="${ad.title}" style="width:100px; height:auto; border-radius:4px; margin-bottom:8px;">
                    <br>
                    <button class="btn btn-sm btn-primary" data-action="open-ad-detail" data-id="${ad.id}">Voir</button>
                </div>`;
            marker.bindPopup(popupContent);
            markerClusterGroup.addLayer(marker);
        }
    });
}

function geolocateUser() {
    if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(position => {
            const { latitude, longitude } = position.coords;
            map.flyTo([latitude, longitude], 15); 
            
            const userIcon = L.divIcon({ 
                className: 'pulsing-marker-visuals', 
                iconSize: [24, 24],
                iconAnchor: [12, 12]
            });
            L.marker([latitude, longitude], { icon: userIcon }).addTo(map).bindPopup('Vous êtes ici').openPopup();
            showToast("Position trouvée !", "success");
        }, () => showToast("Impossible d'obtenir votre position.", "warning"));
    } else {
        showToast("La géolocalisation n'est pas disponible sur votre navigateur.", "error");
    }
}

export { initializeMap, loadAndDisplayAds, getMap, adsDataCache };