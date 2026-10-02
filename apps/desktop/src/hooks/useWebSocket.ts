import { useState, useEffect, useCallback, useRef } from 'react';

type ServerEvent = {
  type: string;
  [key: string]: unknown;
};

interface UseWebSocketReturn {
  connected: boolean;
  send: (event: Record<string, unknown>) => void;
  lastEvent: ServerEvent | null;
  subscribe: (type: string, handler: (event: ServerEvent) => void) => () => void;
}

export function useWebSocket(url: string): UseWebSocketReturn {
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<ServerEvent | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef<Map<string, Set<(event: ServerEvent) => void>>>(new Map());
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const connect = useCallback(() => {
    try {
      const ws = new WebSocket(url);

      ws.onopen = () => {
        console.log('[WS] Connected');
        setConnected(true);
      };

      ws.onclose = () => {
        console.log('[WS] Disconnected');
        if (wsRef.current === ws) {
          setConnected(false);
          wsRef.current = null;

          // Auto-reconnect after 2 seconds
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('[WS] Reconnecting...');
            connect();
          }, 2000);
        }
      };

      ws.onerror = (error) => {
        console.error('[WS] Error:', error);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as ServerEvent;
          setLastEvent(data);

          // Dispatch to type-specific handlers
          const typeHandlers = handlersRef.current.get(data.type);
          if (typeHandlers) {
            typeHandlers.forEach(handler => handler(data));
          }

          // Dispatch to wildcard handlers
          const wildcardHandlers = handlersRef.current.get('*');
          if (wildcardHandlers) {
            wildcardHandlers.forEach(handler => handler(data));
          }
        } catch (err) {
          console.error('[WS] Parse error:', err);
        }
      };

      wsRef.current = ws;
    } catch (err) {
      console.error('[WS] Connection failed:', err);
      reconnectTimeoutRef.current = setTimeout(connect, 2000);
    }
  }, [url]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      wsRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((event: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(event));
    }
  }, []);

  const subscribe = useCallback((type: string, handler: (event: ServerEvent) => void) => {
    if (!handlersRef.current.has(type)) {
      handlersRef.current.set(type, new Set());
    }
    handlersRef.current.get(type)!.add(handler);

    // Return unsubscribe function
    return () => {
      handlersRef.current.get(type)?.delete(handler);
    };
  }, []);

  return { connected, send, lastEvent, subscribe };
}
