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
    text: "Bienvenue voyageur. Tu cherches quelque chose de spécial ?",
    choices: [
      {
        text: "Je cherche une chambre sûre.",
        next: "innkeeper_key"
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
    text: "Tu as l'air fiable. Voici une clé, ne la perds pas.",
    choices: [
      {
        text: "Merci !",
        giveItem: "key_tavern",
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
