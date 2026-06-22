import { Txt2ImgPage } from '../shared/Txt2ImgPage';

const PRESETS = [
  { label: 'Square', w: 1152, h: 1152 },
  { label: 'Portrait', w: 896, h: 1344 },
  { label: 'Wide', w: 1344, h: 896 },
  { label: 'Tall', w: 832, h: 1488 },
];

const NEG =
  'low quality, ugly, unfinished, out of focus, blurry, smudged, body horror, mutated creature, extra animal, fish, monster, malformed arms, deformed hands, fused anatomy, melted body, muddy skin artifacts, extra limbs, bad anatomy, duplicate face';

export const ChromaHdPage = () => (
  <Txt2ImgPage
    storageKey="chroma_txt2img"
    workflowId="chroma1-hd-txt2img"
    familyLabel="Chroma1-HD"
    aspectPresets={PRESETS}
    defaultSteps={40}
    defaultCfg={1.7}
    defaultNegative={`${NEG}, restricted palette, flat colors`}
    maxSteps={60}
    showCfgControl
    minCfg={1.0}
    maxCfg={3.0}
  />
);

export const ChromaSimplePage = () => (
  <Txt2ImgPage
    storageKey="chroma_simple_txt2img"
    workflowId="chroma-simple-txt2img"
    familyLabel="Chroma Simple"
    aspectPresets={PRESETS}
    defaultSteps={32}
    defaultCfg={1.25}
    defaultNegative={NEG}
    maxSteps={55}
    showCfgControl
    minCfg={1.0}
    maxCfg={2.5}
  />
);
