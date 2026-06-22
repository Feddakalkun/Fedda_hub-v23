// ComfyUI API Configuration
const COMFY_BASE = import.meta.env.VITE_COMFY_URL || '/comfy';
const BACKEND_BASE = import.meta.env.VITE_BACKEND_URL || '';
const WS_PROTO = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const WS_HOST = import.meta.env.VITE_COMFY_WS_URL || `${WS_PROTO}//${window.location.host}/comfy/ws`;

export const COMFY_API = {
    BASE_URL: COMFY_BASE,
    ENDPOINTS: {
        PROMPT: '/prompt',
        QUEUE: '/queue',
        HISTORY: '/history',
        VIEW: '/view',
        UPLOAD_IMAGE: '/upload/image',
        SYSTEM_STATS: '/system_stats',
        OBJECT_INFO: '/object_info',
        INTERRUPT: '/interrupt',
    },
    WS_URL: WS_HOST,
};

export const BACKEND_API = {
    BASE_URL: BACKEND_BASE,
    ENDPOINTS: {
        FILES_LIST: '/api/files/list',
        FILES_DELETE: '/api/files/delete',
        FILES_CLEANUP: '/api/files/cleanup',
        LORA_DESCRIPTIONS: '/api/lora/descriptions',
        LORA_INSTALL: '/api/lora/install',
        LORA_DOWNLOAD_STATUS: '/api/lora/download-status',
        LORA_SYNC_PREMIUM: '/api/lora/sync-premium',
        LORA_INSTALLED: '/api/lora/installed',
        LORA_IMPORT_URL: '/api/lora/import-url',
        LORA_IMPORT_STATUS: '/api/lora/import-status',
        LORA_UPLOAD: '/api/lora/upload',
        LORA_UPLOAD_TARGETS: '/api/lora/upload-targets',
        SETTINGS_CIVITAI_KEY: '/api/settings/civitai-key',
        SETTINGS_CIVITAI_KEY_STATUS: '/api/settings/civitai-key/status',
        SETTINGS_HF_TOKEN: '/api/settings/hf-token',
        SETTINGS_HF_TOKEN_STATUS: '/api/settings/hf-token/status',
        CHAT: '/api/chat',
        CHAT_HISTORY: '/api/chat/history',
        CHAT_RESET: '/api/chat/reset',
        AGENT_SETTINGS: '/api/agent/settings',
        AGENT_RUN: '/api/agent/run',
        COMFY_REFRESH_MODELS: '/api/comfy/refresh-models',
        AUDIO_TRANSCRIBE: '/api/audio/transcribe',
        OLLAMA_VISION_MODELS: '/api/ollama/vision-models',
        OLLAMA_MODELS: '/api/ollama/models',
        OLLAMA_PROMPT: '/api/ollama/prompt',
        OLLAMA_CAPTION: '/api/ollama/caption',
        HARDWARE_STATS: '/api/hardware/stats',
        WORKFLOW_LIST: '/api/workflow/list',
        WORKFLOW_MODEL_STATUS: '/api/workflow/model-status',
        GENERATE: '/api/generate',
        GENERATE_STATUS: '/api/generate/status',
        LORA_LIST: '/api/lora/list',
        WORKFLOW_MEMORY: '/api/workflow-memory',
        UI_AGENT_WORKFLOWS: '/api/ui-agent/workflows',
        UI_AGENT_PLAN: '/api/ui-agent/plan',
        UI_AGENT_PREPARE: '/api/ui-agent/prepare',
        UI_AGENT_RUN: '/api/ui-agent/run',
        UI_AGENT_MEMPALACE_STATUS: '/api/ui-agent/mempalace/status',
    },
};

export const IS_RUNPOD = /\.proxy\.runpod\.net$/i.test(window.location.host);

export const APP_CONFIG = {
    NAME: 'FEDDA',
    VERSION: '23.0',
    DESCRIPTION: 'PREMIUM COMFYUI FRONTEND',
};
