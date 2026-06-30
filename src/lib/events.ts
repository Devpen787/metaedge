export const setGlobalAgentProcessing = (isProcessing: boolean, actionName?: string) => {
  window.dispatchEvent(
    new CustomEvent('agent-processing', { 
      detail: { isProcessing, actionName } 
    })
  );
};
