/**
 * =================================================================
 * MAPMARKET - GESTION DE LA CARTE (map.js)
 * =================================================================
 * Rôle : Initialiser et gérer toutes les interactions avec la carte Leaflet.
 */
import { fetchAds } from './services.js';
import { openModal } from './ui.js';
import { showToast } from './utils.js';

let map;
let markerClusterGroup;

export function initializeMap(mapId) {
    try {
        map = L.map(mapId, { zoomControl: false }).setView([46.6, 1.88], 6);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);

        L.control.zoom({ position: 'bottomright' }).addTo(map);
        markerClusterGroup = L.markerClusterGroup().addTo(map);

        // CORRECTION : L'écouteur manquant pour le bouton "Explorer" est ajouté ici.
        document.getElementById('nav-explore-btn').addEventListener('click', geolocateUser);
        document.getElementById('map-geolocate-btn').addEventListener('click', geolocateUser);
        
        loadAndDisplayAds();
        console.log("Carte Leaflet initialisée.");
    } catch (error) {
        console.error("Erreur init carte:", error);
    }
}

export async function loadAndDisplayAds(filters = {}) {
    try {
        const ads = await fetchAds(filters);
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
        
        map.on('popupopen', function (e) {
            const btn = e.popup._container.querySelector('[data-action="open-ad-detail"]');
            if (btn) {
                btn.addEventListener('click', () => {
                    const adId = btn.dataset.id;
                    // Il faudra implémenter la fonction qui ouvre la modale de détail
                    // openAdDetailModal(adId);
                    showToast(`Ouverture de l'annonce ${adId}`);
                });
            }
        });

    } catch (error) {
        console.error("Erreur chargement annonces:", error);
        showToast("Impossible de charger les annonces.", "error");
    }
}

function geolocateUser() {
    if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(position => {
            const { latitude, longitude } = position.coords;
            // CORRECTION : Utilisation de flyTo pour une animation fluide.
            map.flyTo([latitude, longitude], 15); 
            
            const userIcon = L.divIcon({ 
                className: 'pulsing-marker-visuals', 
                iconSize: [24, 24],
                iconAnchor: [12, 12] // Centre l'icône
            });
            L.marker([latitude, longitude], { icon: userIcon }).addTo(map).bindPopup('Vous êtes ici');
            showToast("Position trouvée !", "success");
        }, () => showToast("Impossible d'obtenir votre position.", "warning"));
    } else {
        showToast("La géolocalisation n'est pas disponible sur votre navigateur.", "error");
    }
}