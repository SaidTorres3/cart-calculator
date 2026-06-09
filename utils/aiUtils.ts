export function supportsThinkingConfig(model: string): boolean {
  return !model.startsWith('gemma');
}
