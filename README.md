# Emberfall 3 - RPG 2D multijoueur (Monorepo)

Projet from scratch d'un RPG 2D top-down multijoueur inspiré de D&D.

## Stack
- Client: Phaser 3 + TypeScript + Vite
- Serveur: Colyseus + TypeScript + Node.js
- Monorepo: npm workspaces

## Structure
```
/apps/client   # Phaser + Vite
/apps/server   # Colyseus
/packages/shared # Types partagés
```

## Installation
```bash
npm install
```

## Lancer en local (client + serveur)
```bash
npm run dev
```

- Serveur: ws://localhost:2567
- Client: http://localhost:5173

## Tester à 2 joueurs
1. Ouvrir `http://localhost:5173` dans un premier onglet.
2. Entrer un pseudo et cliquer **Créer une room**.
3. Copier le code affiché.
4. Ouvrir un second onglet, entrer un pseudo et coller le code, puis **Rejoindre**.

## Gameplay MVP
- **Exploration**: clic droit pour déplacer le personnage (serveur authoritative).
- **Multijoueur**: les joueurs se voient en temps réel, avec pseudo.
- **PNJ**: approchez-vous du PNJ orange, appuyez sur **E** pour interagir.
- **Dialogues**: choix A/B modifiant les flags (JSON côté serveur).
- **Combat**: déclenché via un choix de dialogue, sur grille avec initiative.
- **Tours**: clic gauche pour déplacer sur la grille, bouton "Fin du tour" pour passer.

## Scripts
- `npm run dev` : lance le serveur et le client.
- `npm run build` : build complet.
