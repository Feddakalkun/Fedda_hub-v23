import { Txt2ImgPage } from '../shared/Txt2ImgPage';

const PRESETS = [
  { label: '1:1', w: 1024, h: 1024 },
  { label: '2:3', w: 1024, h: 1536 },
  { label: '3:2', w: 1536, h: 1024 },
  { label: '9:16', w: 896, h: 1152 },
];

export const ZImagePage = () => (
  <Txt2ImgPage
    storageKey="zimage"
    workflowId="z-image"
    familyLabel="Z-Image"
    enableLoras
    loraPrefixes={['zimage_turbo/', 'zimage-turbo/']}
    aspectPresets={PRESETS}
    defaultSteps={11}
    defaultCfg={1.0}
    defaultNegative="blurry, ugly, bad proportions, low quality, artifacts"
    maxSteps={25}
  />
);
