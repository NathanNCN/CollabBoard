import { useState, useRef, useEffect, useCallback } from "react";
import { Stage, Layer, Line, Rect, Circle, Text } from "react-konva";

// Shape interface for drawing shapes
interface Shape {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  thickness: number;
  type: "square" | "circle" | "sticky-note";
  text?: string;
}

// CanvasElement interface for drawing lines and shapes
type CanvasElement = 
  | { type: "line"; points: number[]; color: string; thickness: number; id: string; clientId?: string }
  | { type: "shape"; shape: Shape; id: string; clientId?: string };

const CanvasBoard = ({ 
  selectedColor, 
  type, 
  thickness = 3, 
  clearTrigger = 0,
  boardId,
  sendWebSocket,
  onRemoteElement,
  clientId,
  onUndo,
  onRemoveElement,
  onLoadInitialState
}: { 
  selectedColor: string; 
  type: string; 
  thickness?: number; 
  clearTrigger?: number;
  boardId?: string;
  sendWebSocket?: (data: any) => void;
  onRemoteElement?: (addElementFn: (element: CanvasElement) => void) => void;
  clientId?: string;
  onUndo?: (undoFn: () => void) => void;
  onRemoveElement?: (removeElementFn: (elementId: string) => void) => void;
  onLoadInitialState?: (loadFn: (elements: CanvasElement[]) => void) => void;
}) => {
  
  // useState to store the current elements on canvas
  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  
  // Track action history for this client (for undo)
  const actionHistoryRef = useRef<CanvasElement[]>([]);

  // useState to store the current position of the mouse
  const [currentPosition, setCurrentPosition] = useState<{ x: number, y: number } | null>(null);
  const [startPos, setStartPos] = useState<{ x: number, y: number } | null>(null);
  const [tempShape, setTempShape] = useState<Shape | null>(null);
  const [laserLine, setLaserLine] = useState<{ points: number[]; color: string; thickness: number } | null>(null);

  // Generate unique IDs using crypto.randomUUID()
  const generateUniqueId = () => {
    return `element-${crypto.randomUUID()}`;
  };

  // Undo function - removes last action by this client
  const undo = useCallback(() => {
    if (!clientId) return;
    
    setElements(prev => {
      // Find the last element created by this client (from the end)
      for (let i = prev.length - 1; i >= 0; i--) {
        if (prev[i].clientId === clientId) {
          const removed = prev[i];
          console.log('↩️ Undoing element:', removed);
          // Remove from history
          actionHistoryRef.current = actionHistoryRef.current.filter(el => el.id !== removed.id);
          // Send undo event to other clients via WebSocket
          if (sendWebSocket) {
            sendWebSocket({ type: 'undo', elementId: removed.id, clientId: clientId });
          }
          // Return new array without this element
          return prev.filter((_, index) => index !== i);
        }
      }
      return prev;
    });
  }, [clientId, sendWebSocket]);

  // Expose undo function to parent
  useEffect(() => {
    if (onUndo) {
      onUndo(undo);
    }
  }, [onUndo, undo]);

  // useRef to store the current stage
  const stageRef = useRef<any>(null);
  const color = selectedColor;

  // Helper function to check if a point is inside a rectangle
  const isPointInRect = (point: { x: number; y: number }, rect: Shape, eraserRadius: number): boolean => {
    // Check if point is within eraser radius of any edge or corner of the rectangle
    const left = rect.x;
    const right = rect.x + rect.width;
    const top = rect.y;
    const bottom = rect.y + rect.height;
    
    // Check if point is inside the rectangle
    if (point.x >= left - eraserRadius && point.x <= right + eraserRadius &&
        point.y >= top - eraserRadius && point.y <= bottom + eraserRadius) {
      return true;
    }
    return false;
  };

  // Helper function to check if a point is inside a circle
  const isPointInCircle = (point: { x: number; y: number }, circle: Shape, eraserRadius: number): boolean => {
    const radius = Math.min(circle.width, circle.height) / 2;
    const centerX = circle.x + circle.width / 2;
    const centerY = circle.y + circle.height / 2;
    
    const distance = Math.sqrt(
      Math.pow(point.x - centerX, 2) + Math.pow(point.y - centerY, 2)
    );
    
    // Check if point is within the circle plus eraser radius
    return distance <= radius + eraserRadius;
  };

  // Check and remove shapes that intersect with eraser
  const checkAndRemoveShapes = (point: { x: number; y: number }, eraserRadius: number) => {
    setElements(prevElements => {
      // Filter out elements that intersect with the eraser
      return prevElements.filter(element => {

        // Check if element is a shape then calls the according function to check if eraser is in point
        if (element.type === "shape") {
          const shape = element.shape;
          if (shape.type === "square" || shape.type === "sticky-note") {
            return !isPointInRect(point, shape, eraserRadius);
          } else if (shape.type === "circle") {
            return !isPointInCircle(point, shape, eraserRadius);
          }
        }
        return true;
      });
    });
  };

  // Track last processed clear trigger to avoid sending duplicate messages
  const lastClearTriggerRef = useRef<number>(0);

  // Clear canvas when clearTrigger changes
  useEffect(() => {
    if (clearTrigger > 0 && clearTrigger !== lastClearTriggerRef.current) {
      lastClearTriggerRef.current = clearTrigger;
      setElements([]);
      actionHistoryRef.current = [];
      // Only send clear event if this is a new trigger (not from remote)
      // We'll send it from the parent component when user clicks clear button
    }
  }, [clearTrigger]);

  // Expose function to add remote elements
  const addRemoteElementRef = useRef<((element: CanvasElement) => void) | null>(null);
  
  const addRemoteElement = useCallback((element: CanvasElement) => {
    console.log('🎨 Adding remote element to canvas:', element);
    // Don't add remote elements to action history (they're from other clients)
    setElements(prev => {
      // Check if element already exists
      const exists = prev.some(el => el.id === element.id);
      if (exists) {
        // Update existing element (for line updates)
        return prev.map(el => {
          if (el.id === element.id && el.type === 'line' && element.type === 'line') {
            return element;
          }
          return el;
        });
      }
      // Add new element (from remote client, so don't track in history)
      return [...prev, element];
    });
  }, []);

  // Function to load initial state (set all elements at once)
  const loadInitialState = useCallback((elements: CanvasElement[]) => {
    console.log('📥 Loading initial state:', elements.length, 'elements');
    setElements(elements);
  }, []);

  // Expose loadInitialState to parent
  useEffect(() => {
    if (onLoadInitialState) {
      onLoadInitialState(loadInitialState);
    }
  }, [onLoadInitialState, loadInitialState]);

  // Function to remove element by ID (for remote undo)
  const removeElementById = useCallback((elementId: string) => {
    console.log('🗑️ Removing element by ID:', elementId);
    setElements(prev => prev.filter(el => el.id !== elementId));
  }, []);

  useEffect(() => {
    if (onRemoteElement) {
      addRemoteElementRef.current = addRemoteElement;
      // Call the callback to expose the function
      onRemoteElement(addRemoteElement);
    }
    if (onRemoveElement) {
      onRemoveElement(removeElementById);
    }
  }, [onRemoteElement, addRemoteElement, onRemoveElement, removeElementById]);

  
  const handleMouseDown = (e: any) => {
    const pos = e.target.getStage().getPointerPosition();
    setIsDrawing(true);
    setStartPos(pos);

    if (type === "pen") {
      const newElement: CanvasElement = {
        type: "line",
        points: [pos.x, pos.y],
        color,
        thickness,
        id: generateUniqueId(),
        clientId: clientId
      };
      setElements([...elements, newElement]);
      // Add to action history
      if (clientId) {
        actionHistoryRef.current.push(newElement);
      }
      // Send to WebSocket
      if (sendWebSocket) {
        console.log('📤 Sending pen element:', newElement);
        sendWebSocket({ type: 'element', element: newElement });
      }
    }
    else if (type === "laser") {
      setCurrentPosition(pos);
      setLaserLine({ points: [pos.x, pos.y], color, thickness });
    } 
    else if (type === "eraser") {
      const newElement: CanvasElement = {
        type: "line",
        points: [pos.x, pos.y],
        color: "#FFFFFF",
        thickness,
        id: generateUniqueId(),
        clientId: clientId
      };
      setElements([...elements, newElement]);
      // Add to action history
      if (clientId) {
        actionHistoryRef.current.push(newElement);
      }
      // Send to WebSocket
      if (sendWebSocket) {
        console.log('📤 Sending eraser element:', newElement);
        sendWebSocket({ type: 'element', element: newElement });
      }
      // Check for shape collisions on mouse down
      const eraserRadius = thickness / 2;
      checkAndRemoveShapes(pos, eraserRadius);
    } 
    else if (type === "square" || type === "circle" || type === "sticky-note") {
      const newShape: Shape = {
        x: pos.x,
        y: pos.y,
        width: 0,
        height: 0,
        color: color,
        thickness: thickness,
        type: type as "square" | "circle" | "sticky-note",
        text: type === "sticky-note" ? "" : undefined,
      };
      setTempShape(newShape);
    }
  };

  const handleMouseMove = (e: any) => {
    const stage = e.target.getStage();
    const point = stage.getPointerPosition();

    if (type === "laser" && isDrawing && laserLine) {
      // Update laser line in real-time
      setLaserLine({
        ...laserLine,
        points: [...laserLine.points, point.x, point.y]
      });
      return;
    }

    if (!isDrawing || !startPos) return;

    if (type === "pen" || type === "eraser") {
      setElements(prevElements => {
        const updated = [...prevElements];
        const lastElement = updated[updated.length - 1];
        if (lastElement && lastElement.type === "line") {
          lastElement.points = [...lastElement.points, point.x, point.y];
          // Send update to WebSocket (throttled - every 4 points)
          if (sendWebSocket && lastElement.points.length % 4 === 0) {
            // Send the full updated element
            const updatedElement: CanvasElement = {
              ...lastElement,
              points: [...lastElement.points]
            };
            sendWebSocket({ type: 'element-update', element: updatedElement });
          }
        }
        return updated;
      });
      
      // If eraser, check for shape collisions
      if (type === "eraser") {
        const eraserRadius = thickness / 2;
        checkAndRemoveShapes(point, eraserRadius);
      }
    }
    else if (type === "square" || type === "circle" || type === "sticky-note") {
      const width = point.x - startPos.x;
      const height = point.y - startPos.y;
      setTempShape({
        x: Math.min(startPos.x, point.x),
        y: Math.min(startPos.y, point.y),
        width: Math.abs(width),
        height: Math.abs(height),
        color: type === "sticky-note" ? "#FEF08A" : color,
        thickness: thickness,
        type: type as "square" | "circle" | "sticky-note",
        text: type === "sticky-note" ? "" : undefined,
      });
    }
  };

  const handleMouseUp = () => {
    if (type === "square" || type === "circle" || type === "sticky-note") {
      if (tempShape && tempShape.width > 5 && tempShape.height > 5) {
        const newElement: CanvasElement = {
          type: "shape",
          shape: tempShape,
          id: generateUniqueId(),
          clientId: clientId
        };
        setElements([...elements, newElement]);
        // Add to action history
        if (clientId) {
          actionHistoryRef.current.push(newElement);
        }
        // Send to WebSocket
        if (sendWebSocket) {
          console.log('📤 Sending shape element:', newElement);
          sendWebSocket({ type: 'element', element: newElement });
        }
      }
      setTempShape(null);
    }
    
    if (type === "laser") {
      setLaserLine(null);
      setCurrentPosition(null);
    }
    
    setIsDrawing(false);
    setStartPos(null);
  };

  return (
    <div className="flex flex-col items-center">

      <Stage
        ref={stageRef}
        width={window.innerWidth * 0.9}
        height={window.innerHeight * 0.75}
        onMouseDown={handleMouseDown}
        onMousemove={handleMouseMove}
        onMouseup={handleMouseUp}
        className="border rounded-lg shadow-md bg-white"
      >
        <Layer>
          {/* Render all elements in order (layered) */}
          {elements.map((element) => {
            if (element.type === "line") {
              return (
                <Line
                  key={element.id}
                  points={element.points}
                  stroke={element.color}
                  strokeWidth={element.thickness}
                  tension={0.5}
                  lineCap="round"
                  lineJoin="round"
                />
              );
            } else if (element.type === "shape") {
              const shape = element.shape;
              if (shape.type === "square") {
                return (
                  <Rect
                    key={element.id}
                    x={shape.x}
                    y={shape.y}
                    width={shape.width}
                    height={shape.height}
                    stroke={shape.color}
                    strokeWidth={shape.thickness}
                    fill="transparent"
                  />
                );
              } else if (shape.type === "circle") {
                const radius = Math.min(shape.width, shape.height) / 2;
                return (
                  <Circle
                    key={element.id}
                    x={shape.x + shape.width / 2}
                    y={shape.y + shape.height / 2}
                    radius={radius}
                    stroke={shape.color}
                    strokeWidth={shape.thickness}
                    fill="transparent"
                  />
                );
              } else if (shape.type === "sticky-note") {
                return (
                  <Rect
                    key={element.id}
                    x={shape.x}
                    y={shape.y}
                    width={shape.width}
                    height={shape.height}
                    fill={shape.color}
                    stroke="#EAB308"
                    strokeWidth={2}
                    shadowBlur={5}
                    shadowColor="rgba(0,0,0,0.2)"
                    shadowOffsetX={2}
                    shadowOffsetY={2}
                  />
                );
              }
            }
            return null;
          })}
          {/* Render temporary laser line on top */}
          {laserLine && (
            <Line
              points={laserLine.points}
              stroke={laserLine.color}
              strokeWidth={laserLine.thickness}
              tension={0.5}
              lineCap="round"
              lineJoin="round"
              opacity={0.7}
            />
          )}
          {tempShape && (
            <>
              {tempShape.type === "square" && (
                <Rect
                  x={tempShape.x}
                  y={tempShape.y}
                  width={tempShape.width}
                  height={tempShape.height}
                  stroke={tempShape.color}
                  strokeWidth={tempShape.thickness}
                  fill="transparent"
                  dash={[5, 5]}
                />
              )}
              {tempShape.type === "circle" && (
                <Circle
                  x={tempShape.x + tempShape.width / 2}
                  y={tempShape.y + tempShape.height / 2}
                  radius={Math.min(tempShape.width, tempShape.height) / 2}
                  stroke={tempShape.color}
                  strokeWidth={tempShape.thickness}
                  fill="transparent"
                  dash={[5, 5]}
                />
              )}
              {tempShape.type === "sticky-note" && (
                <Rect
                  x={tempShape.x}
                  y={tempShape.y}
                  width={tempShape.width}
                  height={tempShape.height}
                  fill={tempShape.color}
                  stroke="#EAB308"
                  strokeWidth={2}
                  dash={[5, 5]}
                />
              )}
            </>
          )}
        </Layer>
      </Stage>
    </div>
  );
};

export default CanvasBoard;