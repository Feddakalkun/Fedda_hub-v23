import { useState, useCallback, createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
    id: number;
    message: string;
    type: ToastType;
}

interface ToastContextType {
    toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType>({ toast: () => {} });

export const useToast = () => useContext(ToastContext);

let toastCounter = 0;

export const ToastProvider = ({ children }: { children: ReactNode }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const addToast = useCallback((message: string, type: ToastType = 'info') => {
        const id = ++toastCounter;
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 4000);
    }, []);

    const dismiss = useCallback((id: number) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const icons = {
        success: <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />,
        error: <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />,
        info: <Info className="w-4 h-4 text-fedda-accent flex-shrink-0" />,
    };

    const accents = {
        success: 'border-emerald-500/20',
        error: 'border-red-500/20',
        info: 'border-white/10',
    };

    return (
        <ToastContext.Provider value={{ toast: addToast }}>
            {children}
            <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
                {toasts.map((t) => (
                    <div
                        key={t.id}
                        className={`flex items-center gap-3 px-4 py-3 bg-fedda-bg-1 border ${accents[t.type]} rounded-xl shadow-2xl`}
                    >
                        {icons[t.type]}
                        <span className="text-sm text-fedda-text-1 flex-1">{t.message}</span>
                        <button
                            onClick={() => dismiss(t.id)}
                            className="text-fedda-text-4 hover:text-fedda-text-2 transition flex-shrink-0"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};
