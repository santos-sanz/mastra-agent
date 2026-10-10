import type { Processor } from '@mastra/core/processors';

export const FINANCIAL_DISCLAIMER =
  '⚠️ Esto es información educativa, no asesoramiento financiero. Haz tu propia investigación (DYOR).';

const MARKERS = ['educativa', 'dyor'];

function textOf(parts: { type: string; text?: string }[]): string {
  return parts
    .filter(p => p.type === 'text')
    .map(p => p.text ?? '')
    .join(' ')
    .toLowerCase();
}

export class FinancialDisclaimerProcessor implements Processor {
  readonly id = 'financial-disclaimer';
  readonly name = 'Disclaimer financiero';
  readonly description =
    'Garantiza el disclaimer obligatorio (información educativa / DYOR) en toda respuesta del analista financiero.';

  async processOutputResult({ messages }: { messages: any[] }): Promise<any[]> {
    const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
    if (!lastAssistant?.content?.parts) return messages;
    const text = textOf(lastAssistant.content.parts);
    if (MARKERS.some(marker => text.includes(marker))) return messages;
    lastAssistant.content.parts.push({ type: 'text', text: `\n\n${FINANCIAL_DISCLAIMER}` });
    return messages;
  }
}

export const financialDisclaimerProcessor = new FinancialDisclaimerProcessor();
