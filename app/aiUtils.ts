export function supportsThinkingConfig(model: string): boolean {
  return !model.startsWith('gemini-2.0') && !model.startsWith('gemma');
}
