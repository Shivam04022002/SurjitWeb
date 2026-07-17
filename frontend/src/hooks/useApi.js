import { useState, useEffect, useRef, useCallback } from 'react';

const cache = new Map();

export const useApi = (fetcher, deps = [], { cacheKey = null, enabled = true } = {}) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(!!enabled);
    const [error, setError] = useState(null);
    const isMounted = useRef(true);

    const fetchData = useCallback(async () => {
        if (!enabled) {
            setLoading(false);
            return;
        }

        if (cacheKey && cache.has(cacheKey)) {
            setData(cache.get(cacheKey));
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const result = await fetcher();
            if (isMounted.current) {
                if (cacheKey) cache.set(cacheKey, result);
                setData(result);
                setError(null);
            }
        } catch (err) {
            if (isMounted.current) {
                setError(err?.response?.data?.message || err.message || 'Failed to load data');
                setData(null);
            }
        } finally {
            if (isMounted.current) setLoading(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, cacheKey, ...deps]);

    useEffect(() => {
        isMounted.current = true;
        fetchData();
        return () => { isMounted.current = false; };
    }, [fetchData]);

    return { data, loading, error, refetch: fetchData };
};
