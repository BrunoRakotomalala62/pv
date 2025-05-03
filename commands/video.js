
const axios = require('axios');
const fs = require('fs-extra');
const ytdl = require('@distube/ytdl-core');
const YouTube = require('simple-youtube-api');
const sendMessage = require('../handles/sendMessage');

// Configuration de la commande
module.exports.config = {
  name: "video",
  version: "1.0.0",
  hasPermssion: 0,
  credits: "CatalizCS mod video by Đăng",
  description: "Play video from YouTube",
  usePrefix: true,
  commandCategory: "music",
  usages: "video [Text]",
  cooldowns: 10,
  dependencies: {
    "@distube/ytdl-core": "",
    "simple-youtube-api": "",
    "fs-extra": "",
    "axios": ""
  },
  envConfig: {
    "YOUTUBE_API": "AIzaSyDEE1-zZSRVI8lTaQOVsIAQFgL-_BJKvhk"
  }
};

// Initialiser YouTube API
const youtube = new YouTube("AIzaSyDEE1-zZSRVI8lTaQOVsIAQFgL-_BJKvhk");
const handleReplies = {}; // Pour stocker les réponses en attente

// Gestionnaire de réponses
module.exports.handleReply = async function(senderId, event) {
  try {
    const choice = parseInt(event.body);
    if (isNaN(choice) || !handleReplies[senderId] || choice <= 0 || choice > handleReplies[senderId].link.length) {
      await sendMessage(senderId, "Choix invalide. Veuillez réessayer.");
      return;
    }

    const selectedLink = handleReplies[senderId].link[choice - 1];
    
    // Obtenir les informations de la vidéo
    const videoInfo = await ytdl.getInfo(selectedLink);
    const videoTitle = videoInfo.videoDetails.title;
    
    // Informer l'utilisateur que le téléchargement a commencé
    await sendMessage(senderId, `Téléchargement de la vidéo en cours!\n❍━━━━━━━━━━━━❍\n${videoTitle}\n❍━━━━━━━━━━━━❍\nCela peut prendre un moment!`);
    
    // Créer le dossier cache s'il n'existe pas
    if (!fs.existsSync('./cache')) {
      fs.mkdirSync('./cache');
    }
    
    const videoPath = `./cache/${selectedLink}.mp4`;
    
    // Télécharger la vidéo
    await new Promise((resolve, reject) => {
      ytdl(selectedLink)
        .pipe(fs.createWriteStream(videoPath))
        .on("close", resolve)
        .on("error", reject);
    });
    
    // Vérifier la taille du fichier
    const stats = fs.statSync(videoPath);
    if (stats.size > 26214400) { // 25MB
      fs.unlinkSync(videoPath);
      await sendMessage(senderId, "Le fichier ne peut pas être envoyé car il dépasse 25MB.");
      return;
    }
    
    // Envoyer la vidéo
    await sendMessage(senderId, {
      body: videoTitle,
      attachment: fs.createReadStream(videoPath)
    });
    
    // Supprimer le fichier après envoi
    fs.unlinkSync(videoPath);
    
    // Supprimer la référence de handleReplies
    delete handleReplies[senderId];
  } catch (error) {
    console.error("Erreur dans handleReply:", error);
    await sendMessage(senderId, `Une erreur s'est produite lors du traitement de votre demande: ${error.message}`);
  }
};

