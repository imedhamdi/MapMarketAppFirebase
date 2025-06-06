export function initAdDetail() {
    document.addEventListener('click', async (e) => {
        const btn = e.target.closest('[data-action="open-ad-detail"]');
        if (btn) {
            e.preventDefault();
            const adId = btn.dataset.id;
            if (adId) {
                await showAdDetail(adId);
            }
        }
    });
}

import { openModal, closeModal } from './ui.js';
import { fetchAdById } from './services.js';
import { showToast } from './utils.js';

async function showAdDetail(adId) {
    const modal = document.getElementById('ad-detail-modal');
    const loader = document.getElementById('ad-detail-loader');
    const content = document.getElementById('ad-detail-content');
    openModal('ad-detail-modal');
    modal.dataset.adId = adId;
    loader.classList.remove('hidden');
    content.classList.add('hidden');
    try {
        const ad = await fetchAdById(adId);
        if (!ad) throw new Error('Annonce introuvable');
        document.getElementById('ad-detail-item-title').textContent = ad.title;
        document.getElementById('ad-detail-price').textContent = `${ad.price} €`;
        document.getElementById('ad-detail-description-text').textContent = ad.description || '';
        document.getElementById('ad-detail-category').innerHTML = `<i class="fa-solid fa-tag"></i> ${ad.categoryId}`;
        document.getElementById('ad-detail-location').innerHTML = `<i class="fa-solid fa-map-marker-alt"></i> ${ad.location?.address || ''}`;
        if (ad.createdAt?.seconds) {
            const d = new Date(ad.createdAt.seconds * 1000);
            document.getElementById('ad-detail-date').innerHTML = `<i class="fa-solid fa-calendar-days"></i> ${d.toLocaleDateString()}`;
        }
        const track = document.getElementById('ad-detail-carousel-track');
        track.innerHTML = '';
        if (Array.isArray(ad.images)) {
            ad.images.forEach(url => {
                const img = document.createElement('img');
                img.src = url;
                img.alt = ad.title;
                img.loading = 'lazy';
                track.appendChild(img);
            });
        }
        loader.classList.add('hidden');
        content.classList.remove('hidden');
    } catch (err) {
        console.error(err);
        loader.querySelector('p').textContent = "Erreur lors du chargement";
        showToast("Impossible d'afficher l'annonce", "error");
    }
}
