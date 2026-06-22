import { useState, useRef, useEffect } from 'react';
import { Sparkles, Download, ImageIcon, Loader2, AlertCircle, Send, Trash2, Globe, Settings, KeyRound } from 'lucide-react';
import { useToast } from '../components/ui/Toast';
import { Button } from '../components/ui/Button';
import { Lightbox } from '../components/ui/Lightbox';
import { triggerMediaDownload, saveAudioToGallery } from '../utils/mediaStore';
import { cn } from '../lib/styles';

const GROK_CHAT_MODELS = [
  { id: 'grok-3', label: 'Grok 3' },
  { id: 'grok-3-mini', label: 'Grok 3 Mini' },
  { id: 'grok-4', label: 'Grok 4 (if available)' },
  { id: 'grok-beta', label: 'Grok Beta' },
];

const GROK_IMAGE_MODELS = [
  { id: 'grok-imagine-image', label: 'Grok Imagine' },
  { id: 'grok-imagine-image-quality', label: 'Grok Imagine (High Quality)' },
];

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  images?: string[];
  audio?: string;
}

const saveToGlobalGallery = (urls: string[], source = 'grok') => {
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

export function GrokPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'chat' | 'image'>('chat');
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const [grokApiKey, setGrokApiKey] = useState(() => localStorage.getItem('grok_api_key') || '');
  const saveGrokKey = (key: string) => {
    setGrokApiKey(key);
    if (key) localStorage.setItem('grok_api_key', key);
    else localStorage.removeItem('grok_api_key');
  };
  const getGrokApiKey = () => {
    let key = (grokApiKey || localStorage.getItem('grok_api_key') || '').trim();
    if (key.toLowerCase().startsWith('bearer ')) key = key.slice(7).trim();
    return key;
  };

  // ── Chat ──────────────────────────────────────────────────────────────
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: "Hello! I'm Grok. Ask me anything, or request images and I'll generate them using Grok Imagine tools." },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatModel, setChatModel] = useState('grok-3');
  const [enableWebSearch, setEnableWebSearch] = useState(true);
  const [isChatGenerating, setIsChatGenerating] = useState(false);
  const [attachedImages, setAttachedImages] = useState<string[]>([]);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  const handleImageAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast('Please select an image file', 'error'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => setAttachedImages((prev) => [...prev, ev.target?.result as string]);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const clearChat = () => { setChatMessages([{ role: 'assistant', content: 'Chat cleared. What can I help with today?' }]); setAttachedImages([]); };

  const sendChatMessage = async () => {
    const apiKey = getGrokApiKey();
    if (!apiKey) { toast('Enter your xAI API key above (from console.x.ai)', 'error'); return; }
    if (!chatInput.trim() && attachedImages.length === 0) return;

    const userMessage: ChatMessage = { role: 'user', content: chatInput.trim(), images: attachedImages.length > 0 ? [...attachedImages] : undefined };
    const newMessages = [...chatMessages, userMessage];
    setChatMessages(newMessages);
    setChatInput('');
    setAttachedImages([]);
    setIsChatGenerating(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const apiMessages = newMessages.map((msg) => {
      if (msg.images?.length) return { role: msg.role, content: [{ type: 'text', text: msg.content }, ...msg.images.map((img) => ({ type: 'image_url', image_url: { url: img } }))] };
      return { role: msg.role, content: msg.content };
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tools: any[] = [];
    if (enableWebSearch) {
      tools.push({ type: 'function', function: { name: 'web_search', description: 'Search the web for up-to-date information.', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } } });
    }
    tools.push({ type: 'function', function: { name: 'generate_tts', description: 'Generate speech audio from text using Zonos TTS.', parameters: { type: 'object', properties: { text: { type: 'string' }, voice_name: { type: 'string' }, use_voice_clone: { type: 'boolean' }, reference_audio: { type: 'string' }, speaking_rate: { type: 'number' } }, required: ['text'] } } });

    try {
      const res = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: chatModel, messages: apiMessages, stream: true, temperature: 0.7, ...(tools.length > 0 && { tools }) }),
      });
      if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);

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
              }
            } catch {}
          }
        }
      }

      if (toolCallAcc?.name === 'generate_tts') {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const args: any = JSON.parse(toolCallAcc.arguments || '{}');
          const ttsRes = await fetch('/api/chat/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: args.text || assistantContent || chatInput, voice_name: args.voice_name || 'Kore', tts_engine: 'zonos', use_voice_clone: args.use_voice_clone || false, reference_audio: args.reference_audio || '', speaking_rate: args.speaking_rate || 1.0 }) });
          const ttsData = await ttsRes.json();
          if (ttsData.success) {
            const audio = ttsData.audio_url || (ttsData.audio_base64 ? `data:${ttsData.mime_type || 'audio/wav'};base64,${ttsData.audio_base64}` : '');
            setChatMessages((prev) => { const u = [...prev]; u[assistantIdx] = { role: 'assistant', content: assistantContent || `Speaking: ${args.text?.substring(0, 100)}…`, audio }; return u; });
            if (audio) { new Audio(audio).play().catch(() => {}); saveAudioToGallery(audio, 'zonos'); }
          }
        } catch (toolErr) { console.error('generate_tts tool error', toolErr); }
      }
    } catch (e: unknown) {
      const raw = e instanceof Error ? e.message : 'Failed to get response from Grok.';
      let friendly = raw;
      if (raw.includes('429') || raw.toLowerCase().includes('overloaded')) friendly = 'Grok is currently overloaded. Try again later or use a different model.';
      else if (raw.includes('403') || raw.includes('permission-denied') || raw.includes('credits')) friendly = 'Your xAI team has no credits or licenses yet. Please purchase/add credits at console.x.ai';
      toast(friendly, 'error');
      setChatMessages((prev) => prev.slice(0, -1));
    } finally { setIsChatGenerating(false); }
  };

  // ── Image Generation ──────────────────────────────────────────────────
  const [imgModel, setImgModel] = useState('grok-imagine-image');
  const [imgPrompt, setImgPrompt] = useState('a beautiful landscape, highly detailed, cinematic');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [width, setWidth] = useState(1024);
  const [height, setHeight] = useState(1024);
  const [isImgGenerating, setIsImgGenerating] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [imgError, setImgError] = useState('');

  const generateImage = async () => {
    const apiKey = getGrokApiKey();
    if (!apiKey) { toast('Enter your Grok API key above', 'error'); return; }
    if (!imgPrompt.trim()) { toast('Prompt is required', 'error'); return; }
    setIsImgGenerating(true); setImgError(''); setImages([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body: any = { model: imgModel, prompt: imgPrompt.trim(), width, height };
    if (negativePrompt.trim()) body.negative_prompt = negativePrompt.trim();
    try {
      const res = await fetch('https://api.x.ai/v1/images/generations', {
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
      saveToGlobalGallery(newImgs, 'grok-image');
      toast('Generated with Grok!', 'success');
    } catch (e: unknown) {
      const raw = e instanceof Error ? e.message : 'Failed to generate.';
      let friendly = raw;
      if (raw.includes('429') || raw.toLowerCase().includes('overloaded')) friendly = 'Grok is overloaded. Try again later or use a different model.';
      else if (raw.includes('403') || raw.includes('credits')) friendly = 'Your xAI team has no credits or licenses yet. Please purchase/add credits at console.x.ai';
      setImgError(friendly);
      toast(friendly, 'error');
    } finally { setIsImgGenerating(false); }
  };

  return (
    <div className="h-full overflow-y-auto bg-fedda-bg-0 px-6 py-6">
      <div className="mx-auto max-w-4xl rounded-xl border border-white/[0.06] bg-fedda-bg-1 overflow-hidden">
        {/* Header */}
        <div className="border-b border-white/[0.06] px-6 pt-5 pb-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-blue-300" />
              </div>
              <div>
                <div className="font-semibold text-fedda-text-1">Grok</div>
                <div className="text-[10px] text-fedda-text-4 tracking-[0.5px]">xAI · Chat + Imagine</div>
              </div>
            </div>
            <div className="text-[10px] px-3 py-1 rounded-full border border-white/10 bg-white/[0.04] text-fedda-text-4 font-mono tracking-widest">Supergrok ready</div>
          </div>

          {/* API Key */}
          <div className="mb-4 rounded-xl border border-white/[0.06] bg-fedda-bg-2 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-fedda-text-4" />
              <div className="text-[10px] text-fedda-text-4">Grok Token (paste full "Bearer ..." from grok.com)</div>
            </div>
            <input type="password" value={grokApiKey} onChange={(e) => saveGrokKey(e.target.value)}
              placeholder="Bearer eyJ…" className={inputCls + ' font-mono'} />
            <div className="text-[10px] text-amber-400/70 leading-5">
              <strong>To use SuperGrok Heavy free credits:</strong> Log into grok.com → F12 → Network tab → filter "api.x.ai" → send a message → click a session request → Headers tab → find "authorization: Bearer eyJ…" → copy the ENTIRE value → paste above.
            </div>
            <div className="text-[10px] text-red-400/80 font-medium">Note: This is different from buying credits on console.x.ai. The token from grok.com uses your subscription usage.</div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-white/[0.06] -mx-1">
            <button onClick={() => setActiveTab('chat')} className={tabBtnCls(activeTab === 'chat')}><Settings className="h-4 w-4" /> Chat</button>
            <button onClick={() => setActiveTab('image')} className={tabBtnCls(activeTab === 'image')}><ImageIcon className="h-4 w-4" /> Image Generation</button>
          </div>
        </div>

        <div className="p-6">
          {/* ── CHAT TAB ── */}
          {activeTab === 'chat' && (
            <div className="max-w-4xl mx-auto space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <select value={chatModel} onChange={(e) => setChatModel(e.target.value)} className="rounded-xl border border-white/10 bg-fedda-bg-2 px-3 py-1.5 text-sm text-fedda-text-1 outline-none focus:border-white/20">
                    {GROK_CHAT_MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                  </select>
                  <label className="flex items-center gap-1.5 text-fedda-text-3 cursor-pointer text-xs">
                    <input type="checkbox" checked={enableWebSearch} onChange={(e) => setEnableWebSearch(e.target.checked)} className="accent-fedda-accent" />
                    <Globe className="h-3.5 w-3.5" /> Web Search
                  </label>
                </div>
                <Button size="sm" variant="ghost" onClick={clearChat}><Trash2 className="h-3.5 w-3.5" /> Clear</Button>
              </div>

              <div className="h-[420px] overflow-y-auto p-4 space-y-4 bg-fedda-bg-0 rounded-xl border border-white/[0.06]">
                {chatMessages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={cn('max-w-[82%] rounded-xl px-4 py-3 text-sm leading-relaxed', msg.role === 'user' ? 'bg-white/[0.07]' : 'bg-fedda-bg-2 border border-white/[0.06]')}>
                      {msg.images && msg.images.length > 0 && (
                        <div className="mb-2">
                          <div className="text-[10px] text-blue-400/80 mb-1 font-medium">Generated images</div>
                          <div className="flex flex-wrap gap-2">
                            {msg.images.map((img, i) => (
                              <div key={i} className="group relative">
                                <img src={img} className="max-h-28 rounded-lg border border-white/[0.06] cursor-pointer hover:scale-[1.02] transition" alt="grok generated" onClick={() => setLightboxImage(img)} />
                                <button onClick={(e) => { e.stopPropagation(); triggerMediaDownload(img, `grok-${msg.role}-${i + 1}.png`); }}
                                  className="absolute bottom-1 right-1 p-1 rounded bg-black/60 text-white opacity-0 group-hover:opacity-100 hover:bg-black/80 transition">
                                  <Download className="h-3 w-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                      {msg.audio && <audio controls src={msg.audio} className="w-full max-w-[300px] mt-2" />}
                    </div>
                  </div>
                ))}
                {isChatGenerating && (
                  <div className="flex justify-start">
                    <div className="bg-fedda-bg-2 border border-white/[0.06] rounded-xl px-4 py-2 flex items-center gap-2 text-sm text-fedda-text-3">
                      <Loader2 className="h-4 w-4 animate-spin" /> Thinking with Grok…
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

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
                  <button onClick={() => chatFileRef.current?.click()} title="Attach image"
                    className="h-10 w-10 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] flex items-center justify-center transition">
                    <ImageIcon className="h-4 w-4 text-fedda-text-3" />
                  </button>
                  <input ref={chatFileRef} type="file" accept="image/*" className="hidden" onChange={handleImageAttach} />
                  <textarea value={chatInput} onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); } }}
                    placeholder="Ask Grok anything… (try 'generate an image of … at sunset')"
                    rows={1} className="flex-1 resize-y min-h-[44px] max-h-32 rounded-xl border border-white/10 bg-fedda-bg-2 px-3 py-2.5 text-sm text-fedda-text-1 outline-none focus:border-white/20" />
                  <Button variant="primary" onClick={sendChatMessage} disabled={isChatGenerating || (!chatInput.trim() && attachedImages.length === 0) || !grokApiKey} loading={isChatGenerating} className="h-10 px-5">
                    {!isChatGenerating && <Send className="h-4 w-4" />} Send
                  </Button>
                </div>
                <p className="text-[10px] text-fedda-text-4 mt-1.5 px-1">Uses your Grok API key. Supports image gen requests via tools if available in your subscription tier.</p>
              </div>
            </div>
          )}

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
                    {GROK_IMAGE_MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                  </select>
                  <p className="text-[10px] text-amber-400/70 mt-1">Grok Imagine via xAI. Higher limits with SuperGrok.</p>
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-fedda-text-4 mb-1.5 block">Negative Prompt</label>
                  <input type="text" value={negativePrompt} onChange={(e) => setNegativePrompt(e.target.value)}
                    placeholder="blurry, low quality, deformed" className={inputCls} />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-fedda-text-4 mb-1.5 block">Dimensions</label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><div className="text-[10px] text-fedda-text-4">Width</div><input type="number" value={width} onChange={(e) => setWidth(+e.target.value)} className={inputCls} /></div>
                  <div className="space-y-1"><div className="text-[10px] text-fedda-text-4">Height</div><input type="number" value={height} onChange={(e) => setHeight(+e.target.value)} className={inputCls} /></div>
                </div>
              </div>

              <Button variant="primary" size="lg" onClick={generateImage} disabled={isImgGenerating || !imgPrompt.trim() || !grokApiKey} loading={isImgGenerating} className="w-full">
                {isImgGenerating ? 'Generating with Grok Imagine…' : <><Sparkles className="h-4 w-4" /> Generate Image with Grok</>}
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
                        <img src={src} alt={`Grok image ${i + 1}`} className="absolute inset-0 h-full w-full object-cover cursor-pointer transition-transform duration-300 group-hover:scale-[1.025]" onClick={() => setLightboxImage(src)} />
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/70 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <button onClick={(e) => { e.stopPropagation(); triggerMediaDownload(src, `grok-${imgModel}-${Date.now()}.png`); }}
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
        </div>
      </div>

      {lightboxImage && <Lightbox imageUrl={lightboxImage} onClose={() => setLightboxImage(null)} />}
    </div>
  );
}
