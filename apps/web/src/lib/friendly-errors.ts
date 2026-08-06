export const friendlyErrorMessages = {
  load: "We couldn't load the latest information. Please try again in a moment.",
  save: "We couldn't save your changes. Please try again.",
  sync: "We couldn't sync your contacts right now. Please try again.",
  connect: "We couldn't start the connection. Please try again.",
  auth: "We couldn't complete sign in. Please try again.",
};

export function logUiError(context: string, error: unknown) {
  console.error(context, error);
}
