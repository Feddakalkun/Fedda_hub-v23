import { Txt2ImgPage } from '../shared/Txt2ImgPage';

const PRESETS = [
  { label: 'Original', w: 1024, h: 1024 },
  { label: 'Portrait', w: 896, h: 1344 },
  { label: 'Wide', w: 1344, h: 896 },
];

export const FireRedPage = () => (
  <Txt2ImgPage
    storageKey="firered_image_edit"
    workflowId="firered-image-edit"
    familyLabel="FireRed Edit"
    aspectPresets={PRESETS}
    requireImageUpload
    imageParamKey="image"
    imageLabel="Source Image"
    defaultSteps={8}
    defaultCfg={1}
    defaultNegative=""
    maxSteps={20}
    showCfgControl
    minCfg={0.5}
    maxCfg={2}
  />
);
