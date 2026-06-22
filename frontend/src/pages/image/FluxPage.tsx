import { Txt2ImgPage } from '../shared/Txt2ImgPage';

const PRESETS = [
  { label: '1:1', w: 1024, h: 1024 },
  { label: '2:3', w: 1024, h: 1536 },
  { label: '3:2', w: 1536, h: 1024 },
  { label: '9:16', w: 896, h: 1152 },
];

export const FluxKleinPage = () => (
  <Txt2ImgPage
    storageKey="flux_txt2img"
    workflowId="flux2klein-txt2img"
    familyLabel="FLUX2-KLEIN"
    enableLoras
    loraPrefixes={['flux2klein/']}
    aspectPresets={PRESETS}
    defaultSteps={8}
    defaultCfg={1}
    maxSteps={20}
    showCfgControl
    minCfg={0.8}
    maxCfg={2}
    characterPromptLabel="Character / Trigger"
    characterPromptPlaceholder="LoRA identity phrase, trigger words, hair, face, body, outfit"
  />
);

export const FluxKleinUncensoredPage = () => (
  <Txt2ImgPage
    storageKey="flux_uncensored_txt2img"
    workflowId="flux2klein-uncensored-txt2img"
    familyLabel="FLUX KLEIN UNCENSORED"
    enableLoras
    loraPrefixes={['flux2klein/']}
    aspectPresets={PRESETS}
    defaultSteps={8}
    defaultCfg={1}
    maxSteps={20}
    showCfgControl
    minCfg={0.8}
    maxCfg={2}
    characterPromptLabel="Character / Trigger"
    characterPromptPlaceholder="LoRA identity phrase, trigger words, hair, face, body, outfit"
  />
);
