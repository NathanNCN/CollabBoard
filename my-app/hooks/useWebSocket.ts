import { useEffect, useRef, useState } from 'react';

// Type for WebSocket options
interface UseWebSocketOptions {
  boardId: string;
  onMessage?: (data: any) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
}

// Hook to connect to WebSocket server
export function useWebSocket({ boardId, onMessage, onOpen, onClose, onError }: UseWebSocketOptions) {
  
  // useState to track connection status
  const [isConnected, setIsConnected] = useState(false);

  // useRef to store WebSocket instance and reconnect timeout
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Function to connect to WebSocket server
  const connect = () => {

    // If already connected, return nothing
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';

    // Create new WebSocket connection
    const ws = new WebSocket(`${wsUrl}/ws/${boardId}`);

    ws.onopen = () => {
      console.log('✅ WebSocket connected');
      setIsConnected(true);
      onOpen?.();
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage?.(data);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onclose = () => {
      console.log('❌ WebSocket disconnected');
      setIsConnected(false);
      onClose?.();
      
      // Attempt to reconnect after 3 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 3000);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      onError?.(error);
    };

    wsRef.current = ws;
  };

  const send = (data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    } else {
      console.warn('WebSocket is not connected');
    }
  };

  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    wsRef.current?.close();
    wsRef.current = null;
    setIsConnected(false);
  };

  useEffect(() => {
    if (boardId) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [boardId]);

  return { isConnected, send, disconnect };
}

