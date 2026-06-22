// Global ComfyUI Execution Context
import { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { comfyService } from '../services/comfyService';

type ExecutionState = 'idle' | 'executing' | 'done' | 'error';

interface ExecutionError {
    type: string;
    message: string;
    nodeType?: string;
    nodeId?: string;
}

interface OutputFile {
    filename: string;
    subfolder: string;
    type: string;
}

interface DownloadFileInfo {
    filename?: string;
    folder?: string;
    exists?: boolean;
    size_bytes?: number;
}

interface NodeInfo {
    name: string;
    classType: string;
    isDownloader?: boolean;
    downloaderType?: string;
    downloadTotal?: number;
    downloadMissing?: number;
    downloadFiles?: DownloadFileInfo[];
}

interface ComfyExecutionContextType {
    state: ExecutionState;
    currentNodeName: string;
    currentNodeId: string | null;
    progress: number;
    isDownloaderNode: boolean;
    currentDownloaderInfo: NodeInfo | null;
    error: ExecutionError | null;
    totalNodes: number;
    completedNodes: number;
    lastCompletedPromptId: string | null;
    outputReadyCount: number;
    lastOutputImages: OutputFile[];
    lastOutputVideos: OutputFile[];
    previewUrl: string | null;
    overallProgress: number;
    queueWorkflow: (workflow: Record<string, any>) => Promise<string>;
    registerNodeMap: (nodeMap: Record<string, unknown>) => void;
    startExecution: () => void;
    cancelExecution: () => Promise<void>;
    clearOutputs: () => void;
}

const ComfyExecutionContext = createContext<ComfyExecutionContextType | null>(null);

export const useComfyExecution = () => {
    const ctx = useContext(ComfyExecutionContext);
    if (!ctx) throw new Error('useComfyExecution must be used within ComfyExecutionProvider');
    return ctx;
};

const DOWNLOADER_REGEX = /download|linker|fetch|huggingface|hf_hub|model.*load/i;

function cleanClassName(classType: string): string {
    return classType
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
        .replace(/_/g, ' ')
        .trim();
}

function parseDownloaderFiles(node: any): DownloadFileInfo[] {
    const raw = String(node?.inputs?.download_links || '').trim();
    if (!raw) return [];
    const seen = new Set<string>();
    return raw.split(/\r?\n/).flatMap((line) => {
        const clean = line.trim();
        if (!clean || clean.startsWith('#')) return [];
        const parts = clean.split(/\s+/);
        if (parts.length < 2) return [];
        const urlPath = (parts[0] || '').split('?', 1)[0].replace(/\/+$/, '');
        const filename = parts[2] || urlPath.split('/').pop() || '';
        const folder = (parts[1] || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
        const key = `${folder.toLowerCase()}/${filename.toLowerCase()}`;
        if (!filename || !folder || seen.has(key)) return [];
        seen.add(key);
        return [{ filename, folder }];
    });
}

function buildNodeMap(workflow: Record<string, any>): Record<string, NodeInfo> {
    const map: Record<string, NodeInfo> = {};
    for (const [nodeId, node] of Object.entries(workflow)) {
        if (!node || typeof node !== 'object') continue;
        const classType = node.class_type || 'Unknown';
        const metaTitle = node._meta?.title;
        const name = metaTitle || cleanClassName(classType);
        const isDownloader = classType === 'HuggingFaceDownloader' || DOWNLOADER_REGEX.test(classType) || DOWNLOADER_REGEX.test(name);
        const downloadFiles = classType === 'HuggingFaceDownloader' ? parseDownloaderFiles(node) : undefined;
        map[nodeId] = {
            name,
            classType,
            isDownloader,
            downloaderType: classType === 'HuggingFaceDownloader' ? 'huggingface' : undefined,
            downloadTotal: downloadFiles?.length,
            downloadFiles,
        };
    }
    return map;
}

function isVideoFile(filename?: string): boolean {
    const lower = String(filename || '').toLowerCase();
    return lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.mov') || lower.endsWith('.mkv');
}

export const ComfyExecutionProvider = ({ children }: { children: React.ReactNode }) => {
    const [state, setState] = useState<ExecutionState>('idle');
    const [currentNodeName, setCurrentNodeName] = useState('');
    const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
    const [progress, setProgress] = useState(0);
    const [isDownloaderNode, setIsDownloaderNode] = useState(false);
    const [currentDownloaderInfo, setCurrentDownloaderInfo] = useState<NodeInfo | null>(null);
    const [error, setError] = useState<ExecutionError | null>(null);
    const [totalNodes, setTotalNodes] = useState(0);
    const [completedNodes, setCompletedNodes] = useState(0);
    const [lastCompletedPromptId, setLastCompletedPromptId] = useState<string | null>(null);
    const [outputReadyCount, setOutputReadyCount] = useState(0);
    const [lastOutputImages, setLastOutputImages] = useState<OutputFile[]>([]);
    const [lastOutputVideos, setLastOutputVideos] = useState<OutputFile[]>([]);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    const nodeMapRef = useRef<Record<string, NodeInfo>>({});
    const prevPreviewRef = useRef<string | null>(null);
    const executedNodesRef = useRef<Set<string>>(new Set());
    const doneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const activePromptIdRef = useRef<string | null>(null);
    const cancelledRef = useRef(false);
    const stateRef = useRef<ExecutionState>('idle');

    const transitionToDone = useCallback(() => {
        setState('done');
        stateRef.current = 'done';
        setCurrentNodeName('Complete');
        setProgress(100);
        setIsDownloaderNode(false);
        setCurrentDownloaderInfo(null);
        if (prevPreviewRef.current) { URL.revokeObjectURL(prevPreviewRef.current); prevPreviewRef.current = null; }
        setPreviewUrl(null);

        if (activePromptIdRef.current) {
            setLastCompletedPromptId(activePromptIdRef.current);
        }

        if (doneTimerRef.current) clearTimeout(doneTimerRef.current);
        doneTimerRef.current = setTimeout(() => {
            setState('idle');
            stateRef.current = 'idle';
            setCurrentNodeName('');
            setCurrentNodeId(null);
            setProgress(0);
            setCompletedNodes(0);
            setTotalNodes(0);
            setCurrentDownloaderInfo(null);
            executedNodesRef.current.clear();
        }, 5000);
    }, []);

    useEffect(() => {
        const disconnect = comfyService.connectWebSocket({
            onExecuting: (nodeId: string | null) => {
                if (cancelledRef.current) return;
                if (doneTimerRef.current) { clearTimeout(doneTimerRef.current); doneTimerRef.current = null; }

                if (!nodeId) { transitionToDone(); return; }

                setState('executing');
                stateRef.current = 'executing';
                setCurrentNodeId(nodeId);
                setError(null);

                executedNodesRef.current.add(nodeId);
                setCompletedNodes(executedNodesRef.current.size);

                const nodeInfo = nodeMapRef.current[nodeId];
                if (nodeInfo) {
                    setCurrentNodeName(nodeInfo.name);
                    const downloader = !!nodeInfo.isDownloader || DOWNLOADER_REGEX.test(nodeInfo.classType) || DOWNLOADER_REGEX.test(nodeInfo.name);
                    setIsDownloaderNode(downloader);
                    setCurrentDownloaderInfo(downloader ? nodeInfo : null);
                } else {
                    setCurrentNodeName(`Node ${nodeId}`);
                    setIsDownloaderNode(false);
                    setCurrentDownloaderInfo(null);
                }
                setProgress(0);
            },

            onProgress: (_node: string, value: number, max: number) => {
                if (cancelledRef.current) return;
                setProgress(Math.round((value / max) * 100));
            },

            onCompleted: (promptId: string, output: Record<string, any>) => {
                if (cancelledRef.current) return;
                activePromptIdRef.current = promptId;
                setLastCompletedPromptId(promptId);

                if (output?.images && Array.isArray(output.images)) {
                    const videosFromImages = output.images.filter((f: OutputFile) => isVideoFile(f?.filename));
                    const stillImages = output.images.filter((f: OutputFile) => !isVideoFile(f?.filename));
                    if (stillImages.length > 0) setLastOutputImages(prev => [...prev, ...stillImages]);
                    if (videosFromImages.length > 0) setLastOutputVideos(prev => [...prev, ...videosFromImages]);
                }
                if (output?.gifs && Array.isArray(output.gifs)) setLastOutputVideos(prev => [...prev, ...output.gifs]);
                if (output?.videos && Array.isArray(output.videos)) setLastOutputVideos(prev => [...prev, ...output.videos]);
                setOutputReadyCount(prev => prev + 1);
            },

            onExecutionError: (errData: Record<string, any>) => {
                if (cancelledRef.current) return;
                const message = errData?.exception_message || errData?.message || 'Workflow execution failed';
                setState('error');
                stateRef.current = 'error';
                setError({
                    type: 'execution_error',
                    message: String(message).trim(),
                    nodeType: errData?.node_type,
                    nodeId: errData?.node_id,
                });
                setCurrentNodeName(errData?.node_type ? `Error in ${errData.node_type}` : 'Execution Error');
                setCurrentNodeId(errData?.node_id ? String(errData.node_id) : null);
                setProgress(0);
                setIsDownloaderNode(false);
                setCurrentDownloaderInfo(null);
            },

            onPreview: (blobUrl: string) => {
                if (cancelledRef.current) return;
                if (prevPreviewRef.current) URL.revokeObjectURL(prevPreviewRef.current);
                prevPreviewRef.current = blobUrl;
                setPreviewUrl(blobUrl);
            },

            onStatus: (data: Record<string, any>) => {
                if (data?.exec_info?.queue_remaining === 0 && stateRef.current === 'executing') {
                    transitionToDone();
                }
            },
        });

        return () => disconnect();
    }, [transitionToDone]);

    const startExecution = useCallback(() => {
        cancelledRef.current = false;
        if (doneTimerRef.current) { clearTimeout(doneTimerRef.current); doneTimerRef.current = null; }
        executedNodesRef.current.clear();
        setCompletedNodes(0);
        setOutputReadyCount(0);
        setLastOutputImages([]);
        setLastOutputVideos([]);
        if (prevPreviewRef.current) { URL.revokeObjectURL(prevPreviewRef.current); prevPreviewRef.current = null; }
        setPreviewUrl(null);
        setState('executing');
        stateRef.current = 'executing';
        setCurrentNodeName('Loading...');
        setCurrentNodeId(null);
        setProgress(0);
        setError(null);
        setIsDownloaderNode(false);
        setCurrentDownloaderInfo(null);
    }, []);

    const cancelExecution = useCallback(async () => {
        try {
            cancelledRef.current = true;
            await comfyService.interrupt();
            if (doneTimerRef.current) { clearTimeout(doneTimerRef.current); doneTimerRef.current = null; }
            setState('idle');
            stateRef.current = 'idle';
            setCurrentNodeName('');
            setCurrentNodeId(null);
            setProgress(0);
            setError(null);
            setIsDownloaderNode(false);
            setCurrentDownloaderInfo(null);
            setCompletedNodes(0);
            setTotalNodes(0);
            executedNodesRef.current.clear();
            if (prevPreviewRef.current) { URL.revokeObjectURL(prevPreviewRef.current); prevPreviewRef.current = null; }
            setPreviewUrl(null);
        } catch (err: any) {
            console.error('Cancel failed:', err);
        }
    }, []);

    const clearOutputs = useCallback(() => {
        setLastOutputImages([]);
        setLastOutputVideos([]);
        setLastCompletedPromptId(null);
        setOutputReadyCount(0);
        if (prevPreviewRef.current) { URL.revokeObjectURL(prevPreviewRef.current); prevPreviewRef.current = null; }
        setPreviewUrl(null);
    }, []);

    const queueWorkflow = useCallback(async (workflow: Record<string, any>): Promise<string> => {
        cancelledRef.current = false;
        if (doneTimerRef.current) { clearTimeout(doneTimerRef.current); doneTimerRef.current = null; }

        const nodeMap = buildNodeMap(workflow);
        nodeMapRef.current = nodeMap;
        setTotalNodes(Object.keys(nodeMap).length);
        executedNodesRef.current.clear();
        setCompletedNodes(0);
        setOutputReadyCount(0);
        setLastOutputImages([]);
        setLastOutputVideos([]);
        if (prevPreviewRef.current) { URL.revokeObjectURL(prevPreviewRef.current); prevPreviewRef.current = null; }
        setPreviewUrl(null);

        setState('executing');
        stateRef.current = 'executing';
        setCurrentNodeName('Queuing...');
        setCurrentNodeId(null);
        setProgress(0);
        setError(null);
        setIsDownloaderNode(false);
        setCurrentDownloaderInfo(null);

        try {
            const result = await comfyService.queuePrompt(workflow);
            activePromptIdRef.current = result.prompt_id;
            return result.prompt_id;
        } catch (err: any) {
            let execError: ExecutionError = { type: 'queue_error', message: err.message || 'Failed to queue workflow' };
            try {
                if (err.message?.includes('missing_node_type')) {
                    const match = err.message.match(/Node '(.+?)' not found/);
                    execError = {
                        type: 'missing_node_type',
                        message: match ? `Missing node: "${match[1]}"` : 'Missing custom node',
                        nodeType: match?.[1],
                    };
                }
            } catch {}
            setState('error');
            stateRef.current = 'error';
            setError(execError);
            setCurrentNodeName('Error');
            throw err;
        }
    }, []);

    const overallProgress = totalNodes > 0 ? Math.round((completedNodes / totalNodes) * 100) : 0;

    return (
        <ComfyExecutionContext.Provider value={{
            state, currentNodeName, currentNodeId, progress, isDownloaderNode, currentDownloaderInfo,
            error, totalNodes, completedNodes, lastCompletedPromptId, outputReadyCount,
            lastOutputImages, lastOutputVideos, previewUrl, overallProgress,
            queueWorkflow,
            registerNodeMap: (nm) => { nodeMapRef.current = nm as Record<string, NodeInfo>; },
            startExecution, cancelExecution, clearOutputs,
        }}>
            {children}
        </ComfyExecutionContext.Provider>
    );
};
