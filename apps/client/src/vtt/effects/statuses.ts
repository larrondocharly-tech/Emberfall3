export type TokenStatusType = "wet" | "oiled" | "burning" | "shocked";

export type TokenStatus = {
  type: TokenStatusType;
  remainingTurns: number;
};

const cloneStatuses = (statuses: TokenStatus[]) => statuses.map((status) => ({ ...status }));

export function createStatusStore() {
  const statusMap = new Map<string, TokenStatus[]>();

  const getStatuses = (tokenId: string) => cloneStatuses(statusMap.get(tokenId) ?? []);

  const setStatuses = (tokenId: string, statuses: TokenStatus[]) => {
    statusMap.set(tokenId, cloneStatuses(statuses));
  };

  const addStatus = (tokenId: string, type: TokenStatusType, durationTurns: number) => {
    const existing = statusMap.get(tokenId) ?? [];
    const next = existing.map((status) => ({ ...status }));
    const index = next.findIndex((status) => status.type === type);
    if (index >= 0) {
      next[index] = { type, remainingTurns: Math.max(next[index].remainingTurns, durationTurns) };
    } else {
      next.push({ type, remainingTurns: durationTurns });
    }
    statusMap.set(tokenId, next);
  };

  const removeStatus = (tokenId: string, type: TokenStatusType) => {
    const existing = statusMap.get(tokenId);
    if (!existing) {
      return;
    }
    statusMap.set(
      tokenId,
      existing.filter((status) => status.type !== type)
    );
  };

  const hasStatus = (tokenId: string, type: TokenStatusType) =>
    (statusMap.get(tokenId) ?? []).some((status) => status.type === type);

  const tickStatuses = () => {
    statusMap.forEach((statuses, tokenId) => {
      const next = statuses
        .map((status) => ({ ...status, remainingTurns: status.remainingTurns - 1 }))
        .filter((status) => status.remainingTurns > 0);
      if (next.length === 0) {
        statusMap.delete(tokenId);
      } else {
        statusMap.set(tokenId, next);
      }
    });
  };

  return {
    getStatuses,
    setStatuses,
    addStatus,
    removeStatus,
    hasStatus,
    tickStatuses
  };
}
