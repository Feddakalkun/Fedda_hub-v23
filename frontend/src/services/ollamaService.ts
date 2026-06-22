export interface OllamaModel {
  name: string;
  size: number;
  digest: string;
  modified_at: string;
}

export interface OllamaProgress {
  status: string;
  digest?: string;
  total?: number;
  completed?: number;
}

export const ollamaService = {
  getModels: async (): Promise<OllamaModel[]> => {
    const response = await fetch('/ollama/tags');
    if (!response.ok) throw new Error('Failed to fetch models');
    const data = await response.json();
    return data.models || [];
  },

  pullModel: async (modelName: string, onProgress: (progress: OllamaProgress) => void) => {
    const response = await fetch('/ollama/pull', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName, stream: true }),
    });
    if (!response.ok) throw new Error('Failed to pull model');
    if (!response.body) throw new Error('No response body');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      for (const line of chunk.split('\n').filter((l) => l.trim())) {
        try { onProgress(JSON.parse(line)); } catch {}
      }
    }
  },

  deleteModel: async (modelName: string) => {
    const response = await fetch('/ollama/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName }),
    });
    if (!response.ok) throw new Error('Failed to delete model');
    return true;
  },

  generate: async (model: string, prompt: string, system?: string): Promise<string> => {
    const response = await fetch('/ollama/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt, system, stream: false, options: { temperature: 0.7, num_predict: 512 } }),
    });
    if (!response.ok) throw new Error('Ollama generate failed');
    const data = await response.json();
    return data.response?.trim() || '';
  },
};
