import type { DialogueNode, ItemDef, NpcDef } from "@emberfall3/shared";

export const itemCatalog: ItemDef[] = [
  {
    id: "potion",
    name: "Potion",
    description: "Un breuvage simple qui restaure quelques points de vie.",
    icon: "🧪",
    stackable: true,
    rarity: "common"
  },
  {
    id: "gold",
    name: "Or",
    description: "Une poignée de pièces brillantes.",
    icon: "🪙",
    stackable: true,
    rarity: "common"
  },
  {
    id: "key_tavern",
    name: "Clé de la taverne",
    description: "Ouvre la chambre à l'étage de la taverne.",
    icon: "🗝️",
    stackable: false,
    rarity: "uncommon"
  }
];

export const dialogueNodes: DialogueNode[] = [
  {
    id: "innkeeper_intro",
    speaker: "Aubergiste",
    text: "Bienvenue à la Frontière d'Ember. Les Pierres-Cœur fissurées ont rendu la nuit capricieuse.",
    choices: [
      {
        text: "Je cherche une chambre sûre.",
        next: "innkeeper_key"
      },
      {
        text: "Que se passe-t-il dehors ?",
        next: "innkeeper_lore"
      },
      {
        text: "Rien, merci.",
        end: true
      }
    ]
  },
  {
    id: "innkeeper_key",
    speaker: "Aubergiste",
    text: "Tu as l'air fiable. Prends cette clé, elle ouvre une chambre au calme.",
    choices: [
      {
        text: "Merci. Je te revaudrai ça.",
        giveItem: "key_tavern",
        startQuest: "emberfront_watch",
        end: true
      }
    ]
  },
  {
    id: "innkeeper_lore",
    speaker: "Aubergiste",
    text: "Depuis que la Pierre-Cœur d'Ember s'est fendue, la magie claque comme un feu sans foyer.",
    choices: [
      {
        text: "Je vais aider si je peux.",
        next: "innkeeper_key"
      },
      {
        text: "Je préfère rester discret.",
        end: true
      }
    ]
  },
  {
    id: "innkeeper_after",
    speaker: "Aubergiste",
    text: "Tu as déjà ta clé. Repose-toi, l'Ember ne dort jamais.",
    choices: [
      {
        text: "Merci, je reviens bientôt.",
        end: true
      }
    ]
  }
];

export const npcCatalog: NpcDef[] = [
  {
    id: "npc_innkeeper",
    name: "Aubergiste",
    tokenType: "npc",
    gridX: 4,
    gridY: 4,
    dialogueId: "innkeeper_intro"
  }
];

export const getItemDef = (itemId: string) => itemCatalog.find((item) => item.id === itemId) ?? null;

export const getDialogueNode = (nodeId: string) =>
  dialogueNodes.find((node) => node.id === nodeId) ?? null;

export const getNpcDef = (npcId: string) => npcCatalog.find((npc) => npc.id === npcId) ?? null;

export const getNpcByScene = (sceneId: string) =>
  sceneId === "tavern" ? npcCatalog : [];
