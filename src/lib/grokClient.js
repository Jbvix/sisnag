import OpenAI from 'openai';

/**
 * Cliente Grok (xAI) via SDK OpenAI-compatible.
 * @see https://docs.x.ai/docs/tutorial
 */
export function createGrokClient() {
  const apiKey = process.env.GROK_API_KEY || process.env.XAI_API_KEY;
  if (!apiKey) return null;

  const baseURL = process.env.GROK_API_BASE_URL || 'https://api.x.ai/v1';
  return new OpenAI({ apiKey, baseURL });
}

export function grokChatModel() {
  return process.env.GROK_CHAT_MODEL || 'grok-4.3';
}

export function grokVisionModel() {
  return process.env.GROK_VISION_MODEL || 'grok-4.3';
}
