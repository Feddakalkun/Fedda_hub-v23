import { useState, useEffect } from 'react';
import { comfyService } from '../services/comfyService';

export const useComfyStatus = (pollInterval: number = 3000) => {
    const [isConnected, setIsConnected] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let intervalId: ReturnType<typeof setInterval>;

        const checkStatus = async () => {
            try {
                let alive = false;
                try {
                    const proxied = await fetch('/comfy/system_stats', { cache: 'no-store' });
                    alive = proxied.ok;
                } catch {
                    alive = false;
                }

                if (!alive) {
                    alive = await comfyService.isAlive();
                }
                setIsConnected(alive);
            } catch {
                setIsConnected(false);
            } finally {
                setIsLoading(false);
            }
        };

        checkStatus();
        intervalId = setInterval(checkStatus, pollInterval);

        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [pollInterval]);

    return { isConnected, isLoading };
};