// Fonction principale
module.exports = async (senderId, prompt) => {
  try {
    // Vérifier si la réponse est dans le contexte d'un handleReply
    if (handleReplies[senderId]) {
      return module.exports.handleReply(senderId, { body: prompt, senderID: senderId });
    }
    
    if (!prompt || prompt.trim() === "") {
      await sendMessage(senderId, "La recherche ne peut pas être vide!");
      return;
    }
    
    const keywordSearch = prompt.trim();
    const videoPattern = /^(http(s)?:\/\/)?((w){3}.)?youtu(be|.be)?(\.com)?\/.+/gm;
    const urlValid = videoPattern.test(keywordSearch);
    
    // Si l'utilisateur a fourni une URL YouTube directe
    if (urlValid) {
      try {
        let id = keywordSearch.split(/(vi\/|v=|\/v\/|youtu\.be\/|\/embed\/)/);
        id = (id[2] !== undefined) ? id[2].split(/[^0-9a-z_\-]/i)[0] : id[0];
        
        // Créer le dossier cache s'il n'existe pas
        if (!fs.existsSync('./cache')) {
          fs.mkdirSync('./cache');
        }
        
        const videoPath = `./cache/${id}.mp4`;
        
        // Télécharger la vidéo
        await new Promise((resolve, reject) => {
          ytdl(keywordSearch)
            .pipe(fs.createWriteStream(videoPath))
            .on("close", resolve)
            .on("error", reject);
        });
        
        // Vérifier la taille du fichier
        const stats = fs.statSync(videoPath);
        if (stats.size > 26214400) { // 25MB
          fs.unlinkSync(videoPath);
          await sendMessage(senderId, "Le fichier ne peut pas être envoyé car il dépasse 25MB.");
          return;
        }
        
        // Envoyer la vidéo
        await sendMessage(senderId, {
          attachment: fs.createReadStream(videoPath)
        });
        
        // Supprimer le fichier après envoi
        fs.unlinkSync(videoPath);
      } catch (error) {
        console.error("Erreur lors du traitement de l'URL:", error);
        await sendMessage(senderId, "Impossible de traiter votre demande!");
      }
    } 
    // Si l'utilisateur a fourni un mot-clé de recherche
    else {
      try {
        const link = [];
        let msg = "";
        let num = 0;
        let numb = 0;
        const imgthumnail = [];
        
        // Rechercher les vidéos correspondantes
        const results = await youtube.searchVideos(keywordSearch, 6);
        
        // Créer le dossier cache s'il n'existe pas
        if (!fs.existsSync('./cache')) {
          fs.mkdirSync('./cache');
        }
        
        // Traiter chaque résultat
        for (const value of results) {
          if (typeof value.id === 'undefined') continue;
          
          link.push(value.id);
          
          // Obtenir la durée de la vidéo
          const datab = (await axios.get(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${value.id}&key=AIzaSyDEE1-zZSRVI8lTaQOVsIAQFgL-_BJKvhk`)).data;
          const gettime = datab.items[0].contentDetails.duration;
          const time = gettime.slice(2);
          
          // Obtenir les informations sur la chaîne
          const datac = (await axios.get(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${value.id}&key=AIzaSyDEE1-zZSRVI8lTaQOVsIAQFgL-_BJKvhk`)).data;
          const channel = datac.items[0].snippet.channelTitle;
          
          // Télécharger la miniature
          numb += 1;
          const folderthumnail = `./cache/${numb}.png`;
          const linkthumnail = `https://img.youtube.com/vi/${value.id}/maxresdefault.jpg`;
          
          const getthumnail = (await axios.get(linkthumnail, { responseType: 'arraybuffer' })).data;
          fs.writeFileSync(folderthumnail, Buffer.from(getthumnail, 'utf-8'));
          
          imgthumnail.push(fs.createReadStream(`./cache/${numb}.png`));
          
          // Ajouter les informations à afficher
          num += 1;
          msg += `${num}. ${value.title}\nDurée: ${time}\nChaîne: ${channel}\n❍━━━━━━━━━━━━❍\n`;
        }
        
        // Envoyer les résultats de la recherche
        const body = `Il y a ${link.length} résultats correspondant à votre recherche:\n\n${msg}\nVeuillez répondre avec le numéro de la vidéo que vous souhaitez regarder`;
        
        await sendMessage(senderId, {
          attachment: imgthumnail,
          body: body
        });
        
        // Stocker les informations pour handleReply
        handleReplies[senderId] = {
          link: link
        };
        
        // Supprimer les miniatures après utilisation
        for (let i = 1; i <= numb; i++) {
          fs.unlinkSync(`./cache/${i}.png`);
        }
      } catch (error) {
        console.error("Erreur lors de la recherche:", error);
        await sendMessage(senderId, `Une erreur s'est produite lors de la recherche: ${error.message}`);
      }
    }
  } catch (error) {
    console.error("Erreur globale:", error);
    await sendMessage(senderId, `Une erreur s'est produite: ${error.message}`);
  }
};

// Ajouter les informations de la commande
module.exports.info = {
    name: "video",
    description: "Recherche et télécharge des vidéos YouTube.",
    usage: "Envoyez 'video <titre ou URL>' pour rechercher ou télécharger une vidéo."
};
