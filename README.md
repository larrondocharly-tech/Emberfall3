# Emberfall VTT - Virtual Tabletop multijoueur

Virtual Tabletop (VTT) multijoueur inspiré de Foundry VTT / The Forge, jouable dans le navigateur et créé from scratch en TypeScript.

## Stack
- Client: Phaser 3 + TypeScript + Vite
- Serveur: Colyseus + TypeScript + Node.js
- Monorepo: npm workspaces

## Structure
```
/apps/client      # Phaser + Vite
/apps/server      # Colyseus + API data JSON
/packages/shared  # Types partagés
```

## Installation
```bash
npm install
```

## Lancer en local (client + serveur)
```bash
npm run dev
```

- Serveur: http://localhost:2567
- Client: http://localhost:5173

## Tester à 2 joueurs (2 onglets)
1. Ouvrir `http://localhost:5173` dans un premier onglet.
2. Entrer un pseudo, choisir race/classe, puis cliquer **Créer une room** (vous êtes GM).
3. Copier le code affiché.
4. Ouvrir un second onglet et **Rejoindre** avec le code.

## Jouer avec un pote sur le LAN
1. Trouver l'IP locale du PC serveur (ex: `192.168.1.50`).
2. Remplacer `localhost` dans le client par cette IP si besoin.
3. Ouvrir `http://192.168.1.50:5173` sur la machine distante.
4. Le serveur Colyseus écoute `ws://192.168.1.50:2567`.

## Déploiement (dev)
- Construire: `npm run build`
- Héberger le dossier `apps/client/dist` avec un serveur statique.
- Lancer le serveur Node: `npm run start --workspace apps/server`

## Fonctionnalités MVP
- Lobby avec création/rejoindre de room.
- GM (premier joueur) avec boutons dédiés.
- Map top-down avec grille et collisions basiques.
- Zoom/pan caméra (molette + drag).
- Tokens joueurs + ennemis (spawn GM).
- Déplacement libre en exploration (clic droit).
- Combat tour par tour, initiative server-side, déplacement par cases.
- Chat global + lancers de dés serveur.
- Spells/VFX visibles par tous.
- Données JSON pour races/classes/sorts/monstres/quête.

## Données data-driven
Les fichiers JSON sont dans:
```
/apps/server/data
  races.json
  classes.json
  spells.json
  monsters.json
  quests.json
```
