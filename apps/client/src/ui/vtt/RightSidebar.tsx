export type SidebarTab = "Chat" | "Actors" | "Items" | "Journal" | "Scenes";

export type RightSidebarElements = {
  root: HTMLDivElement;
  tabs: Record<SidebarTab, HTMLButtonElement>;
  contents: Record<SidebarTab, HTMLDivElement>;
  backButton: HTMLButtonElement;
};

const TAB_LABELS: SidebarTab[] = ["Chat", "Actors", "Items", "Journal", "Scenes"];

export function createRightSidebar(): RightSidebarElements {
  const root = document.createElement("div");
  root.className = "vtt-right-sidebar";

  const tabsRow = document.createElement("div");
  tabsRow.className = "vtt-tabs";

  const tabs = {} as Record<SidebarTab, HTMLButtonElement>;
  const contents = {} as Record<SidebarTab, HTMLDivElement>;

  const contentContainer = document.createElement("div");
  contentContainer.className = "vtt-sidebar-content";

  TAB_LABELS.forEach((label, index) => {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "vtt-tab";
    tab.textContent = label;
    if (index === 0) {
      tab.classList.add("active");
    }
    tabsRow.appendChild(tab);
    tabs[label] = tab;

    const content = document.createElement("div");
    content.style.display = index === 0 ? "block" : "none";
    contents[label] = content;
    contentContainer.appendChild(content);
  });

  const footer = document.createElement("div");
  footer.className = "vtt-sidebar-footer";
  const backButton = document.createElement("button");
  backButton.type = "button";
  backButton.textContent = "Retour au lobby";
  footer.appendChild(backButton);

  root.appendChild(tabsRow);
  root.appendChild(contentContainer);
  root.appendChild(footer);

  return { root, tabs, contents, backButton };
}
