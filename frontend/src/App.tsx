import React, { useEffect, useState } from 'react';
import { Sparkles, Video } from 'lucide-react';
import { AppHeader } from './components/layout/AppHeader';
import { HomeView } from './components/layout/HomeView';
import { SectionView } from './components/layout/SectionView';
import { ToastProvider } from './components/ui/Toast';
import { ComfyExecutionProvider } from './contexts/ComfyExecutionContext';
import { ModuleProvider, useModules } from './contexts/ModuleContext';
import { PlaceholderPage } from './pages/PlaceholderPage';
import { IdeogramPage } from './pages/image/IdeogramPage';
import { ZImagePage } from './pages/image/ZImagePage';
import { ChromaHdPage, ChromaSimplePage } from './pages/image/ChromaPage';
import { FluxKleinPage, FluxKleinUncensoredPage } from './pages/image/FluxPage';
import { QwenTxt2ImgPage, QwenImageRefPage, QwenRapidEditPage } from './pages/image/QwenPage';
import { FireRedPage } from './pages/image/FireRedPage';
import { SDXLOutpaintPage, SDXLInpaintPage, SDXLControlNetDepthPage, SDXLControlNetOpenPosePage } from './pages/image/SDXLPage';
import { LtxImg2VidPage, LtxFlfPage } from './pages/video/LtxPage';
import { WAN22Img2VidPage, WAN22Vid2VidPage, WAN22StoryPage } from './pages/video/WAN22Page';
import { SteadyDancerPage, Scail2Page } from './pages/video/WAN21Page';
import { VenicePage } from './pages/VenicePage';
import { GrokPage } from './pages/GrokPage';
import { GalleryPage } from './pages/GalleryPage';
import { OllamaModelsPage } from './pages/OllamaModelsPage';
import { ZonosTTSPage } from './pages/ZonosTTSPage';
import { LibraryPage } from './pages/LibraryPage';
import { UIAgentPage } from './pages/UIAgentPage';
import {
  ACTIVE_TAB_STORAGE_KEY,
  APP_VERSION_LABEL,
  FEDDA_MODULES,
} from './modules/registry';
import { findModuleForTab } from './modules/moduleSelectors';

type ViewMode = 'home' | 'image-section' | 'video-section' | 'workspace';

type AppLocation = {
  view: ViewMode;
  activeTab: string;
};

