/**
 * =================================================================
 * MAPMARKET - GESTION DE LA MESSAGERIE (chat.js)
 * =================================================================
 * Rôle : Gérer l'affichage des discussions et des messages.
 */
import { showToast } from './utils.js';
import { openModal, closeModal } from './ui.js';
import { fetchUserChats, listenToMessages, sendMessage, fetchUserProfile, createChat } from './services.js';
import { getState } from './state.js';

let unsubscribeFromMessages = null;
let currentChatId = null;

export function initChat() {
    document.getElementById('nav-messages-btn').addEventListener('click', openMessages);
    document.getElementById('ad-detail-contact-seller-btn').addEventListener('click', handleContactSeller);
    document.getElementById('send-chat-message-btn').addEventListener('click', handleSendMessage);
    document.getElementById('back-to-threads-btn').addEventListener('click', showThreadListView);
}

async function openMessages() {
    if (!getState().isLoggedIn) {
        showToast("Connectez-vous pour voir vos messages.", "error");
        openModal('auth-modal');
        return;
    }
    openModal('messages-modal');
    await loadUserChats();
    showThreadListView();
}

async function loadUserChats() {
    const { currentUser } = getState();
    if (!currentUser) return;

    const listEl = document.getElementById('thread-list');
    const placeholder = document.getElementById('no-threads-placeholder');
    listEl.innerHTML = '';
    
    try {
        const chats = await fetchUserChats(currentUser.uid);
        placeholder.classList.toggle('hidden', chats.length > 0);

        const template = document.getElementById('thread-item-template');
        for (const chat of chats) {
            const recipientId = chat.participants.find(p => p !== currentUser.uid);
            const recipientProfile = await fetchUserProfile(recipientId);

            const item = template.content.cloneNode(true).firstElementChild;
            item.dataset.threadId = chat.id;
            item.querySelector('.thread-user').textContent = recipientProfile?.username || "Utilisateur inconnu";
            item.querySelector('.thread-preview').textContent = chat.lastMessage?.text || "Démarrer la conversation";
            item.querySelector('.thread-avatar').src = recipientProfile?.avatarUrl || 'https://placehold.co/48x48';
            
            item.onclick = () => showChatView(chat.id, recipientProfile);
            listEl.appendChild(item);
        }
    } catch (error) {
        console.error("Erreur chargement chats:", error);
        showToast("Erreur de chargement des discussions.", "error");
    }
}

function showChatView(chatId, recipientProfile) {
    currentChatId = chatId;
    
    // Met à jour l'entête du chat
    document.getElementById('chat-recipient-name').textContent = recipientProfile.username;
    document.getElementById('chat-recipient-avatar').src = recipientProfile.avatarUrl || 'https://placehold.co/36x36';
    
    document.getElementById('thread-list-view').classList.remove('active-view');
    document.getElementById('chat-view').classList.add('active-view');

    if (unsubscribeFromMessages) unsubscribeFromMessages();
    
    const container = document.getElementById('chat-messages-container');
    container.innerHTML = '<div class="loader-container"><div class="spinner"></div></div>';
    
    unsubscribeFromMessages = listenToMessages(chatId, (messages) => {
        renderMessages(messages, container);
    });
}

function renderMessages(messages, container) {
    container.innerHTML = '';
    const template = document.getElementById('chat-message-template');
    const { currentUser } = getState();

    messages.forEach(msg => {
        const item = template.content.cloneNode(true).firstElementChild;
        item.querySelector('.message-text').textContent = msg.text;
        item.dataset.senderId = msg.senderId === currentUser.uid ? 'me' : 'other';
        container.appendChild(item);
    });
    container.scrollTop = container.scrollHeight;
}

async function handleSendMessage() {
    const input = document.getElementById('chat-message-input');
    const text = input.value.trim();
    const { currentUser } = getState();

    if (text && currentChatId && currentUser) {
        const originalText = text;
        input.value = '';
        input.focus();
        try {
            await sendMessage(currentChatId, text, currentUser.uid);
        } catch (error) {
            console.error("Erreur envoi message:", error);
            showToast("Le message n'a pas pu être envoyé.", "error");
            input.value = originalText;
        }
    }
}

async function handleContactSeller(event) {
    const sellerId = event.target.dataset.sellerId;
    const adId = event.target.dataset.adId;
    
    if (!getState().isLoggedIn) {
        showToast("Connectez-vous pour contacter le vendeur.", "error");
        openModal('auth-modal');
        return;
    }
    
    showGlobalLoader("Création de la discussion...");
    try {
        const chatId = await createChat(adId, sellerId);
        const sellerProfile = await fetchUserProfile(sellerId);
        
        closeModal('ad-detail-modal'); // Ferme l'annonce
        openModal('messages-modal'); // Ouvre la messagerie
        showChatView(chatId, sellerProfile); // Affiche directement le chat
    } catch(error) {
        console.error("Erreur création chat:", error);
        showToast("Impossible de démarrer la discussion.", "error");
    } finally {
        hideGlobalLoader();
    }
}

function showThreadListView() {
    if (unsubscribeFromMessages) {
        unsubscribeFromMessages();
        unsubscribeFromMessages = null;
    }
    currentChatId = null;
    document.getElementById('chat-view').classList.remove('active-view');
    document.getElementById('thread-list-view').classList.add('active-view');
}
