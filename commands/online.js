
const axios = require('axios');
const sendMessage = require('../handles/sendMessage');

// Base URL de l'API
const BASE_API_URL = 'https://zaikyoov3-up.up.railway.app/api/r1-online';

module.exports = async (senderId, userText) => {
    // Extraire le prompt en retirant le préfixe 'online' et en supprimant les espaces superflus
    const prompt = userText.slice(6).trim();

    // Vérifier si le prompt est vide
    if (!prompt) {
        await sendMessage(senderId, '⚠️ Veuillez fournir une question ou un problème à résoudre.\n\nExemple: `online résoudre l\'équation y = 2x + 3`');
        return;
    }

    try {
        // Créer un ID de session unique basé sur l'ID de l'utilisateur et l'heure
        const sessionId = `${senderId}-${Date.now()}`;
        
        // Envoyer un message d'attente avec animation
        await sendMessage(senderId, "🔍 Recherche en cours...\n⏳ Veuillez patienter quelques instants...");

        // Appeler l'API avec le prompt fourni
        const apiUrl = `${BASE_API_URL}?prompt=${encodeURIComponent(prompt)}&session=${sessionId}`;
        const response = await axios.get(apiUrl);

        // Récupérer la réponse de l'API
        const reply = response.data.reply;
        
        // Formater la réponse avec une décoration élégante
        const formattedReply = formatReply(reply, prompt);

        // Envoyer la réponse formatée à l'utilisateur
        await sendMessage(senderId, formattedReply);
    } catch (error) {
        console.error('Erreur lors de l\'appel à l\'API:', error);

        // Envoyer un message d'erreur décoré à l'utilisateur
        await sendMessage(senderId, `❌ *ERREUR DE CONNEXION* ❌\n\n⚠️ Désolé, je n'ai pas pu traiter votre demande en raison d'un problème technique.\n\n🔄 Veuillez réessayer dans quelques instants ou contacter l'administrateur si le problème persiste.`);
    }
};

/**
 * Formate la réponse avec une décoration élégante
 * @param {string} reply - La réponse brute de l'API
 * @param {string} prompt - La question de l'utilisateur
 * @returns {string} - La réponse formatée
 */
function formatReply(reply, prompt) {
    // Créer une bordure décorative
    const separator = "╔" + "═".repeat(50) + "╗";
    const bottomSeparator = "╚" + "═".repeat(50) + "╝";
    const middleSeparator = "╠" + "═".repeat(50) + "╣";
    
    // Formater la question
    const formattedQuestion = `╠══ 🔍 *QUESTION* :\n╠   ${prompt}\n`;
    
    // Remplacer les balises de formatage mathématique pour un meilleur affichage
    let formattedReply = reply.replace(/\\\\\\(/g, "*").replace(/\\\\\\)/g, "*");
    
    // Diviser la réponse en sections pour un meilleur formatage
    const sections = formattedReply.split('---');
    let finalReply = "";
    
    if (sections.length > 1) {
        // Si la réponse contient des sections (séparées par ---)
        finalReply = `${separator}\n${formattedQuestion}${middleSeparator}\n╠══ 📝 *RÉPONSE* :\n`;
        
        sections.forEach((section, index) => {
            // Nettoyer et formater chaque section
            const cleanedSection = section.trim()
                .replace(/###/g, "✨") // Remplacer les ### par des étoiles
                .split('\n')
                .map(line => `╠   ${line}`)
                .join('\n');
                
            finalReply += cleanedSection;
            
            // Ajouter un séparateur entre les sections sauf pour la dernière
            if (index < sections.length - 1) {
                finalReply += `\n╠   ${'-'.repeat(30)}\n`;
            }
        });
    } else {
        // Si la réponse ne contient pas de sections
        finalReply = `${separator}\n${formattedQuestion}${middleSeparator}\n╠══ 📝 *RÉPONSE* :\n`;
        
        // Formatter la réponse ligne par ligne
        const lines = formattedReply.split('\n');
        lines.forEach(line => {
            finalReply += `╠   ${line}\n`;
        });
    }
    
    // Ajouter une signature et la date
    const date = new Date().toLocaleString('fr-FR', { 
        timeZone: 'Europe/Paris',
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    finalReply += `${middleSeparator}\n╠══ 🤖 Généré par R1 Online | ${date}\n${bottomSeparator}`;
    
    return finalReply;
}

// Ajouter les informations de la commande
module.exports.info = {
    name: "online",
    description: "Résout des problèmes mathématiques, équations et autres questions scientifiques via l'API Zaikyoo R1.",
    usage: "Envoyez 'online <votre problème>' pour obtenir une solution détaillée et formatée."
};
