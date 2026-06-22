import { useState, useRef, useEffect } from 'react';
import { Sparkles, Download, ImageIcon, Loader2, AlertCircle, Send, Trash2, Globe, Settings } from 'lucide-react';
import { useToast } from '../components/ui/Toast';
import { Button } from '../components/ui/Button';
import { Lightbox } from '../components/ui/Lightbox';
import { triggerMediaDownload } from '../utils/mediaStore';
import { cn } from '../lib/styles';

const VENICE_IMAGE_MODELS = [
  { id: 'venice-sd35', label: 'Venice SD35 (fast & cheap)' },
  { id: 'chroma', label: 'Chroma' },
  { id: 'flux-2-pro', label: 'Flux 2 Pro' },
  { id: 'flux-2-max', label: 'Flux 2 Max' },
  { id: 'lustify-sdxl', label: 'Lustify SDXL' },
  { id: 'lustify-v8', label: 'Lustify v8' },
  { id: 'wai-Illustrious', label: 'Anime (WAI)' },
  { id: 'grok-imagine-image', label: 'Grok Imagine' },
  { id: 'grok-imagine-image-quality', label: 'Grok Imagine (High Quality)' },
  { id: 'qwen-image', label: 'Qwen Image' },
];

const VENICE_CHAT_MODELS = [
  { id: 'kimi-k2-5', label: 'Kimi K2.5' },
  { id: 'zai-org-glm-5-1', label: 'GLM 5.1 (Strong Reasoning & Tools)' },
  { id: 'kimi-k2-6', label: 'Kimi K2.6' },
  { id: 'qwen3-6-27b', label: 'Qwen 3 27B' },
  { id: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro' },
  { id: 'claude-opus-4-6', label: 'Claude Opus 4.6 (Anonymized)' },
];

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  images?: string[];
}

const saveToGlobalGallery = (urls: string[], source = 'venice') => {
  if (typeof window === 'undefined' || !urls.length) return;
  try {
    const key = `gallery_${source}`;
    const existing: string[] = JSON.parse(localStorage.getItem(key) || '[]');
    const updated = [...urls, ...existing.filter((u) => !urls.includes(u))].slice(0, 60);
    localStorage.setItem(key, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('fedda:gallery-updated'));
  } catch {}
};

const inputCls = 'w-full rounded-xl border border-white/10 bg-fedda-bg-2 px-3 py-2 text-sm text-fedda-text-1 outline-none focus:border-white/20';
const tabBtnCls = (active: boolean) => cn(
  'px-6 py-2.5 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors',
  active ? 'border-fedda-accent text-fedda-text-1' : 'border-transparent text-fedda-text-3 hover:text-fedda-text-1',
);

