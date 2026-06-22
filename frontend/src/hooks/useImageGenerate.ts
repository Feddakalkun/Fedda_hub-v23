import { useCallback, useEffect, useRef, useState } from 'react';
import type { GenerateResponse, GenerateStatusResponse } from '../types/api';
import { BACKEND_API } from '../config/api';
import { useComfyExecution } from '../contexts/ComfyExecutionContext';
import { comfyService } from '../services/comfyService';
import { usePersistentState } from './usePersistentState';
import { useToast } from '../components/ui/Toast';

interface UseImageGenerateOptions {
  workflowId: string;
  historyKey: string;
  currentKey: string;
  maxHistory?: number;
}

export const useImageGenerate = ({
  workflowId,
  historyKey,
  currentKey,
  maxHistory = 30,
}: UseImageGenerateOptions) => {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [pendingPromptId, setPendingPromptId] = useState<string | null>(null);
  const [currentImage, setCurrentImage] = usePersistentState<string | null>(currentKey, null);
  const [history, setHistory] = usePersistentState<string[]>(historyKey, []);

  const prevCountRef = useRef(0);
  const {
    state: execState,
    previewUrl,
    lastOutputImages,
    outputReadyCount,
    registerNodeMap,
    clearOutputs,
  } = useComfyExecution();

  // Live image updates from WebSocket
  useEffect(() => {
    if (!isGenerating && !pendingPromptId) return;
    if (!lastOutputImages?.length) return;
    const newImgs = lastOutputImages.slice(prevCountRef.current);
    if (!newImgs.length) return;
    prevCountRef.current = lastOutputImages.length;
    const urls = newImgs.map((img) => comfyService.getImageUrl(img));
    if (!urls.length) return;
    setCurrentImage(urls[0]);
    setHistory((prev) => [...urls, ...prev.filter((u) => !urls.includes(u))].slice(0, maxHistory));
  }, [outputReadyCount, lastOutputImages, isGenerating, pendingPromptId, maxHistory, setCurrentImage, setHistory]);

  // Handle execution completion
  useEffect(() => {
    if (!pendingPromptId) return;
    if (execState === 'error') {
      setIsGenerating(false);
      setPendingPromptId(null);
      clearOutputs();
      return;
    }
    if (execState !== 'done') return;
    const promptId = pendingPromptId;
    setIsGenerating(false);
    setPendingPromptId(null);

    fetch(`${BACKEND_API.BASE_URL}${BACKEND_API.ENDPOINTS.GENERATE_STATUS}/${promptId}?workflow_id=${encodeURIComponent(workflowId)}`)
      .then((r) => r.json() as Promise<GenerateStatusResponse>)
      .then((data) => {
        const images = data.images ?? [];
        if (images.length > 0) {
          const urls = images.map((img) => comfyService.getImageUrl(img));
          setCurrentImage(urls[0]);
          setHistory((prev) => [...urls, ...prev.filter((u) => !urls.includes(u))].slice(0, maxHistory));
        }
        toast('Generation complete', 'success');
      })
      .catch(() => toast('Generation complete', 'success'))
      .finally(() => clearOutputs());
  }, [clearOutputs, execState, maxHistory, pendingPromptId, setCurrentImage, setHistory, toast, workflowId]);

  const start = useCallback(async (params: Record<string, unknown>): Promise<string | null> => {
    if (isGenerating) return null;
    prevCountRef.current = lastOutputImages?.length ?? 0;
    setIsGenerating(true);
    clearOutputs();

    fetch(`${BACKEND_API.BASE_URL}/api/workflow/node-map/${workflowId}`)
      .then((r) => r.json())
      .then((data) => { if (data.success) registerNodeMap(data.node_map); })
      .catch(() => {});

    try {
      const response = await fetch(`${BACKEND_API.BASE_URL}${BACKEND_API.ENDPOINTS.GENERATE}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflow_id: workflowId,
          params: { ...params, client_id: comfyService.clientId },
        }),
      });
      const data = await response.json() as GenerateResponse;
      if (!data.success) throw new Error(data.detail || 'Generate failed');
      setPendingPromptId(String(data.prompt_id));
      return String(data.prompt_id);
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Generation failed', 'error');
      setIsGenerating(false);
      return null;
    }
  }, [clearOutputs, isGenerating, lastOutputImages?.length, registerNodeMap, toast, workflowId]);

  return {
    isGenerating,
    currentImage,
    setCurrentImage,
    history,
    previewUrl,
    start,
  };
};
