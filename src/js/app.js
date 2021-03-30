import './css_imports.js';

/** 
 * Templates des "composants HTML qu'on va générer Carte + Tableau des highscores"
 * Nous aurions pu utiliser des <template> mais histoire de rester sur des fonctions de base
 * on utilise directement des templates stockés sous forme de chaine de caractères.
*/
const cardTemplate = `
<div id='card-%%ID%%' class='game-card game-card-%%CARD_NUMBER%%'>
  <div class='game-card-inner'>
    <div class='game-card-front'>
    </div>
    <div class='game-card-back game-card-back-%%CARD_NUMBER%%'>
    </div>
  </div>
</div>
`;

const gameHistoryTemplate = `
<tr>
  <td>%%PLAYER%%</td>
  <td style="text-align: right;">%%TIME%%</td>
</tr>
`;

/**
 * Définition de toutes les constantes pour avoir de l'autocomplétion dans l'application
 * Que ça soit au niveau des URLs d'API ou des différents classes ou selecteurs du DOM
 */
const apiUrl =  __API__ + "/games" ||'http://localhost:1337/games';
const cardHolderSelector = '.game-holder';
const cardBaseClass = 'game-card-';
const cardFlippedClass = 'card-flipped';
const cardPermaFlippedClass = 'card-perma-flipped';
const cardIdBaseSelector = '#card-';
const gameCountdownSelector = '.game-countdown';
const gameMenuSelector = '.game-menu';
const startBtnSelector = '#start-btn';
const gameProgressBarSelector = '.game-progress-bar';
const playerNameSelector = "#player-name";
const winGameSelector = '#win-msg';
const winTimeSelector = '#game-time';
const loseGameSelector = '#lose-msg';
const gameScoresSelector = "#game-scores";
const defaultTime = 60000 * 3;  // Le temps par défaut d'une partie

let numberOfCards = -1; // Le nombre de cartes en jeu, utilisé pour déterminer si l'on a gagné
let selectedCards = []; // Un array utilisé comme "paire de cartes" pour verifier si deux cartes sont identiques
let inGame = false; // Est-ce que le jeu est en cours
let canPlay = true; // Est-ce qu'on autorise le joueur à jouer ?
let playerName = 'Unnamed'; // Le nom du joueur
let timer = defaultTime; // On initalise le timer à la valeur maximale
let gameInterval = undefined;   // La boucle de jeu qui va servir pour "chronométrer" la partie

// La fonction getGames utilise la méthode fetch pour récupéré depuis le backend.
const getGames = () => {
  fetch(`${apiUrl}/`).then(res => res.json()).then(data => {
    const games = [];

    // On remplace dans le template les valeurs qui nous interesse et on stock
    // les éléments préparés dans le tableau games
    data.data.forEach(game => {
      const timeObj = getTime(parseInt(game.time));
      games.push(gameHistoryTemplate.replace('%%PLAYER%%', game.username).replace('%%TIME%%', padTime(`${timeObj.m}:${timeObj.s}`)));
    });

    // On remet à zéro les scores puis on ajoute chaque template généré
    document.querySelector(gameScoresSelector).innerHTML = "";
    games.forEach(game => document.querySelector(gameScoresSelector).innerHTML += game);
  });
}

/**
 * La fonction saveGame permet d'enregistrer les scores dans le backend
 */
const saveGame = () => {
  // On prépare la requète avec les headers pour indiquer au front que ce qu'on va envoyer c'est du JSON
  // Puis on précise que la méthode sera en POST et on transforme notre payload json en string
  const options = {
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    method: 'POST',
    body: JSON.stringify({
      username: playerName,
      time: timer,
    })
  }
  // On execute la requete puis on recharge 
  // Faut de temps on ne gère pas les erreurs
  fetch(`${apiUrl}/save`, options).then(res => res.json()).then(data => {
    getGames();
  });
}

// Fonction qui mélange l'array pour que les cartes soient aléatoires
const shuffle = (array) => {
  /* Math.Random nous donne un nombre entre 0 et 1, en faisant -0.5 on va alterner entre -0.5 et 0.5, soit entre vrai et faux aléatoirement */
  array.sort(() => Math.random() - 0.5);
}


// Basé sur https://stackoverflow.com/questions/57284178/add-0-before-single-digit-number-of-time-format
const padTime = (value) => {
  const paddedTime = value.split(':').map(e => `0${e}`.slice(-2)).join(':');
  return paddedTime;
}

