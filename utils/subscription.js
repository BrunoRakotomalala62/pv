const fs = require('fs-extra');
const path = require('path');

// Chemin vers le fichier des UIDs (gardé pour éviter les erreurs)
const uidFilePath = path.join(__dirname, '../Facebook/uid.txt');

/**
 * Vérifie si un utilisateur est abonné - modifié pour autoriser tous les utilisateurs
 * @param {string} uid - L'UID de l'utilisateur
 * @returns {Object} - Statut de l'abonnement (toujours true)
 */
function checkSubscription(uid) {
    return {
        isSubscribed: true,
        expirationDate: "9999-12-31", // Date d'expiration fictive très lointaine
        daysLeft: 9999 // Nombre élevé de jours
    };
}

/**
 * Ajoute ou met à jour un abonnement (fonctions gardées pour compatibilité)
 */
function addSubscription(uid, monthsOrDate = 1) {
    return true; // Toujours réussi
}

/**
 * Supprime un abonnement (fonctions gardées pour compatibilité)
 */
function removeSubscription(uid) {
    return true; // Toujours réussi
}

module.exports = {
    checkSubscription,
    addSubscription,
    removeSubscription
};