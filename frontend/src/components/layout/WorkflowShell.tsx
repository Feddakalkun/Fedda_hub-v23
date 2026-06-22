import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { PanelRightClose, PanelRightOpen } from 'lucide-react';
import { WorkflowDownloadBanner } from '../ui/WorkflowDownloadBanner';

interface WorkflowShellProps {
  children: ReactNode;
  output: ReactNode;
  workflowId?: string;
  defaultOutputWidth?: number;
}

export const WorkflowShell = ({
  children,
  output,
  workflowId,
  defaultOutputWidth = 520,
}: WorkflowShellProps) => {
  const [outputWidth, setOutputWidth] = useState(defaultOutputWidth);
  const [outputCollapsed, setOutputCollapsed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(defaultOutputWidth);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = outputWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [outputWidth]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const containerWidth = containerRef.current.clientWidth;
      const delta = startXRef.current - e.clientX;
      const newOutputWidth = Math.max(320, Math.min(containerWidth - 420 - 5, startWidthRef.current + delta));
      setOutputWidth(newOutputWidth);
    };

    const handleMouseUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  return (
    <div ref={containerRef} className="flex h-full overflow-hidden">
      {/* Controls pane */}
      <div className="flex-1 min-w-[420px] flex flex-col overflow-hidden">
        {workflowId && <WorkflowDownloadBanner workflowId={workflowId} />}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {children}
        </div>
      </div>

      {/* Drag handle — only shown when output is expanded */}
      {!outputCollapsed && (
        <div
          className="w-1 flex-shrink-0 bg-white/[0.05] hover:bg-fedda-accent/50 cursor-col-resize transition-colors"
          onMouseDown={handleDragStart}
        />
      )}

      {/* Output pane */}
      <div
        className="flex-shrink-0 flex flex-col overflow-hidden border-l border-white/[0.06] transition-[width] duration-200"
        style={{ width: outputCollapsed ? '40px' : `${outputWidth}px` }}
      >
        {/* Collapse toggle strip */}
        <div className="h-10 border-b border-white/[0.06] flex items-center flex-shrink-0 px-2">
          {outputCollapsed ? null : (
            <span className="text-[10px] font-semibold uppercase tracking-widest text-fedda-text-4 flex-1 pl-2">
              Output
            </span>
          )}
          <button
            onClick={() => setOutputCollapsed(!outputCollapsed)}
            title={outputCollapsed ? 'Expand output' : 'Collapse output'}
            className="h-7 w-7 rounded-lg flex items-center justify-center text-fedda-text-4 hover:text-fedda-text-2 hover:bg-white/[0.05] transition-all ml-auto"
          >
            {outputCollapsed
              ? <PanelRightOpen className="h-3.5 w-3.5" />
              : <PanelRightClose className="h-3.5 w-3.5" />}
          </button>
        </div>

        {/* Output content */}
        {!outputCollapsed && (
          <div className="flex-1 overflow-hidden">
            {output}
          </div>
        )}
      </div>
    </div>
  );
};

// Convenience section wrapper for grouping form fields
interface WorkflowSectionProps {
  title?: string;
  children: ReactNode;
  className?: string;
}

export const WorkflowSection = ({ title, children, className = '' }: WorkflowSectionProps) => (
  <div className={`space-y-3 ${className}`}>
    {title && (
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-fedda-text-4 border-b border-white/[0.06] pb-2">
        {title}
      </p>
    )}
    {children}
  </div>
);