// La fonction getTime permet à partir des millisecondes du timer de récupérer un objet javascript et minutes et seconds (plus facile pour l'affichage)
const getTime = (timeLeft) => {
  let time = {};
  const h = Math.floor(timeLeft / 1000 / 60 / 60);
  time.m = Math.floor((timeLeft / 1000 / 60 / 60 - h) * 60);
  time.s = Math.floor(((timeLeft / 1000 / 60 / 60 - h) * 60 - time.m) * 60);

  return time;
}

// La fonction qui est appelé quand on gagne le jeu
const winGame = () => {
  // On mets à jour le temps pour l'afficher à l'utilisauter
  document.querySelector(winTimeSelector).innerHTML = padTime(`${getTime(timer).m}:${getTime(timer).s}`);
  // Puis on démasque le menu et le message comme quoi le joueur a gagné
  document.querySelector(winGameSelector).classList.remove('hidden');
  document.querySelector(gameMenuSelector).classList.remove('hidden');

  // On enregistre le score en base
  saveGame();
  inGame = false;
}

// La fonction qui est appelé quand on perd le jeu
const loseGame = () => {
  // Puis on démasque le menu et le message comme quoi le joueur a perdu
  document.querySelector(loseGameSelector).classList.remove('hidden');
  document.querySelector(gameMenuSelector).classList.remove('hidden');
  inGame = false;
}

// La fonction qui permet de vérifier à tout moment si la partie est gagné
// On compare le nombre de cartes totales stocké dans numberOfCards avec le nombre de cartes ayant la classe cardPermaFlippedClass
const checkForWin = () => {
  if (document.querySelectorAll(`.${cardPermaFlippedClass}`).length == numberOfCards) {
    // On stop le chrono et on appelle winGame() pour afficher à l'utilisateur qu'il a gagné
    clearInterval(gameInterval);
    winGame();
  }
}

// La fonction checkCard est une fonction essentielle du jeu car elle permet de verifier
// si :
//      - C'est la première carte que l'on sélectionne
//      - C'est la deuxième carte que l'on sélectionne et elle est identique à la précédente
//      - C'est la deuxième carte que l'on sélectionne et elle est différente de la précédente

const checkCard = (id) => {

  // On bloque la possibilité du joueur de cliquer le temps des verifications
  canPlay = false;

  // On vérifie que la carte cliquée n'est pas déjà retournée en vérifiant qu'elle ne contient pas la classe cardFlippedClass ou cardPermaFlippedClass
  let canContinue = true;
  const card = document.querySelector(`${cardIdBaseSelector}${id}`);
  canContinue = !card.classList.contains(cardFlippedClass) && !card.classList.contains(cardPermaFlippedClass);

  // Si la carte n'est pas déjà retournée, on continue.
  if (canContinue) {
    // On initialise une variable cardNumber avec une valeur impossible pour éviter des faux positifs.
    let cardNumber = NaN;

    // Si on n'a pas sélectionné 2 cartes alors on identifie la carte puis on la retourne à l'aide de la classe cardFlippedClass
    if (selectedCards.length < 2) {
      const card = document.querySelector(`${cardIdBaseSelector}${id}`);

      card.classList.add(cardFlippedClass);

      // Puis on identifie le numéro de la carte en l'extrayant de la classe game-card-X et on 
      // l'ajoute à la liste des cartes sélectionnées
      for (let classItem of card.classList) {
        if (classItem.startsWith(cardBaseClass)) {
          selectedCards.push(classItem.split('-')[2]);
        }
      }
    }

    // Si l'on a sélectionné 2 cartes (ou plus pour éviter les bugs ou du click spamming)
    // Alors on initialise un setTimeout de 1000, qui permet d'afficher les cartes à l'écran pour les afficher à l'utilisateur et ne pas
    // les retourner directement
    if (selectedCards.length >= 2) {
      setTimeout(() => {

        // On récupère toutes les cartes retournées
        const flippedCards = document.querySelectorAll(`.${cardFlippedClass}`);

        // Si les deux cartes retournées et stockées dans notre tableau selectedCard (pour rappel on a extrait leur numéro à l'étape d'avant)
        // sont les mêmes alors on leur donne la classe cardPermaFlippedClass qui les maintiendra retourné même quand la classe cardFlippedClass sera retiré
        if (selectedCards[0] === selectedCards[1]) {
          flippedCards.forEach(c => c.classList.add(cardPermaFlippedClass));
        }

        // Puis on remet tout à zéro en retirant tous les classes cardFlippedClass ainsi que les cartes selectionnées et on autorise le joueur à jouer de nouveau
        flippedCards.forEach(c => c.classList.remove(cardFlippedClass));
        selectedCards = [];
        canPlay = true
      }, 1000);
    } else
      canPlay = true; // Dans le cas ou il n'y avait pas deux cartes, le joueur peut continuer à jouer
  } else {
    canPlay = true; // Si le joueur a cliqué sur la même carte (i.e. déjà retournée)
  }

}