export function VenicePage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'image' | 'chat'>('image');
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // ── Image Generation ──────────────────────────────────────────────────
  const [imgModel, setImgModel] = useState('chroma');
  const [imgPrompt, setImgPrompt] = useState('a beautiful landscape, highly detailed, cinematic');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [width, setWidth] = useState(1024);
  const [height, setHeight] = useState(1024);
  const [steps, setSteps] = useState(20);
  const [cfgScale, setCfgScale] = useState(7.5);
  const [seed, setSeed] = useState<number | undefined>(undefined);
  const [isImgGenerating, setIsImgGenerating] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [imgError, setImgError] = useState('');

  const generateImage = async () => {
    const apiKey = localStorage.getItem('venice_api_key') || '';
    if (!apiKey) { toast('Set your Venice.ai API key in the top bar (Key icon)', 'error'); return; }
    if (!imgPrompt.trim()) { toast('Prompt is required', 'error'); return; }
    setIsImgGenerating(true); setImgError(''); setImages([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body: any = { model: imgModel, prompt: imgPrompt.trim(), width, height, steps, cfg_scale: cfgScale, format: 'png', safe_mode: false, hide_watermark: true };
    if (negativePrompt.trim()) body.negative_prompt = negativePrompt.trim();
    if (seed !== undefined) body.seed = seed;
    try {
      const res = await fetch('https://api.venice.ai/api/v1/image/generate', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        let errMsg = `API error ${res.status}`;
        try { const d = await res.json(); if (d.error) errMsg += `: ${d.error}`; } catch { errMsg += `: ${await res.text()}`; }
        throw new Error(errMsg);
      }
      const data = await res.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const newImgs: string[] = (data.images || data.data || []).map((i: any) => {
        if (typeof i === 'string') return i.startsWith('http') ? i : 'data:image/png;base64,' + i;
        if (i?.b64_json) return 'data:image/png;base64,' + i.b64_json;
        if (i?.url) return i.url;
        return null;
      }).filter(Boolean);
      setImages(newImgs);
      saveToGlobalGallery(newImgs, 'venice-image');
      toast('Generated with Venice.ai!', 'success');
    } catch (e: unknown) {
      const raw = e instanceof Error ? e.message : 'Failed to generate.';
      const friendly = raw.includes('429') || raw.toLowerCase().includes('overloaded')
        ? 'The model is currently overloaded on Venice.ai. Try venice-sd35 or chroma, or wait 30–60 s and retry.'
        : raw;
      setImgError(friendly);
      toast(friendly, 'error');
    } finally { setIsImgGenerating(false); }
  };

  // ── Agent Chat ────────────────────────────────────────────────────────
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: "Hello! I'm your Venice Agent. I can chat, search the web, understand images, and help with creative tasks. Switch to Image tab to generate directly, or ask me here!" },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatModel, setChatModel] = useState('kimi-k2-5');
  const [enableWebSearch, setEnableWebSearch] = useState(true);
  const [isChatGenerating, setIsChatGenerating] = useState(false);
  const [attachedImages, setAttachedImages] = useState<string[]>([]);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  const getApiKey = () => localStorage.getItem('venice_api_key') || '';

  const handleImageAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast('Please select an image file', 'error'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => setAttachedImages((prev) => [...prev, ev.target?.result as string]);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const clearChat = () => { setChatMessages([{ role: 'assistant', content: 'Chat cleared. How can I help you today?' }]); setAttachedImages([]); };

  const sendChatMessage = async () => {
    const apiKey = getApiKey();
    if (!apiKey) { toast('Set your Venice.ai API key in the top bar first', 'error'); return; }
    if (!chatInput.trim() && attachedImages.length === 0) return;

    const userMessage: ChatMessage = { role: 'user', content: chatInput.trim(), images: attachedImages.length > 0 ? [...attachedImages] : undefined };
    const newMessages = [...chatMessages, userMessage];
    setChatMessages(newMessages);
    setChatInput('');
    setAttachedImages([]);
    setIsChatGenerating(true);

    const systemPrompt = `You are an expert creative AI agent with direct access to image generation tools via the "generate_image" function. Whenever the user asks you to generate, create, draw, or visualize any images, you MUST immediately call the generate_image tool. Do NOT just describe in text — actually invoke the tool with a high-quality, detailed prompt.`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let apiMessages: any[] = [{ role: 'system', content: systemPrompt }, ...newMessages.map((msg) => {
      if (msg.images?.length) return { role: msg.role, content: [{ type: 'text', text: msg.content }, ...msg.images.map((img) => ({ type: 'image_url', image_url: { url: img } }))] };
      return { role: msg.role, content: msg.content };
    })];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body: any = {
      model: chatModel, messages: apiMessages, stream: true, temperature: 0.7,
      tools: [{
        type: 'function',
        function: {
          name: 'generate_image',
          description: 'Generate one or more images from a detailed text prompt using Venice AI. ALWAYS call this when the user requests any images.',
          parameters: { type: 'object', properties: { prompt: { type: 'string' }, negative_prompt: { type: 'string' }, num_images: { type: 'integer' } }, required: ['prompt'] },
        },
      }],
      tool_choice: 'auto',
      venice_parameters: { enable_web_search: enableWebSearch ? 'auto' : 'off', enable_web_citations: true, include_venice_system_prompt: true },
    };

    try {
      const res = await fetch('https://api.venice.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        let errMsg = `API error ${res.status}`;
        try { const d = await res.json(); if (d.error) errMsg += `: ${d.error}`; } catch { errMsg += `: ${await res.text()}`; }
        throw new Error(errMsg);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let assistantContent = '';
      let done = false;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let toolCallAcc: any = null;
      const assistantIdx = newMessages.length;
      setChatMessages([...newMessages, { role: 'assistant', content: '' }]);

      while (!done) {
        const { value, done: streamDone } = await reader.read();
        done = streamDone;
        if (value) {
          for (const line of decoder.decode(value, { stream: true }).split('\n')) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (data === '[DONE]') { done = true; break; }
            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta;
              if (delta?.content) {
                assistantContent += delta.content;
                setChatMessages((prev) => { const u = [...prev]; u[assistantIdx] = { role: 'assistant', content: assistantContent }; return u; });
              }
              if (delta?.tool_calls?.[0]) {
                const tc = delta.tool_calls[0];
                if (!toolCallAcc) toolCallAcc = { name: tc.function?.name || '', arguments: '' };
                if (tc.function?.arguments) toolCallAcc.arguments += tc.function.arguments;
                if (toolCallAcc.name === 'generate_image' && !assistantContent) {
                  assistantContent = 'Generating image…';
                  setChatMessages((prev) => { const u = [...prev]; u[assistantIdx] = { role: 'assistant', content: assistantContent }; return u; });
                }
              }
            } catch {}
          }
        }
      }

      if (toolCallAcc?.name === 'generate_image') {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const args: any = JSON.parse(toolCallAcc.arguments || '{}');
          const imgBody = { model: 'flux-2-pro', prompt: args.prompt || '', width: 1024, height: 1024, variants: Math.min(Math.max(parseInt(args.num_images || 4), 1), 4), format: 'png', safe_mode: false, hide_watermark: true, ...(args.negative_prompt ? { negative_prompt: args.negative_prompt } : {}) };
          const imgRes = await fetch('https://api.venice.ai/api/v1/image/generate', { method: 'POST', headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' }, body: JSON.stringify(imgBody) });
          if (imgRes.ok) {
            const imgData = await imgRes.json();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const newImgs: string[] = (imgData.images || imgData.data || []).map((i: any) => {
              if (typeof i === 'string') return i.startsWith('http') ? i : 'data:image/png;base64,' + i;
              if (i?.b64_json) return 'data:image/png;base64,' + i.b64_json;
              if (i?.url) return i.url;
              return null;
            }).filter(Boolean);
            setChatMessages((prev) => { const u = [...prev]; u[assistantIdx] = { role: 'assistant', content: assistantContent !== 'Generating image…' ? assistantContent : `Here are ${newImgs.length} generated images:`, images: newImgs }; return u; });
            saveToGlobalGallery(newImgs, 'venice-agent');
          }
        } catch (toolErr) { console.error('Tool execution error:', toolErr); }
      }
    } catch (e: unknown) {
      const raw = e instanceof Error ? e.message : 'Failed to get response from Venice.';
      const friendly = raw.includes('429') || raw.toLowerCase().includes('overloaded')
        ? 'The model is overloaded on Venice.ai. Try switching models (GLM or Kimi often have capacity) or wait and retry.'
        : raw;
      toast(friendly, 'error');
      setChatMessages((prev) => prev.slice(0, -1));
    } finally { setIsChatGenerating(false); }
  };

  return (
    <div className="h-full overflow-y-auto bg-fedda-bg-0 px-6 py-6">
      <div className="mx-auto max-w-4xl rounded-xl border border-white/[0.06] bg-fedda-bg-1 overflow-hidden">
        {/* Header */}
        <div className="border-b border-white/[0.06] px-6 pt-5 pb-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-fedda-accent/10 border border-fedda-accent/20 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-fedda-accent" />
              </div>
              <div>
                <div className="font-semibold text-fedda-text-1">Venice.ai</div>
                <div className="text-[10px] text-fedda-text-4 tracking-[0.5px]">PRIVATE · DIRECT API · IMAGE + AGENT</div>
              </div>
            </div>
            <div className="text-[10px] px-3 py-1 rounded-full border border-white/10 bg-white/[0.04] text-fedda-text-4 font-mono tracking-widest">uncensored · tools · vision</div>
          </div>
          <div className="flex border-b border-white/[0.06] -mx-1">
            <button onClick={() => setActiveTab('image')} className={tabBtnCls(activeTab === 'image')}><ImageIcon className="h-4 w-4" /> Image Generation</button>
            <button onClick={() => setActiveTab('chat')} className={tabBtnCls(activeTab === 'chat')}><Settings className="h-4 w-4" /> Agent Chat</button>
          </div>
        </div>

        <div className="p-6">
          {/* ── IMAGE TAB ── */}
          {activeTab === 'image' && (
            <div className="space-y-5 max-w-3xl mx-auto">
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-fedda-text-4 mb-1.5 block">Prompt</label>
                <textarea value={imgPrompt} onChange={(e) => setImgPrompt(e.target.value)} rows={4}
                  placeholder="A cinematic portrait of a cyberpunk samurai in neon rain…"
                  className="w-full rounded-xl border border-white/10 bg-fedda-bg-2 px-3 py-3 text-sm text-fedda-text-1 outline-none focus:border-white/20 resize-y" />
              </div>

              <div className="grid grid-cols-5 gap-4">
                <div className="col-span-3">
                  <label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-fedda-text-4 mb-1.5 block">Model</label>
                  <select value={imgModel} onChange={(e) => setImgModel(e.target.value)} className={inputCls}>
                    {VENICE_IMAGE_MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                  </select>
                  <p className="text-[10px] text-amber-400/70 mt-1">Popular models can be overloaded — try venice-sd35 or chroma if you see 429 errors.</p>
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-fedda-text-4 mb-1.5 block">Negative Prompt</label>
                  <input type="text" value={negativePrompt} onChange={(e) => setNegativePrompt(e.target.value)}
                    placeholder="blurry, low quality, deformed" className={inputCls} />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-fedda-text-4 mb-1.5 block">Dimensions &amp; Settings</label>
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: 'Width', val: width, set: setWidth },
                    { label: 'Height', val: height, set: setHeight },
                    { label: 'Steps', val: steps, set: setSteps },
                    { label: 'CFG Scale', val: cfgScale, set: setCfgScale, step: 0.5 },
                  ].map(({ label, val, set, step }) => (
                    <div key={label} className="space-y-1">
                      <div className="text-[10px] text-fedda-text-4">{label}</div>
                      <input type="number" value={val} step={step} onChange={(e) => (set as (v: number) => void)(+e.target.value)} className={inputCls} />
                    </div>
                  ))}
                </div>
                <div className="mt-3">
                  <div className="text-[10px] text-fedda-text-4 mb-1">Seed (optional)</div>
                  <input type="number" value={seed ?? ''} onChange={(e) => setSeed(e.target.value ? +e.target.value : undefined)}
                    placeholder="Leave blank for random" className={inputCls} />
                </div>
              </div>

              <Button variant="primary" size="lg" onClick={generateImage} disabled={isImgGenerating || !imgPrompt.trim()} loading={isImgGenerating} className="w-full">
                {isImgGenerating ? `Generating with ${VENICE_IMAGE_MODELS.find((m) => m.id === imgModel)?.label.split(' (')[0] || imgModel}…` : <><Sparkles className="h-4 w-4" /> Generate Image</>}
              </Button>

              {imgError && (
                <div className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/[0.05] p-4 text-sm text-red-300">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <div className="flex-1">{imgError}</div>
                  <Button size="sm" variant="danger" onClick={() => { setImgError(''); generateImage(); }}>Retry</Button>
                </div>
              )}

              {images.length > 0 && (
                <div className="pt-4 border-t border-white/[0.06]">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-fedda-text-3">Generated Images</span>
                      <span className="text-[10px] px-1.5 py-px rounded bg-white/[0.05] text-fedda-text-4 font-mono">{images.length}</span>
                    </div>
                    <button onClick={() => setImages([])} className="text-xs text-fedda-text-4 hover:text-fedda-text-2 transition">CLEAR</button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {images.map((src, i) => (
                      <div key={i} className="group relative overflow-hidden rounded-xl border border-white/[0.06] bg-black aspect-square">
                        <img src={src} alt={`Venice image ${i + 1}`} className="absolute inset-0 h-full w-full object-cover cursor-pointer transition-transform duration-300 group-hover:scale-[1.025]" onClick={() => setLightboxImage(src)} />
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/70 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <button onClick={(e) => { e.stopPropagation(); triggerMediaDownload(src, `venice-${imgModel}-${Date.now()}.png`); }}
                          className="absolute bottom-3 right-3 flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/90 text-black text-xs font-semibold hover:bg-white transition shadow-lg opacity-0 group-hover:opacity-100">
                          <Download className="h-3 w-3" /> DOWNLOAD
                        </button>
                        <div className="absolute top-2 left-2 px-1.5 py-px rounded-full bg-black/60 text-[10px] font-mono text-white/60">{i + 1}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── CHAT TAB ── */}
          {activeTab === 'chat' && (
            <div className="max-w-4xl mx-auto space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <select value={chatModel} onChange={(e) => setChatModel(e.target.value)} className="rounded-xl border border-white/10 bg-fedda-bg-2 px-3 py-1.5 text-sm text-fedda-text-1 outline-none focus:border-white/20">
                    {VENICE_CHAT_MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                  </select>
                  <p className="text-[10px] text-amber-400/70">If you hit overload (429), switch models or retry in a minute.</p>
                  <label className="flex items-center gap-1.5 text-fedda-text-3 cursor-pointer text-xs">
                    <input type="checkbox" checked={enableWebSearch} onChange={(e) => setEnableWebSearch(e.target.checked)} className="accent-fedda-accent" />
                    <Globe className="h-3.5 w-3.5" /> Web Search
                  </label>
                </div>
                <Button size="sm" variant="ghost" onClick={clearChat}><Trash2 className="h-3.5 w-3.5" /> Clear Chat</Button>
              </div>

              {/* Messages */}
              <div className="h-[420px] overflow-y-auto p-4 space-y-4 bg-fedda-bg-0 rounded-xl border border-white/[0.06]">
                {chatMessages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={cn('max-w-[82%] rounded-xl px-4 py-3 text-sm leading-relaxed', msg.role === 'user' ? 'bg-white/[0.07]' : 'bg-fedda-bg-2 border border-white/[0.06]')}>
                      {msg.images && msg.images.length > 0 && (
                        <div className="mb-2">
                          {msg.role === 'assistant' && <div className="text-[10px] text-fedda-accent mb-1 font-medium">Generated images</div>}
                          <div className="flex flex-wrap gap-2">
                            {msg.images.map((img, i) => (
                              <div key={i} className="group relative">
                                <img src={img} className="max-h-28 rounded-lg border border-white/[0.06] cursor-pointer hover:scale-[1.02] transition" alt="generated" onClick={() => setLightboxImage(img)} />
                                <button onClick={(e) => { e.stopPropagation(); triggerMediaDownload(img, `venice-${msg.role}-${i + 1}.png`); }}
                                  className="absolute bottom-1 right-1 p-1 rounded bg-black/60 text-white opacity-0 group-hover:opacity-100 hover:bg-black/80 transition">
                                  <Download className="h-3 w-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                    </div>
                  </div>
                ))}
                {isChatGenerating && (
                  <div className="flex justify-start">
                    <div className="bg-fedda-bg-2 border border-white/[0.06] rounded-xl px-4 py-2 flex items-center gap-2 text-sm text-fedda-text-3">
                      <Loader2 className="h-4 w-4 animate-spin" /> Thinking…
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              <div>
                {attachedImages.length > 0 && (
                  <div className="flex gap-2 mb-2 flex-wrap">
                    {attachedImages.map((img, i) => (
                      <div key={i} className="relative">
                        <img src={img} className="h-12 w-12 object-cover rounded-lg border border-white/[0.06]" />
                        <button onClick={() => setAttachedImages((p) => p.filter((_, j) => j !== i))} className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center">×</button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-end gap-2">
                  <button onClick={() => chatFileRef.current?.click()} title="Attach image for vision"
                    className="h-10 w-10 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] flex items-center justify-center transition">
                    <ImageIcon className="h-4 w-4 text-fedda-text-3" />
                  </button>
                  <input ref={chatFileRef} type="file" accept="image/*" className="hidden" onChange={handleImageAttach} />
                  <textarea value={chatInput} onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); } }}
                    placeholder="Ask the agent… (e.g. Generate a cyberpunk landscape and describe it)"
                    rows={1} className="flex-1 resize-y min-h-[44px] max-h-32 rounded-xl border border-white/10 bg-fedda-bg-2 px-3 py-2.5 text-sm text-fedda-text-1 outline-none focus:border-white/20" />
                  <Button variant="primary" onClick={sendChatMessage} disabled={isChatGenerating || (!chatInput.trim() && attachedImages.length === 0)} loading={isChatGenerating} className="h-10 px-5">
                    {!isChatGenerating && <Send className="h-4 w-4" />} Send
                  </Button>
                </div>
                <p className="text-[10px] text-fedda-text-4 mt-1.5 px-1">The agent supports tools including image generation. Generated images appear inline. Use the Image tab for advanced controls.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {lightboxImage && <Lightbox imageUrl={lightboxImage} onClose={() => setLightboxImage(null)} />}
    </div>
  );
}
