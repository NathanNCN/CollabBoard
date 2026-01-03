"use client";

// Imports
import { Pen, Square, Circle, StickyNote, Link as LinkIcon, Download, MousePointerClick, EraserIcon, RulerDimensionLineIcon, TrashIcon, Undo2} from "lucide-react";
import { useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { useRouter } from "next/navigation";
import CanvasBoard from "@/components/canvas";
import { useWebSocket } from "@/hooks/useWebSocket";

// Type for Canvas lines and shapes
type CanvasElement = 
  | { type: "line"; points: number[]; color: string; thickness: number; id: string; clientId?: string }
  | { type: "shape"; shape: any; id: string; clientId?: string };

export default function BoardPage() {

  // Router and params
  const router = useRouter();
  const params = useParams();
  const boardId = params?.id as string;

  // Refs for remote elements, undo, clear, and initial state
  const addRemoteElementRef = useRef<((element: CanvasElement) => void) | null>(null);
  const removeElementRef = useRef<((elementId: string) => void) | null>(null);
  const undoRef = useRef<(() => void) | null>(null);
  const loadInitialStateRef = useRef<((elements: CanvasElement[]) => void) | null>(null);
  
  // Generate unique client ID for this session
  const [clientId] = useState(() => `client-${crypto.randomUUID()}`);
  
  // use state for tools
  const [selectedTool, setSelectedTool] = useState<string>("pen");
  const [selectedColor, setSelectedColor] = useState<string>("#000000");
  const [hexInput, setHexInput] = useState<string>("#000000");
  const [penThickness, setPenThickness] = useState<number>(3);
  const [clearTrigger, setClearTrigger] = useState<number>(0);

  // Handle WebSocket messages from server
  const handleWebSocketMessage = useCallback((data: any) => {
    console.log('📩 Received WebSocket message:', data);

    // Small delay to ensure ref is set
    setTimeout(() => {

      // If initial state, load all elements at once
      if (data.type === 'initial-state') {
        // Load initial board state when joining
        console.log('📥 Received initial state:', data.elements?.length, 'elements');
        setTimeout(() => {
          if (data.elements && loadInitialStateRef.current) {
            // Load all elements at once 
            loadInitialStateRef.current(data.elements);
            console.log('✅ Loaded initial state:', data.elements.length, 'elements');
          } else if (data.elements && addRemoteElementRef.current) {
            data.elements.forEach((element: CanvasElement) => {
              if (addRemoteElementRef.current) {
                addRemoteElementRef.current(element);
              }
            });
            console.log('✅ Loaded initial state (fallback):', data.elements.length, 'elements');
          } else {
            // Retry if ref not ready
            setTimeout(() => {
              if (data.elements && loadInitialStateRef.current) {
                loadInitialStateRef.current(data.elements);
              } else if (data.elements && addRemoteElementRef.current) {
                data.elements.forEach((element: CanvasElement) => {
                  if (addRemoteElementRef.current) {
                    addRemoteElementRef.current(element);
                  }
                });
              }
            }, 200);
          }
        }, 100);
      
      // If element, add remote element to canvas
      } else if (data.type === 'element') {
        // Add remote element to canvas
        if (addRemoteElementRef.current) {
          console.log('✅ Adding remote element:', data.element);
          addRemoteElementRef.current(data.element);
        } else {
          // Retry after a bit more time
          setTimeout(() => {
            if (addRemoteElementRef.current && data.element) {
              addRemoteElementRef.current(data.element);
            }
          }, 100);
        }
      
      // If element update, update remote element on canvas
      } else if (data.type === 'element-update') {
        // Update existing element
        if (addRemoteElementRef.current && data.element) {
          console.log('✅ Updating remote element:', data.element);
          addRemoteElementRef.current(data.element);
        }
      } else if (data.type === 'clear') {
        console.log('✅ Remote clear triggered');
        setClearTrigger(prev => prev + 1);
      } else if (data.type === 'undo') {
        // Handle remote undo - remove element by ID
        console.log('↩️ Remote undo received for element:', data.elementId);
        if (removeElementRef.current && data.elementId) {
          removeElementRef.current(data.elementId);
        }
      }
    }, 10);
  }, []);

  // WebSocket connection
  const { isConnected, send } = useWebSocket({
    boardId: boardId || '',
    onMessage: handleWebSocketMessage,
    onOpen: () => console.log('WebSocket connected'),
    onClose: () => console.log('WebSocket disconnected'),
    onError: (error) => console.error('WebSocket error:', error),
  });

  // Handle hex color change
  const handleHexChange = (value: string) => {
    setHexInput(value);
    const hexPattern = /^#?([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    if (hexPattern.test(value)) {
      const hexColor = value.startsWith("#") ? value : `#${value}`;
      if (hexColor.length === 4) {
        // Expand shorthand hex (e.g., #FFF to #FFFFFF)
        const expanded = `#${hexColor[1]}${hexColor[1]}${hexColor[2]}${hexColor[2]}${hexColor[3]}${hexColor[3]}`;
        setSelectedColor(expanded);
      } else {
        setSelectedColor(hexColor);
      }
    }
  };

  return (
    <div className="flex h-screen flex-col bg-white">
      {/* Header */}
      <header className="flex items-center justify-center border-b-2 px-6 py-4 shadow-sm gap-3">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent">
          CollabBoard
          </h1>
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs ${
          isConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          {isConnected ? 'Connected' : 'Disconnected'}
        </div>
        <button onClick={() => router.push('/')} className="text-gray-600 hover:text-gray-500 bg-gray-100 rounded-xl p-3 transition-all">
          Home
        </button>
      </header>

      {/* Navigation Bar */}
      <nav className="flex items-center justify-center gap-3 border-b border-purple-100 bg-white px-6 py-4 shadow-sm">

        {/* Laser Pointer Tool */}
        <button
          onClick={() => setSelectedTool("laser")}
          className={`flex items-center justify-center rounded-xl p-3 transition-all ${
            selectedTool === "laser"
              ? "bg-red-100 text-red-600 shadow-md scale-105"
              : "text-gray-600 hover:bg-red-50 hover:text-red-500"
          }`}
          title="Laser Pointer"
        >
          <MousePointerClick size={22} />
        </button>

        {/* Pen Tool */}
        <button
          onClick={() => {
            setSelectedTool("pen");
            setSelectedColor("#000000");
            setHexInput("#000000");
          }}
          className={`flex items-center justify-center rounded-xl p-3 transition-all ${
            selectedTool === "pen"
              ? "bg-blue-100 text-blue-600 shadow-md scale-105"
              : "text-gray-600 hover:bg-blue-50 hover:text-blue-500"
          }`}
          title="Pen Tool"
        >
          <Pen size={22} />
        </button>

        {/* Eraser Tool */}
        <button
          onClick={() => {
            setSelectedTool("eraser");
            setSelectedColor("#FFFFFF");
            setHexInput("#FFFFFF");
          }}
          className={`flex items-center justify-center rounded-xl p-3 transition-all ${
            selectedTool === "eraser"
              ? "bg-gray-100 text-gray-600 shadow-md scale-105"
              : "text-gray-600 hover:bg-gray-50 hover:text-gray-500"
          }`}
          title="Eraser Tool"
        >
          <EraserIcon size={22} />
        </button>

        {/* Square Tool */}
        <button
          onClick={() => setSelectedTool("square")}
          className={`flex items-center justify-center rounded-xl p-3 transition-all ${
            selectedTool === "square"
              ? "bg-purple-100 text-purple-600 shadow-md scale-105"
              : "text-gray-600 hover:bg-purple-50 hover:text-purple-500"
          }`}
          title="Square Tool"
        >
          <Square size={22} />
        </button>

        {/* Circle Tool */}
        <button
          onClick={() => setSelectedTool("circle")}
          className={`flex items-center justify-center rounded-xl p-3 transition-all ${
            selectedTool === "circle"
              ? "bg-indigo-100 text-indigo-600 shadow-md scale-105"
              : "text-gray-600 hover:bg-indigo-50 hover:text-indigo-500"
          }`}
          title="Circle Tool"
        >
          <Circle size={22} />
        </button>

        {/* Sticky Note Tool */}
        <button
          onClick={() => setSelectedTool("sticky-note")}
          className={`flex items-center justify-center rounded-xl p-3 transition-all ${
            selectedTool === "sticky-note"
              ? "bg-yellow-100 text-yellow-600 shadow-md scale-105"
              : "text-gray-600 hover:bg-yellow-50 hover:text-yellow-500"
          }`}
          title="Sticky Note"
        >
          <StickyNote size={22} />
        </button>

      </nav>

      {/* Colour Picker */}
      <div className="flex items-center justify-center gap-3 bg-white px-6 py-4 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-600 mr-2">Colors:</span>
          {[
            { name: "Black", color: "#000000" },
            { name: "Red", color: "#EF4444" },
            { name: "Blue", color: "#3B82F6" },
            { name: "Green", color: "#10B981" },
            { name: "Yellow", color: "#F59E0B" },
            { name: "Purple", color: "#8B5CF6" },
          ].map((colorOption) => (
            <button
              key={colorOption.color}
              disabled={selectedTool === "eraser"}
              onClick={() => {
                setSelectedColor(colorOption.color);
                setHexInput(colorOption.color);
              }}
              className={`w-10 h-10 rounded-lg border-2 transition-all hover:scale-110 ${
                selectedColor === colorOption.color
                  ? "border-gray-800 scale-110 shadow-lg ring-2 ring-offset-2 ring-gray-300"
                  : "border-gray-300 hover:border-gray-400"
              } ${selectedTool === "eraser" ? "opacity-50 cursor-not-allowed" : ""}`}
              style={{ backgroundColor: colorOption.color }}
              title={colorOption.name}
            />
          ))}

          {/* Thickness Slider */}
          <div className="flex items-center gap-2 ml-4 pl-4 border-l border-gray-300">
            <span className="text-sm font-medium text-gray-600">Thickness:</span>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="1"
                max="20"
                value={penThickness}
                onChange={(e) => setPenThickness(Number(e.target.value))}
                className="w-24 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
              />
              <span className="text-sm font-medium text-gray-600 w-8">{penThickness}px</span>
              <div
                className="rounded-full border-2 border-gray-300"
                style={{
                  width: `${Math.max(penThickness, 4)}px`,
                  height: `${Math.max(penThickness, 4)}px`,
                  backgroundColor: selectedColor,
                }}
                title="Thickness preview"
              />
            </div>
          </div>

          {/* Custom Colour Input */}
          <div className="flex items-center gap-2 ml-4 pl-4 border-l border-gray-300">
            <span className="text-sm font-medium text-gray-600">Custom:</span>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={hexInput}
                onChange={(e) => handleHexChange(e.target.value)}
                placeholder="#000000"
                disabled={selectedTool === "eraser"}
                className={`w-24 px-3 py-2 rounded-lg border-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all ${
                  selectedTool === "eraser"
                    ? "opacity-50 cursor-not-allowed bg-gray-100 border-gray-200"
                    : "bg-white border-gray-300 hover:border-gray-400"
                }`}
                style={{ color: selectedColor }}
              />
              <div
                className="w-10 h-10 rounded-lg border-2 border-gray-300"
                style={{ backgroundColor: selectedColor }}
                title="Current color"
              />
            </div>
          </div>

          {/* Undo Button */}
          <button
            onClick={() => {
              if (undoRef.current) {
                undoRef.current();
              }
            }}
            className="flex items-center justify-center rounded-xl p-3 transition-all hover:bg-orange-50 hover:text-orange-500 text-gray-600"
            title="Undo Last Action"
          >
            <Undo2 size={22} />
          </button>

          {/* Clear Canvas Button */}
          <button
            onClick={() => {
              setClearTrigger(prev => prev + 1);
              // Send clear event to other clients when user clicks
              if (send) {
                send({ type: 'clear' });
              }
            }}
            className="flex items-center justify-center rounded-xl p-3 transition-all hover:bg-red-50 hover:text-red-500 text-gray-600"
            title="Clear Canvas"
          >
            <TrashIcon size={22} />
          </button>
        </div>
      </div>

      {/* Whiteboard Canvas Area */}
      <main className="flex-1 overflow-hidden bg-gradient-to-br from-gray-50 to-white">
        <div className="h-full w-full bg-white">
          <CanvasBoard 
            selectedColor={selectedColor} 
            type={selectedTool} 
            thickness={penThickness} 
            clearTrigger={clearTrigger}
            boardId={boardId}
            sendWebSocket={send}
            clientId={clientId}
            onRemoteElement={(addElementFn) => {
              addRemoteElementRef.current = addElementFn;
            }}
            onUndo={(undoFn) => {
              undoRef.current = undoFn;
            }}
            onRemoveElement={(removeElementFn) => {
              removeElementRef.current = removeElementFn;
            }}
            onLoadInitialState={(loadFn) => {
              loadInitialStateRef.current = loadFn;
            }}
          />
        </div>
      </main>
    </div>
  );
}
