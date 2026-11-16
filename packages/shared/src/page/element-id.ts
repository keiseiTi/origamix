export const createElementId = (
  materialType: string,
  randomId: (length: number) => string,
  isTaken?: (id: string) => boolean,
): string => {
  let id: string;
  do {
    id = `${materialType}_${randomId(8)}`;
  } while (isTaken?.(id));
  return id;
};