// Cette fonction permet de généré toutes les cartes en fonction du template en leur ajoutant une classe avec la valeur de la carte
const generateCards = () => {
  // On remet à zéro le innerHTML à chaque fois qu'on génère 
  document.querySelector(cardHolderSelector).innerHTML = '';
  const cards = [];


  for (let i = 1; i <= 18; i++) {
    // On les génère en double pour bien avoir 2x chaque carte :)
    cards.push(cardTemplate.replaceAll('%%CARD_NUMBER%%', i));
    cards.push(cardTemplate.replaceAll('%%CARD_NUMBER%%', i));
  }

  // Puis on mélange le tout pour avoir une grille différente à chaque fois
  shuffle(cards);

  // On stock le nombre de cartes
  numberOfCards = cards.length;

  // Puis pour chaque carte crée, on ajoute un id unique pour pouvoir les identifiés après
  for (let i = 0; i < cards.length; i++) {
    document.querySelector(cardHolderSelector).innerHTML += cards[i].replaceAll('%%ID%%', i);

    // Ici on doit utiliser un setTimeout pour permettre au DOM de se régénérer afin de binder l'event onclick
    // Si on n'attend pas, le binding de l'event est perdu car le DOM était déjà entrain de se "réécrire"
    setTimeout(() => {
      document.querySelector(`${cardIdBaseSelector}${i}`).onclick = (e) => {
        // On ne permet à l'utiliser de joueur seulement si on est dans une partie ou si le jeu lui autorise à jouer
        if (canPlay && inGame)
          checkCard(i);
      };
    }, 1)

  }
}

const startGame = () => {
  // Démarrage du jeu, on remet tout à zéro par précaution (on ne sait pas si c'est la première partie)
  canPlay = true;
  inGame = true;
  timer = defaultTime;
  document.querySelector(gameMenuSelector).classList.add('hidden');

  // On récupère le nom du joueur
  playerName = document.querySelector(playerNameSelector).value;

  // Et on génère les cartes
  generateCards();

  // On initialize la boucle de jeu qu'on stock dans gameInterval pour pouvoir la stopper plus tard.

  gameInterval = setInterval(() => {
    // S'il reste du temps alors on mets à jour la progresse bar et le chrono
    // Afin d'éviter d'être trop CPU intensif, on execute la boucle tous les 100ms
    // Au dela, la progress bar serait saccadée.
    if (timer > 0) {
      timer -= 100

      // On utilise la propriété right du css avec un pourcentage pour faire changer la progress bar de taille
      document.querySelector(gameProgressBarSelector).style.right = ((1 - timer / defaultTime) * 100) + '%';

      // On utilise la fonction padTime et getTime pour afficher un chrono lisible par l'homme
      document.querySelector(gameCountdownSelector).innerHTML = padTime(`${getTime(timer).m}:${getTime(timer).s}`);

      // Et à chaque boucle on check si l'on a gagné
      checkForWin();
    } else {
      // Si le chrono arrive à 0 c'est que le joueur à perdu. On affiche la défaite
      clearInterval(gameInterval);
      loseGame();
    }
  }, 100);
}

// Initialisation du jeu
const init = () => {

  // On récupère l'historique depuis la BDD
  getGames();

  // Code de debug pour permettre de tout retourner et verifier que le "gagner" fonctionne
    document.querySelector('#cheat').onclick = () => {
    document.querySelectorAll('.game-card').forEach(e => e.classList.add(cardPermaFlippedClass));
  }

  // On masque tous les menus
  document.querySelector(loseGameSelector).classList.add('hidden');
  document.querySelector(winGameSelector).classList.add('hidden');

  // On génère des cartes juste pour l'affichage
  generateCards();

  // On commence le jeu quand on clique sur le bouton démarrer.
  // Si aucun nom est specifié le joueur aura le nom de "Unnamed";
  document.querySelector(startBtnSelector).onclick = () => {
    startGame();
  }
}

init();