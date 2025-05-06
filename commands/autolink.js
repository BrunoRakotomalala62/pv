
const axios = require('axios');
const fs = require('fs-extra');
const cheerio = require('cheerio');
const qs = require('qs');
const sendMessage = require('../handles/sendMessage');
const path = require('path');

// Assurez-vous que le dossier cache existe
if (!fs.existsSync(path.join(__dirname, '../temp'))) {
    fs.mkdirSync(path.join(__dirname, '../temp'), { recursive: true });
}

// JSON pour stocker les états d'autolink par thread
const AUTOLINK_STATES_FILE = path.join(__dirname, '../autolink.json');

function loadAutoLinkStates() {
    try {
        if (fs.existsSync(AUTOLINK_STATES_FILE)) {
            const data = fs.readFileSync(AUTOLINK_STATES_FILE, "utf8");
            return JSON.parse(data);
        }
        return {};
    } catch (err) {
        console.error('Erreur lors du chargement des états autolink:', err);
        return {};
    }
}

function saveAutoLinkStates(states) {
    try {
        fs.writeFileSync(AUTOLINK_STATES_FILE, JSON.stringify(states, null, 2));
    } catch (err) {
        console.error('Erreur lors de la sauvegarde des états autolink:', err);
    }
}

// Utilitaire pour raccourcir les URL
async function shortenURL(url) {
    try {
        const response = await axios.get(`https://is.gd/create.php?format=simple&url=${encodeURIComponent(url)}`);
        return response.data;
    } catch (error) {
        console.error('Erreur lors du raccourcissement de l\'URL:', error);
        return url;
    }
}

let autoLinkStates = loadAutoLinkStates();
let threadStates = {};

module.exports = async (senderId, userText) => {
    const message = userText.toLowerCase();
    
    // Gestion des commandes autolink on/off
    if (message.includes('autolink off')) {
        autoLinkStates[senderId] = 'off';
        saveAutoLinkStates(autoLinkStates);
        await sendMessage(senderId, "✅ AutoLink est maintenant désactivé pour cette conversation.");
        return;
    } else if (message.includes('autolink on')) {
        autoLinkStates[senderId] = 'on';
        saveAutoLinkStates(autoLinkStates);
        await sendMessage(senderId, "✅ AutoLink est maintenant activé pour cette conversation.");
        return;
    } else if (message === 'autolink') {
        const status = autoLinkStates[senderId] === 'off' ? 'désactivé' : 'activé';
        await sendMessage(senderId, `📱 État actuel d'AutoLink: ${status}\n\nUtilisation:\n- autolink on → Activer\n- autolink off → Désactiver`);
        return;
    }
    
    // Vérification si un lien est présent dans le message
    const linkInfo = checkLink(userText);
    if (linkInfo) {
        // Vérifier si autolink est activé pour ce thread
        if (autoLinkStates[senderId] !== 'off') {
            await sendMessage(senderId, "🔍 Analyse du lien en cours...");
            await downLoad(linkInfo.url, senderId);
        }
    }
};

// Fonction pour télécharger le contenu en fonction de l'URL
async function downLoad(url, senderId) {
    const time = Date.now();
    const path = `${__dirname}/../temp/${time}.mp4`;

    try {
        if (url.includes("instagram")) {
            await downloadInstagram(url, senderId, path);
        } else if (url.includes("facebook") || url.includes("fb.watch")) {
            await downloadFacebook(url, senderId, path);
        } else if (url.includes("tiktok")) {
            await downloadTikTok(url, senderId, path);
        } else if (url.includes("x.com") || url.includes("twitter.com")) {
            await downloadTwitter(url, senderId, path);
        } else if (url.includes("pin.it") || url.includes("pinterest")) {
            await downloadPinterest(url, senderId, path);
        } else if (url.includes("youtu")) {
            await downloadYouTube(url, senderId, path);
        } else {
            await sendMessage(senderId, "❌ Lien non pris en charge. AutoLink supporte Instagram, Facebook, TikTok, Twitter, Pinterest et YouTube.");
        }
    } catch (error) {
        console.error('Erreur lors du téléchargement:', error);
        await sendMessage(senderId, "❌ Erreur lors du téléchargement de la vidéo. Veuillez réessayer plus tard.");
    }
}

