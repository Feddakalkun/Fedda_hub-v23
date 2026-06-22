import { useState, useEffect } from 'react';

export const useBackendStatus = () => {
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        const check = async () => {
            try {
                const r = await fetch('/api/health').catch(() => null);
                setIsConnected(r?.ok ?? false);
            } catch {
                setIsConnected(false);
            }
        };
        check();
        const id = setInterval(check, 10000);
        return () => clearInterval(id);
    }, []);

    return { isConnected };
};
