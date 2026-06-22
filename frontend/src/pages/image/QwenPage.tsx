import { Txt2ImgPage } from '../shared/Txt2ImgPage';

const QWEN_PRESETS = [
  { label: '1:1', w: 1328, h: 1328 },
  { label: '16:9', w: 1664, h: 928 },
  { label: '9:16', w: 928, h: 1664 },
  { label: '4:3', w: 1472, h: 1104 },
  { label: '3:4', w: 1104, h: 1472 },
  { label: '3:2', w: 1584, h: 1056 },
  { label: '2:3', w: 1056, h: 1584 },
];

const RAPID_PRESETS = [
  { label: 'Square', w: 768, h: 768 },
  { label: 'Portrait', w: 768, h: 1024 },
  { label: 'Wide', w: 1024, h: 768 },
  { label: 'Tall', w: 832, h: 1216 },
];

const RAPID_EDIT_PRESETS = [
  { group: 'Pose', label: 'Raise Arms', prompt: 'Edit the person so both arms are raised naturally above the shoulders. Preserve the same face, body, clothing style, camera angle, lighting, and background.' },
  { group: 'Pose', label: 'Hand On Hip', prompt: 'Edit the pose so one hand rests naturally on the hip. Keep identity, outfit, lighting, framing, and background consistent.' },
  { group: 'Pose', label: 'Turn Slightly', prompt: 'Edit the body pose into a subtle three-quarter turn while keeping the face recognizable and preserving the original scene.' },
  { group: 'Pose', label: 'Look At Camera', prompt: 'Edit the face and gaze so the person looks directly at the camera with natural eye contact. Preserve identity and scene details.' },
  { group: 'Wardrobe', label: 'Adjust Straps', prompt: 'Edit the shoulder straps so they sit slightly lower on the shoulders in a natural wardrobe-adjustment pose. Keep the result tasteful and preserve identity, lighting, and background.' },
  { group: 'Wardrobe', label: 'Lift Shirt Hem', prompt: 'Edit the shirt so the hem is lifted slightly as a natural fashion pose. Preserve the person, body proportions, fabric texture, lighting, and background.' },
  { group: 'Wardrobe', label: 'Pull Shirt Down', prompt: 'Edit the shirt so it is pulled down and fitted neatly. Preserve identity, pose realism, fabric texture, lighting, and background.' },
  { group: 'Wardrobe', label: 'Torn Fabric', prompt: 'Edit the clothing with subtle torn or distressed fabric details. Keep the outfit coherent, tasteful, realistic, and consistent with the original image.' },
  { group: 'Objects', label: 'Add Sunglasses', prompt: 'Add stylish sunglasses to the person. Match perspective, reflections, lighting, and face shape while preserving identity.' },
  { group: 'Objects', label: 'Add Necklace', prompt: 'Add a simple elegant necklace with realistic shadows and reflections. Preserve the original face, outfit, lighting, and background.' },
  { group: 'Objects', label: 'Hold Phone', prompt: 'Edit the pose so the person naturally holds a smartphone in one hand. Match hand anatomy, perspective, lighting, and scene style.' },
  { group: 'Objects', label: 'Hold Drink', prompt: 'Edit the pose so the person naturally holds a drink glass. Preserve hand anatomy, identity, outfit, lighting, and background.' },
  { group: 'Expression', label: 'Soft Smile', prompt: 'Edit the facial expression into a subtle soft smile. Preserve the same person, face structure, lighting, and image style.' },
  { group: 'Expression', label: 'Confident', prompt: 'Edit the expression and posture to look confident and composed. Keep identity, outfit, lighting, and background unchanged.' },
  { group: 'Expression', label: 'Surprised', prompt: 'Edit the facial expression to look naturally surprised. Preserve identity, face structure, lighting, and scene consistency.' },
  { group: 'Expression', label: 'Editorial', prompt: 'Edit the person into a polished editorial fashion pose with refined posture and natural expression. Preserve identity, outfit logic, lighting, and background.' },
];

export const QwenTxt2ImgPage = () => (
  <Txt2ImgPage
    storageKey="qwen_txt2img"
    workflowId="qwen-edit-2512"
    familyLabel="Qwen"
    enableLoras
    loraPrefixes={['qwen/']}
    aspectPresets={QWEN_PRESETS}
    allowedResolutions={QWEN_PRESETS}
    defaultSteps={4}
    defaultCfg={1}
    defaultNegative="blurry, low quality, distorted anatomy, malformed hands, artifacts, oversharpened, waxy skin"
    maxSteps={12}
    showCfgControl
    minCfg={0.8}
    maxCfg={1.5}
  />
);

export const QwenImageRefPage = () => (
  <Txt2ImgPage
    storageKey="qwen_image_ref"
    workflowId="qwen-edit-2509-image-reference"
    familyLabel="Qwen Image Reference"
    enableLoras
    loraPrefixes={['qwen/']}
    aspectPresets={QWEN_PRESETS}
    allowedResolutions={QWEN_PRESETS}
    requireImageUpload
    imageParamKey="image"
    imageLabel="Reference Image"
    defaultSteps={4}
    defaultCfg={1}
    maxSteps={12}
    showCfgControl
    minCfg={0.8}
    maxCfg={1.5}
  />
);

export const QwenRapidEditPage = () => (
  <Txt2ImgPage
    storageKey="qwen_rapid_edit_v23"
    workflowId="qwen-rapid-edit-v23"
    familyLabel="Qwen Rapid Edit"
    aspectPresets={RAPID_PRESETS}
    requireImageUpload
    imageParamKey="image"
    imageLabel="Source Image"
    promptPresets={RAPID_EDIT_PRESETS}
    defaultSteps={8}
    defaultCfg={1}
    defaultNegative=""
    maxSteps={16}
    showCfgControl
    minCfg={0.5}
    maxCfg={2}
  />
);