// Téléchargement Instagram
async function downloadInstagram(url, senderId, filePath) {
    try {
        const response = await axios.get(`https://insta-kshitiz.vercel.app/insta?url=${encodeURIComponent(url)}`);
        if (response.data && response.data.url) {
            const videoUrl = response.data.url;
            const downloadResponse = await axios({
                method: "GET",
                url: videoUrl,
                responseType: "arraybuffer"
            });
            
            fs.writeFileSync(filePath, Buffer.from(downloadResponse.data));
            
            // Vérifier la taille du fichier
            if (fs.statSync(filePath).size / 1024 / 1024 > 25) {
                fs.unlinkSync(filePath);
                return await sendMessage(senderId, "❌ Le fichier est trop volumineux pour être envoyé.");
            }
            
            const shortUrl = await shortenURL(videoUrl);
            await sendMessage(senderId, {
                attachment: {
                    type: 'video',
                    payload: {
                        url: `file://${filePath}`,
                        is_reusable: true
                    }
                }
            });
            await sendMessage(senderId, `✅ Téléchargement réussi!\n🔗 Lien de téléchargement: ${shortUrl}`);
            
            // Supprimer le fichier après envoi
            fs.unlinkSync(filePath);
        } else {
            await sendMessage(senderId, "❌ Impossible de récupérer la vidéo Instagram.");
        }
    } catch (error) {
        console.error('Erreur Instagram:', error);
        await sendMessage(senderId, "❌ Erreur lors du téléchargement de la vidéo Instagram.");
    }
}

// Téléchargement Facebook
async function downloadFacebook(url, senderId, filePath) {
    try {
        const res = await fbDownloader(url);
        if (res.success && res.download && res.download.length > 0) {
            const videoUrl = res.download[0].url;
            
            const writeStream = fs.createWriteStream(filePath);
            const response = await axios({
                method: "GET",
                url: videoUrl,
                responseType: "stream"
            });
            
            response.data.pipe(writeStream);
            
            writeStream.on('finish', async () => {
                if (fs.statSync(filePath).size / 1024 / 1024 > 25) {
                    fs.unlinkSync(filePath);
                    return await sendMessage(senderId, "❌ Le fichier est trop volumineux pour être envoyé.");
                }
                
                const shortUrl = await shortenURL(videoUrl);
                await sendMessage(senderId, {
                    attachment: {
                        type: 'video',
                        payload: {
                            url: `file://${filePath}`,
                            is_reusable: true
                        }
                    }
                });
                await sendMessage(senderId, `✅ Téléchargement réussi!\n🔗 Lien de téléchargement: ${shortUrl}`);
                
                // Supprimer le fichier après envoi
                fs.unlinkSync(filePath);
            });
            
            writeStream.on('error', async (err) => {
                console.error('Erreur d\'écriture:', err);
                await sendMessage(senderId, "❌ Erreur lors de l'enregistrement de la vidéo Facebook.");
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            });
        } else {
            await sendMessage(senderId, "❌ Impossible de récupérer la vidéo Facebook.");
        }
    } catch (error) {
        console.error('Erreur Facebook:', error);
        await sendMessage(senderId, "❌ Erreur lors du téléchargement de la vidéo Facebook.");
    }
}

// Téléchargement TikTok
async function downloadTikTok(url, senderId, filePath) {
    try {
        const response = await axios.get(`https://tikdl-video.vercel.app/tiktok?url=${encodeURIComponent(url)}`);
        if (response.data && response.data.videoUrl) {
            const videoUrl = response.data.videoUrl;
            
            const writeStream = fs.createWriteStream(filePath);
            const downloadResponse = await axios({
                method: "GET",
                url: videoUrl,
                responseType: "stream"
            });
            
            downloadResponse.data.pipe(writeStream);
            
            writeStream.on('finish', async () => {
                if (fs.statSync(filePath).size / 1024 / 1024 > 25) {
                    fs.unlinkSync(filePath);
                    return await sendMessage(senderId, "❌ Le fichier est trop volumineux pour être envoyé.");
                }
                
                const shortUrl = await shortenURL(videoUrl);
                await sendMessage(senderId, {
                    attachment: {
                        type: 'video',
                        payload: {
                            url: `file://${filePath}`,
                            is_reusable: true
                        }
                    }
                });
                await sendMessage(senderId, `✅ Téléchargement réussi!\n🔗 Lien de téléchargement: ${shortUrl}`);
                
                // Supprimer le fichier après envoi
                fs.unlinkSync(filePath);
            });
            
            writeStream.on('error', async (err) => {
                console.error('Erreur d\'écriture TikTok:', err);
                await sendMessage(senderId, "❌ Erreur lors de l'enregistrement de la vidéo TikTok.");
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            });
        } else {
            await sendMessage(senderId, "❌ Impossible de récupérer la vidéo TikTok.");
        }
    } catch (error) {
        console.error('Erreur TikTok:', error);
        await sendMessage(senderId, "❌ Erreur lors du téléchargement de la vidéo TikTok.");
    }
}

