/**
 * =================================================================
 * MAPMARKET - GESTION DU DÉTAIL D'UNE ANNONCE (ad-detail.js)
 * =================================================================
 * @file Gère l'affichage des informations détaillées d'une annonce
 * dans sa modale dédiée.
 */

import { openModal, closeModal } from './ui.js';
import { fetchAdById, fetchUserProfile } from './services.js';
import { showToast } from './utils.js';
import { getState } from './state.js';

/**
 * Initialise les comportements spécifiques à la modale de détail d'annonce.
 * La plupart des déclencheurs d'ouverture sont gérés par délégation d'événements.
 */
export function initAdDetail() {
    // Cet espace peut être utilisé pour de futurs écouteurs d'événements
    // spécifiques à l'intérieur de la modale de détail (ex: carrousel, etc.).
}

/**
 * Ouvre la modale de détail pour une annonce spécifique et la remplit avec les données.
 * @param {string} adId - L'ID de l'annonce à afficher.
 */
export async function openAdDetail(adId) {
    const modal = document.getElementById('ad-detail-modal');
    if (!modal) return;

    const loader = document.getElementById('ad-detail-loader');
    const content = document.getElementById('ad-detail-content');

    openModal('ad-detail-modal');
    modal.dataset.adId = adId;

    loader.classList.remove('hidden');
    content.classList.add('hidden');

    try {
        const ad = await fetchAdById(adId, true); // true pour incrémenter le compteur de vues
        if (!ad) throw new Error("Annonce introuvable");

        const { allCategories, currentUser } = getState();

        // Remplissage des informations de base
        document.getElementById('ad-detail-item-title').textContent = ad.title;
        document.getElementById('ad-detail-price').textContent = `${ad.price} €`;
        document.getElementById('ad-detail-description-text').textContent = ad.description || 'Aucune description fournie.';

        const category = allCategories.find(c => c.id === ad.categoryId)?.name_fr || 'Inconnue';
        document.getElementById('ad-detail-category').innerHTML = `<i class="fa-solid fa-tag"></i> ${category}`;
        document.getElementById('ad-detail-location').innerHTML = `<i class="fa-solid fa-map-marker-alt"></i> ${ad.location?.address || 'Non spécifiée'}`;
        
        if (ad.createdAt?.seconds) {
            const d = new Date(ad.createdAt.seconds * 1000);
            document.getElementById('ad-detail-date').innerHTML = `<i class="fa-solid fa-calendar-days"></i> Publiée le ${d.toLocaleDateString()}`;
        } else {
            document.getElementById('ad-detail-date').innerHTML = '';
        }

        // Gestion du carrousel d'images
        const carouselContainer = document.getElementById('ad-detail-carousel-container');
        const track = document.getElementById('ad-detail-carousel-track');
        track.innerHTML = '';
        if (ad.images && ad.images.length > 0) {
            ad.images.forEach(url => {
                const img = document.createElement('img');
                img.src = url;
                img.alt = ad.title;
                img.loading = 'lazy';
                track.appendChild(img);
            });
            carouselContainer.classList.remove('hidden');
        } else {
            carouselContainer.classList.add('hidden');
        }

        // Gestion des informations du vendeur
        const sellerProfile = await fetchUserProfile(ad.sellerId);
        if (sellerProfile) {
            document.getElementById('ad-detail-seller-name').textContent = sellerProfile.username;
            document.getElementById('ad-detail-seller-avatar').src = sellerProfile.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(sellerProfile.username)}&background=4f46e5&color=fff`;
        }

        // Logique d'affichage des boutons d'action
        const contactBtn = document.getElementById('ad-detail-contact-seller-btn');
        const favoriteBtn = document.getElementById('ad-detail-favorite-btn');
        const ownerActions = document.getElementById('ad-detail-owner-actions');
        
        contactBtn.dataset.sellerId = ad.sellerId;
        contactBtn.dataset.adId = adId;
        favoriteBtn.dataset.adId = adId;

        // Afficher/masquer les boutons si l'utilisateur est le vendeur
        if (currentUser && currentUser.uid === ad.sellerId) {
            ownerActions.classList.remove('hidden');
            contactBtn.parentElement.classList.add('hidden');
        } else {
            ownerActions.classList.add('hidden');
            contactBtn.parentElement.classList.remove('hidden');
        }

        // Afficher le contenu
        loader.classList.add('hidden');
        content.classList.remove('hidden');

    } catch (err) {
        console.error("Erreur lors de l'affichage de l'annonce :", err);
        loader.querySelector('p').textContent = "Erreur : Annonce introuvable.";
        showToast("Impossible d'afficher cette annonce.", "error");
        setTimeout(() => closeModal('ad-detail-modal'), 1500);
    }
}