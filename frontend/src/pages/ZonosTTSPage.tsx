import { useState } from 'react';
import { Volume2, Upload, Play, Download } from 'lucide-react';
import { useToast } from '../components/ui/Toast';
import { Button } from '../components/ui/Button';
import { triggerMediaDownload, saveAudioToGallery } from '../utils/mediaStore';

const inputCls = 'w-full rounded-xl border border-white/10 bg-fedda-bg-2 px-3 py-2 text-sm text-fedda-text-1 outline-none focus:border-white/20';
const labelCls = 'block text-[10px] font-semibold uppercase tracking-[0.16em] text-fedda-text-4 mb-1.5';

export const ZonosTTSPage = () => {
  const { toast } = useToast();
  const [text, setText] = useState('Hello, this is Zonos 2 speaking with natural expressiveness.');
  const [voiceName, setVoiceName] = useState('');
  const [useClone, setUseClone] = useState(false);
  const [referenceAudio, setReferenceAudio] = useState('');
  const [referenceText, setReferenceText] = useState('');
  const [speakingRate, setSpeakingRate] = useState(1.0);
  const [pitch, setPitch] = useState(0.0);
  const [emotion, setEmotion] = useState('');
  const [temperature, setTemperature] = useState(0.7);
  const [topP, setTopP] = useState(0.9);
  const [cfgScale, setCfgScale] = useState(1.0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState('');
  const [audioBase64, setAudioBase64] = useState('');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('audio/')) { toast('Please upload an audio file', 'error'); return; }
    setReferenceAudio(file.name);
    toast('Reference audio selected. Make sure it is in the ComfyUI input folder.', 'info');
  };

  const generate = async () => {
    if (!text.trim()) { toast('Text is required', 'error'); return; }
    setIsGenerating(true);
    setAudioUrl('');
    setAudioBase64('');
    try {
      const res = await fetch('/api/chat/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.trim(), voice_name: voiceName, tts_engine: 'zonos',
          use_voice_clone: useClone, reference_audio: referenceAudio, reference_text: referenceText,
          speaking_rate: speakingRate, pitch, emotion, temperature, top_p: topP, cfg_scale: cfgScale,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'TTS generation failed');
      if (data.audio_url) {
        setAudioUrl(data.audio_url);
        saveAudioToGallery(data.audio_url, 'zonos');
        toast('Zonos 2 audio generated!', 'success');
      } else if (data.audio_base64) {
        const mime = data.mime_type || 'audio/wav';
        const full = `data:${mime};base64,${data.audio_base64}`;
        setAudioBase64(full);
        saveAudioToGallery(full, 'zonos');
        toast('Zonos 2 audio generated!', 'success');
      } else {
        throw new Error('No audio returned from Zonos');
      }
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Failed to generate. Ensure Zonos 2 is running.', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const audioSrc = audioUrl || audioBase64;

  return (
    <div className="h-full overflow-y-auto bg-fedda-bg-0 px-6 py-6">
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="flex items-center gap-3 pb-4 border-b border-white/[0.06]">
          <div className="h-9 w-9 rounded-xl bg-fedda-accent/10 border border-fedda-accent/20 flex items-center justify-center">
            <Volume2 className="h-4.5 w-4.5 text-fedda-accent" />
          </div>
          <div>
            <div className="font-semibold text-fedda-text-1">Zonos 2 TTS</div>
            <div className="text-[10px] text-fedda-text-4">High-fidelity voice cloning &amp; expressive speech (via WSL)</div>
          </div>
        </div>

        {/* Text */}
        <div>
          <label className={labelCls}>Text</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full min-h-[120px] rounded-xl border border-white/10 bg-fedda-bg-2 px-3 py-3 text-sm text-fedda-text-1 outline-none focus:border-white/20 resize-y"
            placeholder="Enter the text you want Zonos 2 to speak…"
          />
        </div>

        {/* Voice + Clone toggle */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Voice / Speaker</label>
            <input type="text" value={voiceName} onChange={(e) => setVoiceName(e.target.value)}
              placeholder="Voice name or leave for default" className={inputCls} />
          </div>
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2 text-sm text-fedda-text-2 cursor-pointer select-none">
              <input type="checkbox" checked={useClone} onChange={(e) => setUseClone(e.target.checked)}
                className="accent-fedda-accent" />
              Use voice cloning
            </label>
          </div>
        </div>

        {/* Clone settings */}
        {useClone && (
          <div className="space-y-3 rounded-xl border border-white/[0.06] bg-fedda-bg-1 p-4">
            <div>
              <label className={labelCls}>Reference Audio (for cloning)</label>
              <div className="flex gap-2">
                <input type="text" value={referenceAudio} onChange={(e) => setReferenceAudio(e.target.value)}
                  placeholder="reference.wav (in ComfyUI input folder)" className={inputCls} />
                <label className="cursor-pointer flex items-center gap-1.5 px-3 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] text-xs text-fedda-text-2 transition shrink-0">
                  <Upload className="h-3.5 w-3.5" /> Upload
                  <input type="file" accept="audio/*" className="hidden" onChange={handleFileUpload} />
                </label>
              </div>
            </div>
            <div>
              <label className={labelCls}>Reference Text (optional)</label>
              <input type="text" value={referenceText} onChange={(e) => setReferenceText(e.target.value)}
                placeholder="What the reference audio says…" className={inputCls} />
            </div>
          </div>
        )}

        {/* Sliders row 1 */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Speaking Rate', val: speakingRate, set: setSpeakingRate, min: 0.5, max: 2, step: 0.1, fmt: (v: number) => `${v.toFixed(1)}×` },
            { label: 'Pitch', val: pitch, set: setPitch, min: -0.5, max: 0.5, step: 0.05, fmt: (v: number) => v.toFixed(2) },
          ].map(({ label, val, set, min, max, step, fmt }) => (
            <div key={label}>
              <label className={labelCls}>{label}</label>
              <input type="range" min={min} max={max} step={step} value={val}
                onChange={(e) => set(parseFloat(e.target.value))} className="w-full accent-fedda-accent" />
              <div className="text-xs text-fedda-text-4 text-center mt-0.5">{fmt(val)}</div>
            </div>
          ))}
          <div>
            <label className={labelCls}>Emotion / Style</label>
            <input type="text" value={emotion} onChange={(e) => setEmotion(e.target.value)}
              placeholder="happy, calm, excited…" className={inputCls} />
          </div>
        </div>

        {/* Sliders row 2 */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Temperature', val: temperature, set: setTemperature, min: 0.1, max: 1.5, step: 0.1 },
            { label: 'Top P', val: topP, set: setTopP, min: 0.1, max: 1.0, step: 0.05 },
            { label: 'CFG Scale', val: cfgScale, set: setCfgScale, min: 0.5, max: 2.0, step: 0.1 },
          ].map(({ label, val, set, min, max, step }) => (
            <div key={label}>
              <label className={labelCls}>{label}</label>
              <input type="range" min={min} max={max} step={step} value={val}
                onChange={(e) => set(parseFloat(e.target.value))} className="w-full accent-fedda-accent" />
              <div className="text-xs text-fedda-text-4 text-center mt-0.5">{val.toFixed(2)}</div>
            </div>
          ))}
        </div>

        <Button variant="primary" size="lg" onClick={generate} disabled={isGenerating || !text.trim()} loading={isGenerating} className="w-full">
          {isGenerating ? 'Generating with Zonos 2…' : <><Volume2 className="h-4 w-4" /> Generate Speech</>}
        </Button>

        {audioSrc && (
          <div className="rounded-xl border border-white/[0.06] bg-fedda-bg-1 p-4 space-y-3">
            <div className="text-sm text-fedda-text-2 font-medium">Generated Audio</div>
            <audio controls src={audioSrc} className="w-full" />
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => { const a = new Audio(audioSrc); a.play().catch(() => toast('Could not play', 'error')); }} className="flex-1">
                <Play className="h-4 w-4" /> Play
              </Button>
              <Button variant="secondary" onClick={() => triggerMediaDownload(audioSrc, 'zonos2_output.wav')} className="flex-1">
                <Download className="h-4 w-4" /> Download
              </Button>
            </div>
          </div>
        )}

        <p className="text-[10px] text-fedda-text-4">
          Requires Zonos 2 installed via the WSL tool. Set ZONOS_URL env var (default http://localhost:7860) if the server runs on a different port.
        </p>
      </div>
    </div>
  );
};