// Téléchargement Twitter
async function downloadTwitter(url, senderId, filePath) {
    try {
        const response = await axios.get(`https://xdl-twitter.vercel.app/kshitiz?url=${encodeURIComponent(url)}`);
        if (response.data && response.data.videoUrl) {
            const videoUrl = response.data.videoUrl;
            
            const writeStream = fs.createWriteStream(filePath);
            const downloadResponse = await axios({
                method: "GET",
                url: videoUrl,
                responseType: "stream"
            });
            
            downloadResponse.data.pipe(writeStream);
            
            writeStream.on('finish', async () => {
                if (fs.statSync(filePath).size / 1024 / 1024 > 25) {
                    fs.unlinkSync(filePath);
                    return await sendMessage(senderId, "❌ Le fichier est trop volumineux pour être envoyé.");
                }
                
                const shortUrl = await shortenURL(videoUrl);
                await sendMessage(senderId, {
                    attachment: {
                        type: 'video',
                        payload: {
                            url: `file://${filePath}`,
                            is_reusable: true
                        }
                    }
                });
                await sendMessage(senderId, `✅ Téléchargement réussi!\n🔗 Lien de téléchargement: ${shortUrl}`);
                
                // Supprimer le fichier après envoi
                fs.unlinkSync(filePath);
            });
            
            writeStream.on('error', async (err) => {
                console.error('Erreur d\'écriture Twitter:', err);
                await sendMessage(senderId, "❌ Erreur lors de l'enregistrement de la vidéo Twitter.");
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            });
        } else {
            await sendMessage(senderId, "❌ Impossible de récupérer la vidéo Twitter.");
        }
    } catch (error) {
        console.error('Erreur Twitter:', error);
        await sendMessage(senderId, "❌ Erreur lors du téléchargement de la vidéo Twitter.");
    }
}

// Téléchargement Pinterest
async function downloadPinterest(url, senderId, filePath) {
    try {
        const response = await axios.get(`https://pindl-pinterest.vercel.app/kshitiz?url=${encodeURIComponent(url)}`);
        if (response.data && response.data.url) {
            const videoUrl = response.data.url;
            
            const writeStream = fs.createWriteStream(filePath);
            const downloadResponse = await axios({
                method: "GET",
                url: videoUrl,
                responseType: "stream"
            });
            
            downloadResponse.data.pipe(writeStream);
            
            writeStream.on('finish', async () => {
                if (fs.statSync(filePath).size / 1024 / 1024 > 25) {
                    fs.unlinkSync(filePath);
                    return await sendMessage(senderId, "❌ Le fichier est trop volumineux pour être envoyé.");
                }
                
                const shortUrl = await shortenURL(videoUrl);
                await sendMessage(senderId, {
                    attachment: {
                        type: 'video',
                        payload: {
                            url: `file://${filePath}`,
                            is_reusable: true
                        }
                    }
                });
                await sendMessage(senderId, `✅ Téléchargement réussi!\n🔗 Lien de téléchargement: ${shortUrl}`);
                
                // Supprimer le fichier après envoi
                fs.unlinkSync(filePath);
            });
            
            writeStream.on('error', async (err) => {
                console.error('Erreur d\'écriture Pinterest:', err);
                await sendMessage(senderId, "❌ Erreur lors de l'enregistrement de la vidéo Pinterest.");
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            });
        } else {
            await sendMessage(senderId, "❌ Impossible de récupérer la vidéo Pinterest.");
        }
    } catch (error) {
        console.error('Erreur Pinterest:', error);
        await sendMessage(senderId, "❌ Erreur lors du téléchargement de la vidéo Pinterest.");
    }
}

