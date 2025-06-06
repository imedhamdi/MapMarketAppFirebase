/**
 * =================================================================
 * MAPMARKET - FONCTIONS UTILITAIRES (utils.js)
 * =================================================================
 * Rôle : Fournir des fonctions d'aide et des classes réutilisables
 * pour la validation, les notifications et autres tâches courantes.
 */

// --- Notifications Toast ---

/**
 * Affiche une notification "toast" à l'utilisateur.
 * @param {string} message - Le message à afficher.
 * @param {string} type - Le type de toast ('info', 'success', 'warning', 'error').
 * @param {number} duration - La durée d'affichage en millisecondes.
 */
export function showToast(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toast-notifications-container');
    if (!container) return;

    const toastTemplate = document.getElementById('toast-notification-template');
    const toast = toastTemplate.content.cloneNode(true).firstElementChild;

    toast.dataset.toastType = type;
    toast.querySelector('.toast-message').textContent = message;

    const icon = toast.querySelector('.toast-icon');
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-times-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle',
    };
    icon.className = `toast-icon fa-solid ${icons[type] || icons.info}`;
    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.add('toast-visible');
    });

    const timeoutId = setTimeout(() => hideToast(toast), duration);
    toast.querySelector('.toast-close-btn').onclick = () => {
        clearTimeout(timeoutId);
        hideToast(toast);
    };
}

function hideToast(toast) {
    toast.classList.remove('toast-visible');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
}

// --- Chargeurs (Loaders) ---

export function showGlobalLoader(message = "Chargement...") {
    const loader = document.getElementById('global-loader-container');
    if (loader) {
        loader.querySelector('#global-loader-message').textContent = message;
        loader.classList.remove('hidden');
        loader.setAttribute('aria-busy', 'true');
    }
}

export function hideGlobalLoader() {
    const loader = document.getElementById('global-loader-container');
    if (loader) {
        loader.classList.add('hidden');
        loader.setAttribute('aria-busy', 'false');
    }
}

// --- Validation de Formulaires ---

export function validateForm(formElement) {
    let isValid = true;
    const errors = {};

    formElement.querySelectorAll('[required], [minlength], [type="email"], [data-match]').forEach(input => {
        const fieldName = input.name || input.id;
        const errorElement = formElement.querySelector(`#${input.id}-error`);
        let errorMessage = '';

        if (input.hasAttribute('required') && !input.value.trim()) {
            errorMessage = 'Ce champ est requis.';
        } else if (input.type === 'email' && !/\S+@\S+\.\S+/.test(input.value)) {
            errorMessage = 'Veuillez entrer une adresse email valide.';
        } else if (input.hasAttribute('minlength') && input.value.length < input.getAttribute('minlength')) {
            errorMessage = `Ce champ doit contenir au moins ${input.getAttribute('minlength')} caractères.`;
        } else if (input.dataset.match) {
            const matchElement = formElement.querySelector(`#${input.dataset.match}`);
            if (matchElement && input.value !== matchElement.value) {
                errorMessage = 'Les mots de passe ne correspondent pas.';
            }
        }

        if (errorMessage) {
            isValid = false;
            errors[fieldName] = errorMessage;
            if (errorElement) {
                errorElement.textContent = errorMessage;
                errorElement.style.display = 'block';
            }
            input.setAttribute('aria-invalid', 'true');
        } else {
            if (errorElement) {
                errorElement.textContent = '';
                errorElement.style.display = 'none';
            }
            input.setAttribute('aria-invalid', 'false');
        }
    });

    return { isValid, errors };
}

// --- Formatage ---

export function formatRelativeTime(date) {
    // Implémentation simplifiée. Pour une solution robuste, utiliser une librairie comme date-fns.
    const now = new Date();
    const seconds = Math.round((now - date) / 1000);
    const minutes = Math.round(seconds / 60);
    const hours = Math.round(minutes / 60);
    const days = Math.round(hours / 24);

    if (seconds < 60) return `à l'instant`;
    if (minutes < 60) return `il y a ${minutes} min`;
    if (hours < 24) return `il y a ${hours} h`;
    if (days < 7) return `il y a ${days} j`;
    return `le ${date.toLocaleDateString('fr-FR')}`;
}
