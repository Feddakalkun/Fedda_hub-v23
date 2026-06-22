import { Txt2ImgPage } from '../shared/Txt2ImgPage';

const OUTPAINT_PRESETS = [
  { label: 'Original', w: 1024, h: 1024 },
  { label: 'Landscape', w: 1536, h: 1024 },
  { label: 'Portrait', w: 1024, h: 1536 },
  { label: 'Wide', w: 1792, h: 1024 },
];

const INPAINT_PRESETS = [
  { label: 'Match', w: 1024, h: 1024 },
  { label: 'Portrait', w: 896, h: 1344 },
  { label: 'Wide', w: 1344, h: 896 },
  { label: 'Square', w: 1024, h: 1024 },
];

const DEPTH_PRESETS = [
  { label: '1:1', w: 1024, h: 1024 },
  { label: '2:3', w: 1024, h: 1536 },
  { label: '3:2', w: 1536, h: 1024 },
  { label: '9:16', w: 896, h: 1152 },
];

export const SDXLOutpaintPage = () => (
  <Txt2ImgPage
    storageKey="sdxl_outpaint"
    workflowId="sdxl-outpaint"
    familyLabel="SDXL OUTPAINT"
    enableLoras
    loraPrefixes={['sdxl/']}
    aspectPresets={OUTPAINT_PRESETS}
    requireImageUpload
    imageParamKey="image"
    imageLabel="Source Image"
    defaultSteps={20}
    defaultCfg={7}
    defaultNegative=""
    maxSteps={50}
    showCfgControl
    minCfg={1}
    maxCfg={15}
    characterPromptLabel="Outpaint Prompt"
    characterPromptPlaceholder="Describe what to extend the image with (e.g. continue the scene, add background)"
  />
);

export const SDXLInpaintPage = () => (
  <Txt2ImgPage
    storageKey="sdxl_inpaint_automask"
    workflowId="sdxl-inpaint-automask"
    familyLabel="SDXL INPAINT AUTOMASK"
    enableLoras
    loraPrefixes={['sdxl/']}
    aspectPresets={INPAINT_PRESETS}
    requireImageUpload
    imageParamKey="image"
    imageLabel="Source Image"
    defaultSteps={20}
    defaultCfg={7}
    defaultNegative=""
    maxSteps={50}
    showCfgControl
    minCfg={1}
    maxCfg={15}
    showMaskSettings
  />
);

export const SDXLControlNetDepthPage = () => (
  <Txt2ImgPage
    storageKey="sdxl_controlnet_depth"
    workflowId="sdxl-controlnet-depth"
    familyLabel="SDXL ControlNet Depth"
    enableLoras
    loraPrefixes={['sdxl/']}
    aspectPresets={DEPTH_PRESETS}
    requireImageUpload
    imageParamKey="image"
    imageLabel="Depth Reference"
    defaultSteps={20}
    defaultCfg={7}
    defaultNegative="blurry, ugly, low quality, artifacts"
    maxSteps={50}
    showCfgControl
    minCfg={1}
    maxCfg={15}
  />
);

export const SDXLControlNetOpenPosePage = () => (
  <Txt2ImgPage
    storageKey="sdxl_controlnet_openpose"
    workflowId="sdxl-controlnet-openpose"
    familyLabel="SDXL ControlNet OpenPose"
    enableLoras
    loraPrefixes={['sdxl/']}
    aspectPresets={DEPTH_PRESETS}
    requireImageUpload
    imageParamKey="image"
    imageLabel="Pose Reference"
    defaultSteps={20}
    defaultCfg={7}
    defaultNegative="blurry, ugly, low quality, artifacts"
    maxSteps={50}
    showCfgControl
    minCfg={1}
    maxCfg={15}
  />
);
