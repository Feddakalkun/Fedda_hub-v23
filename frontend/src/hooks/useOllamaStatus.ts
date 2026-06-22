import { useState, useEffect } from 'react';

export const useOllamaStatus = () => {
    const [isConnected, setIsConnected] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const checkStatus = async () => {
            try {
                const response = await fetch('/ollama/tags', { method: 'GET' }).catch(() => null);
                setIsConnected(response?.ok ?? false);
            } catch {
                setIsConnected(false);
            } finally {
                setIsLoading(false);
            }
        };

        checkStatus();
        const interval = setInterval(checkStatus, 10000);
        return () => clearInterval(interval);
    }, []);

    return { isConnected, isLoading };
};