function FeddaApp() {
  const {
    loading,
    availableModules,
    validTabs,
    pageMeta,
    defaultTab,
    isTabAvailable,
  } = useModules();

  const resolveTab = (tab: string | null | undefined): string =>
    tab && validTabs.has(tab) ? tab : defaultTab;

  const readActiveTab = (): string => {
    try {
      return resolveTab(localStorage.getItem(ACTIVE_TAB_STORAGE_KEY));
    } catch {
      return defaultTab;
    }
  };

  const readLocationFromHash = (): AppLocation => {
    const fallbackTab = readActiveTab();
    if (typeof window === 'undefined') return { view: 'home', activeTab: fallbackTab };

    const hash = window.location.hash.replace(/^#\/?/, '').trim();
    if (!hash || hash === 'home') return { view: 'home', activeTab: fallbackTab };
    if (hash === 'image') return { view: 'image-section', activeTab: fallbackTab };
    if (hash === 'video') return { view: 'video-section', activeTab: fallbackTab };
    if (hash.startsWith('tab/')) return { view: 'workspace', activeTab: decodeURIComponent(hash.slice(4)) };
    return { view: 'workspace', activeTab: hash };
  };

  const initialLocation = readLocationFromHash();
  const [view, setView] = useState<ViewMode>(initialLocation.view);
  const [activeTab, setActiveTab] = useState(initialLocation.activeTab);

  useEffect(() => {
    if (loading) return;
    setActiveTab((current) => resolveTab(current));
  }, [loading, defaultTab, validTabs]);

  useEffect(() => {
    try {
      localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, resolveTab(activeTab));
    } catch {}
  }, [activeTab, defaultTab, validTabs]);

  const encodeLocation = (loc: AppLocation): string => {
    if (loc.view === 'home') return '#/home';
    if (loc.view === 'image-section') return '#/image';
    if (loc.view === 'video-section') return '#/video';
    return `#/tab/${encodeURIComponent(resolveTab(loc.activeTab))}`;
  };

  useEffect(() => {
    const syncFromHash = () => {
      const next = readLocationFromHash();
      setView(next.view);
      setActiveTab(next.activeTab);
    };

    if (typeof window !== 'undefined' && !window.location.hash) {
      window.history.replaceState({ fedda: true }, '', encodeLocation({ view, activeTab }));
    }

    window.addEventListener('popstate', syncFromHash);
    window.addEventListener('hashchange', syncFromHash);
    return () => {
      window.removeEventListener('popstate', syncFromHash);
      window.removeEventListener('hashchange', syncFromHash);
    };
  }, [view, activeTab, defaultTab, validTabs]);

  const parentViewForTab = (tab: string): ViewMode => {
    const module = findModuleForTab(tab, availableModules);
    if (module?.area === 'image') return 'image-section';
    if (module?.area === 'video') return 'video-section';
    return 'home';
  };

  const navigate = (location: AppLocation, mode: 'push' | 'replace' = 'push') => {
    const next = { ...location, activeTab: resolveTab(location.activeTab) };
    setActiveTab(next.activeTab);
    setView(next.view);

    if (typeof window === 'undefined') return;
    const hash = encodeLocation(next);
    if (window.location.hash === hash) return;
    if (mode === 'replace') window.history.replaceState({ fedda: true }, '', hash);
    else window.history.pushState({ fedda: true }, '', hash);
  };

  const openTab = (tab: string) => navigate({ view: 'workspace', activeTab: tab });

  const openHomeCard = (tab: string) => {
    if (tab === 'image') return navigate({ view: 'image-section', activeTab });
    if (tab === 'video') return navigate({ view: 'video-section', activeTab });
    return openTab(tab);
  };

  const goHome = () => navigate({ view: 'home', activeTab });

  const goBack = () => {
    if (view === 'workspace') return navigate({ view: parentViewForTab(activeTab), activeTab });
    return goHome();
  };

  const meta = pageMeta[resolveTab(activeTab)] ?? pageMeta[defaultTab] ?? { label: APP_VERSION_LABEL, Icon: Sparkles };
  const Icon = view === 'home' ? Sparkles : view === 'image-section' ? Sparkles : view === 'video-section' ? Video : meta.Icon;
  const title =
    view === 'home' ? APP_VERSION_LABEL
    : view === 'image-section' ? 'Image Studio'
    : view === 'video-section' ? 'Video Studio'
    : meta.label;

  const PORTED: Record<string, React.ReactElement> = {
    'ideogram': <IdeogramPage />,
    'ideogram-txt2img': <IdeogramPage />,
    'z-image': <ZImagePage />,
    'z-image-txt2img': <ZImagePage />,
    'chroma': <ChromaHdPage />,
    'chroma-txt2img': <ChromaHdPage />,
    'chroma-simple-txt2img': <ChromaSimplePage />,
    'flux': <FluxKleinPage />,
    'flux-txt2img': <FluxKleinPage />,
    'flux-uncensored-txt2img': <FluxKleinUncensoredPage />,
    'qwen': <QwenTxt2ImgPage />,
    'qwen-txt2img': <QwenTxt2ImgPage />,
    'qwen-image-ref': <QwenImageRefPage />,
    'qwen-rapid-edit-v23': <QwenRapidEditPage />,
    'firered-image-edit': <FireRedPage />,
    'sdxl-outpaint': <SDXLOutpaintPage />,
    'sdxl-inpaint-automask': <SDXLInpaintPage />,
    'sdxl-controlnet-depth': <SDXLControlNetDepthPage />,
    'sdxl-controlnet-openpose': <SDXLControlNetOpenPosePage />,
    'ltx': <LtxImg2VidPage />,
    'ltx-img2vid': <LtxImg2VidPage />,
    'ltx-flf': <LtxFlfPage />,
    'wan22-img2vid': <WAN22Img2VidPage />,
    'wan22-vid2vid': <WAN22Vid2VidPage />,
    'wan22-img2vid-6frames': <WAN22StoryPage />,
    'wan21-steady-dancer': <SteadyDancerPage />,
    'wan21-scail2': <Scail2Page />,
    'venice': <VenicePage />,
    'venice-chat': <VenicePage />,
    'grok': <GrokPage />,
    'grok-chat': <GrokPage />,
    'gallery': <GalleryPage />,
    'ollama': <OllamaModelsPage />,
    'zonos-tts': <ZonosTTSPage />,
    'library': <LibraryPage />,
    'lora-library': <LibraryPage />,
    'ui-agent': <UIAgentPage />,
    'companion': <UIAgentPage />,
  };

  const renderWorkspace = () => {
    // Ported pages always render — they handle backend-unavailable state themselves
    const ported = PORTED[activeTab];
    if (ported) return ported;

    // Unported pages: show locked state if module not installed
    if (!isTabAvailable(activeTab)) {
      const requested = findModuleForTab(activeTab, FEDDA_MODULES);
      return <PlaceholderPage tab={activeTab} label={requested?.label ?? activeTab} />;
    }

    return <PlaceholderPage tab={activeTab} label={meta.label} />;
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-fedda-bg-0 text-sm text-fedda-text-3">
        Loading modules…
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-fedda-bg-0 font-sans">
      <AppHeader
        title={title}
        Icon={Icon}
        showBack={view !== 'home'}
        showHome={view === 'workspace'}
        onBack={goBack}
        onHome={goHome}
      />

      <main className="flex-1 overflow-hidden">
        {view === 'home' ? (
          <HomeView onSelect={openHomeCard} />
        ) : view === 'image-section' ? (
          <SectionView type="image" onSelect={openTab} onBack={goHome} />
        ) : view === 'video-section' ? (
          <SectionView type="video" onSelect={openTab} onBack={goHome} />
        ) : (
          renderWorkspace()
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ComfyExecutionProvider>
      <ToastProvider>
        <ModuleProvider>
          <FeddaApp />
        </ModuleProvider>
      </ToastProvider>
    </ComfyExecutionProvider>
  );
}
