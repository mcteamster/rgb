import Clarity from '@microsoft/clarity';

export const initClarity = (projectId: string, isDiscord: boolean = false) => {
  if (isDiscord) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => Clarity.init(projectId));
    });
  } else {
    Clarity.init(projectId);
  }
};
