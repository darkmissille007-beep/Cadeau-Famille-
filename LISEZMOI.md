# Mise en ligne sur Netlify

Ce dossier est un site complet : la page (`public/`) et un petit serveur (`netlify/functions/api.mjs`) qui garde les données dans Netlify Blobs. Aucun compte claude.ai n'est nécessaire.

Le glisser-déposer « Netlify Drop » ne suffit pas : il ne publie pas le serveur. Utilisez l'une de ces deux méthodes.

## Méthode 1 : depuis l'ordinateur (Node.js installé)
1. Ouvrez un terminal dans ce dossier.
2. `npm install`
3. `npx netlify-cli login` (ouvre le navigateur pour vous connecter à Netlify)
4. `npx netlify-cli deploy --prod` puis choisissez « Create & configure a new project ».

## Méthode 2 : via GitHub
1. Mettez ce dossier dans un dépôt GitHub.
2. Sur Netlify : Add new project → Import an existing project → choisissez le dépôt.
3. Laissez les réglages proposés (ils sont lus dans `netlify.toml`) et déployez.

## Premier lancement
- Ouvrez l'adresse du site juste après la mise en ligne : l'écran « Première configuration » affiche déjà toute la famille (Paul, Laurence, Vincent, Jade, Ethen, Zoé, Chiara) avec un code proposé pour chacun.
- Gardez les codes proposés ou tapez les vôtres. Un code laissé vide pourra être donné plus tard. La première ligne (Paul) est l'organisateur, et son code est obligatoire.
- Cliquez sur « Créer les accès », puis transmettez à chacun son code en privé.
- Chacun entre ensuite avec son prénom et son code, et peut le changer dans « Mon code ».
- Changer le code de quelqu'un : dans « Gérer la famille », l'organisateur clique sur « Changer le code » (ou « Donner un code »), tape le code voulu ou garde celui proposé, puis « Enregistrer ». L'ancien code ne marche plus et la personne est déconnectée de ses appareils.
- Les codes sont uniquement des chiffres (4 à 12) : sur téléphone, le pavé numérique s'ouvre directement.
- Après 5 codes faux, le prénom est bloqué 10 minutes.

## Noël et anniversaires
- En haut de la page, le bouton « Noël / Anniversaires » change le décor (sapin, rouge et or, ou violet, corail et confettis). Il passe tout seul sur Noël en novembre et décembre ; le choix de chacun est retenu sur son appareil.
- Chaque idée peut être marquée « Noël », « Anniversaire » ou « Les deux », et la liste se filtre par occasion.
- « Anniversaires » (en haut, une fois connecté) : chacun indique son jour et son mois de naissance ; l'organisateur peut le faire pour tout le monde. Le bandeau affiche alors le compte à rebours jusqu'à Noël et jusqu'au prochain anniversaire.
- Les anniversaires de la famille sont déjà enregistrés (Paul 22 septembre, Laurence 29 août, Vincent 18 mars, Jade 21 janvier, Ethen 1er novembre, Zoé 28 octobre, Chiara 24 mai), y compris sur un site déjà configuré. Chacun peut corriger ou effacer sa date dans « Anniversaires ».
- Les dates d'anniversaire ne sont visibles qu'une fois connecté.

## Fête des mères et fête des pères
- Le bouton en haut propose aussi « Fête des mères » (framboise, sauge, fleurs) et « Fête des pères » (bleu marine, moutarde, étoiles), avec « Bonne fête, maman » / « Bonne fête, papa ».
- Les dates sont calculées toutes seules chaque année (règles françaises) : fête des mères le dernier dimanche de mai, ou le premier dimanche de juin quand il tombe à la Pentecôte ; fête des pères le troisième dimanche de juin.
- Le décor passe tout seul sur la fête des mères 3 semaines avant, puis sur la fête des pères jusqu'au jour J. Un thème choisi à la main est retenu 3 semaines.
- Seuls les parents sont concernés : Laurence (fête des mères) et Vincent (fête des pères). On ne peut ajouter une idée « Fête des mères » que pour Laurence, et « Fête des pères » que pour Vincent ; en choisissant le thème, la page ouvre directement sa liste.
- L'organisateur peut changer ce réglage dans « Gérer la famille » (menu « Maman / Papa / Pas de fête » sur chaque ligne).