// Téléchargement YouTube
async function downloadYouTube(url, senderId, filePath) {
    try {
        const response = await axios.get(`https://yt-downloader-eta.vercel.app/kshitiz?url=${encodeURIComponent(url)}`);
        if (response.data && response.data.url) {
            const videoUrl = response.data.url;
            
            const writeStream = fs.createWriteStream(filePath);
            const downloadResponse = await axios({
                method: "GET",
                url: videoUrl,
                responseType: "stream"
            });
            
            downloadResponse.data.pipe(writeStream);
            
            writeStream.on('finish', async () => {
                if (fs.statSync(filePath).size / 1024 / 1024 > 25) {
                    fs.unlinkSync(filePath);
                    return await sendMessage(senderId, "❌ Le fichier est trop volumineux pour être envoyé.");
                }
                
                const shortUrl = await shortenURL(videoUrl);
                await sendMessage(senderId, {
                    attachment: {
                        type: 'video',
                        payload: {
                            url: `file://${filePath}`,
                            is_reusable: true
                        }
                    }
                });
                await sendMessage(senderId, `✅ Téléchargement réussi!\n🔗 Lien de téléchargement: ${shortUrl}`);
                
                // Supprimer le fichier après envoi
                fs.unlinkSync(filePath);
            });
            
            writeStream.on('error', async (err) => {
                console.error('Erreur d\'écriture YouTube:', err);
                await sendMessage(senderId, "❌ Erreur lors de l'enregistrement de la vidéo YouTube.");
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            });
        } else {
            await sendMessage(senderId, "❌ Impossible de récupérer la vidéo YouTube.");
        }
    } catch (error) {
        console.error('Erreur YouTube:', error);
        await sendMessage(senderId, "❌ Erreur lors du téléchargement de la vidéo YouTube.");
    }
}

// Fonction pour vérifier si un message contient un lien supporté
function checkLink(text) {
    const urls = extractUrls(text);
    
    for (const url of urls) {
        if (
            url.includes("instagram") ||
            url.includes("facebook") ||
            url.includes("fb.watch") ||
            url.includes("tiktok") ||
            url.includes("x.com") ||
            url.includes("twitter.com") ||
            url.includes("pin.it") ||
            url.includes("pinterest") ||
            url.includes("youtu")
        ) {
            return { url };
        }
    }
    
    return null;
}

// Fonction pour extraire les URLs d'un texte
function extractUrls(text) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.match(urlRegex) || [];
}

// Fonction pour télécharger des vidéos Facebook
async function fbDownloader(url) {
    try {
        const response = await axios({
            method: 'POST',
            url: 'https://snapsave.app/action.php?lang=vn',
            headers: {
                "accept": "*/*",
                "accept-language": "vi,en-US;q=0.9,en;q=0.8",
                "content-type": "multipart/form-data",
                "sec-fetch-dest": "empty",
                "sec-fetch-mode": "cors",
                "sec-fetch-site": "same-origin",
                "Referer": "https://snapsave.app/vn",
                "Referrer-Policy": "strict-origin-when-cross-origin",
                "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.0.0 Safari/537.36"
            },
            data: {
                url
            }
        });

        let html;
        const evalCode = response.data.replace('return decodeURIComponent', 'html = decodeURIComponent');
        eval(evalCode);
        html = html.split('innerHTML = "')[1].split('";\n')[0].replace(/\\"/g, '"');

        const $ = cheerio.load(html);
        const download = [];

        const tbody = $('table').find('tbody');
        const trs = tbody.find('tr');

        trs.each(function (i, elem) {
            const trElement = $(elem);
            const tds = trElement.children();
            const quality = $(tds[0]).text().trim();
            const url = $(tds[2]).children('a').attr('href');
            if (url != undefined) {
                download.push({
                    quality,
                    url
                });
            }
        });

        return {
            success: true,
            video_length: $("div.clearfix > p").text().trim(),
            download
        };
    } catch (err) {
        console.error('Erreur dans Facebook Downloader:', err);
        return {
            success: false
        };
    }
}

// Informations de la commande pour l'aide
module.exports.info = {
    name: "autolink",
    description: "Télécharge automatiquement des vidéos à partir de liens Instagram, Facebook, TikTok, Twitter, Pinterest et YouTube.",
    usage: "autolink [on/off] - Active ou désactive le téléchargement automatique des vidéos"
};
