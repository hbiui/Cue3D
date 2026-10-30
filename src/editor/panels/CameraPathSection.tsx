import { Play, Pause, Plus, Trash2, GripVertical, Pencil, MapPin, ChevronDown, ChevronUp } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { InspectorSection, InspectorAxisGroup, InspectorRangeNumberField } from "./InspectorControls";
import { useDirectorStore } from "../store/directorStore";
import type { CameraPathPoint, DirectorCameraShot } from "../schema/directorProject";
import { CatmullRomCurve3, Vector3 } from "three";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const uuidv4 = () => crypto.randomUUID();

const EMPTY_ARRAY: CameraPathPoint[] = [];

function SortablePathPoint({ 
  pt, 
  index, 
  isActive,
  camera,
  jumpToPoint, 
  removePoint, 
  renamePoint,
  updatePoint,
  overwritePointWithCurrent
}: { 
  pt: CameraPathPoint; 
  index: number; 
  isActive: boolean;
  camera: DirectorCameraShot;
  jumpToPoint: (pt: CameraPathPoint) => void; 
  removePoint: (id: string) => void; 
  renamePoint: (id: string, newName: string) => void;
  updatePoint: (id: string, patch: Partial<CameraPathPoint>) => void;
  overwritePointWithCurrent: (id: string) => void;
}) {
  const updateCamera = useDirectorStore(state => state.updateCamera);
  const [defaultName] = useState(() => pt.name || `点位 ${index + 1}`);
  const [isEditing, setIsEditing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [name, setName] = useState(pt.name || defaultName);

  useEffect(() => {
    if (!isEditing) {
      setName(pt.name || defaultName);
    }
  }, [pt.name, defaultName, isEditing]);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: pt.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1 : 0,
    border: isActive ? '1px solid var(--accent-color)' : '1px solid transparent',
  };

  return (
    <div 
      ref={setNodeRef} 
      style={{ 
        ...style, 
        display: 'flex', 
        flexDirection: 'column',
        padding: '8px 12px', 
        background: isActive ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)', 
        borderRadius: '6px',
        position: 'relative',
        gap: '4px'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
          <div {...attributes} {...listeners} style={{ cursor: 'grab', color: '#888', display: 'flex', outline: 'none', flexShrink: 0 }}>
            <GripVertical size={14} />
          </div>
          {isEditing ? (
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              onBlur={() => {
                setIsEditing(false);
                renamePoint(pt.id, name);
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  setIsEditing(false);
                  renamePoint(pt.id, name);
                }
              }}
              style={{ 
                background: 'rgba(0,0,0,0.5)', 
                border: '1px solid var(--accent-color)', 
                color: 'white', 
                fontSize: '13px', 
                padding: '2px 4px', 
                borderRadius: '2px', 
                outline: 'none',
                width: '120px'
              }}
            />
          ) : (
            <span 
              style={{ fontSize: '13px', cursor: 'pointer', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} 
              onClick={() => jumpToPoint(pt)}
              onDoubleClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
              }}
              title="双击重命名"
            >
              {pt.name || defaultName}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
          {!isEditing && (
            <>
              <button onClick={() => overwritePointWithCurrent(pt.id)} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', display: 'flex', padding: '4px' }} title="覆盖为当前位置">
                <MapPin size={14} />
              </button>
              <button onClick={() => setIsEditing(true)} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', display: 'flex', padding: '4px' }} title="重命名">
                <Pencil size={14} />
              </button>
              <button onClick={() => setIsExpanded(!isExpanded)} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', display: 'flex', padding: '4px' }} title="展开编辑坐标">
                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </>
          )}
          <button onClick={() => removePoint(pt.id)} style={{ background: 'transparent', border: 'none', color: '#ff4d4f', cursor: 'pointer', display: 'flex', padding: '4px' }}>
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {isExpanded && (
        <div 
          style={{ 
            width: '100%', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '8px', 
            padding: '8px', 
            background: 'rgba(0,0,0,0.2)', 
            borderRadius: '4px',
            marginTop: '4px'
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <InspectorAxisGroup
            label="位置坐标"
            axes={[
              {
                axis: "X",
                ariaLabel: "点位位置 X",
                value: isActive ? (camera.transform?.position?.[0] ?? pt.position[0]) : pt.position[0],
                onChange: (value) => {
                  const numVal = Number(value);
                  if (isActive) {
                    const currentPos = [...(camera.transform?.position || [0, 0, 0])] as [number, number, number];
                    currentPos[0] = numVal;
                    updateCamera(camera.id, {
                      transform: {
                        ...camera.transform,
                        position: currentPos
                      }
                    });
                  } else {
                    const newPos = [...pt.position] as [number, number, number];
                    newPos[0] = numVal;
                    updatePoint(pt.id, { position: newPos });
                  }
                }
              },
              {
                axis: "Y",
                ariaLabel: "点位位置 Y",
                value: isActive ? (camera.transform?.position?.[1] ?? pt.position[1]) : pt.position[1],
                onChange: (value) => {
                  const numVal = Number(value);
                  if (isActive) {
                    const currentPos = [...(camera.transform?.position || [0, 0, 0])] as [number, number, number];
                    currentPos[1] = numVal;
                    updateCamera(camera.id, {
                      transform: {
                        ...camera.transform,
                        position: currentPos
                      }
                    });
                  } else {
                    const newPos = [...pt.position] as [number, number, number];
                    newPos[1] = numVal;
                    updatePoint(pt.id, { position: newPos });
                  }
                }
              },
              {
                axis: "Z",
                ariaLabel: "点位位置 Z",
                value: isActive ? (camera.transform?.position?.[2] ?? pt.position[2]) : pt.position[2],
                onChange: (value) => {
                  const numVal = Number(value);
                  if (isActive) {
                    const currentPos = [...(camera.transform?.position || [0, 0, 0])] as [number, number, number];
                    currentPos[2] = numVal;
                    updateCamera(camera.id, {
                      transform: {
                        ...camera.transform,
                        position: currentPos
                      }
                    });
                  } else {
                    const newPos = [...pt.position] as [number, number, number];
                    newPos[2] = numVal;
                    updatePoint(pt.id, { position: newPos });
                  }
                }
              }
            ]}
          />

          <InspectorAxisGroup
            label="注视坐标"
            axes={[
              {
                axis: "X",
                ariaLabel: "点位注视 X",
                value: isActive ? (camera.target?.[0] ?? pt.target[0]) : pt.target[0],
                onChange: (value) => {
                  const numVal = Number(value);
                  if (isActive) {
                    const currentTarget = [...(camera.target || [0, 0, 0])] as [number, number, number];
                    currentTarget[0] = numVal;
                    updateCamera(camera.id, { target: currentTarget });
                  } else {
                    const newTarget = [...pt.target] as [number, number, number];
                    newTarget[0] = numVal;
                    updatePoint(pt.id, { target: newTarget });
                  }
                }
              },
              {
                axis: "Y",
                ariaLabel: "点位注视 Y",
                value: isActive ? (camera.target?.[1] ?? pt.target[1]) : pt.target[1],
                onChange: (value) => {
                  const numVal = Number(value);
                  if (isActive) {
                    const currentTarget = [...(camera.target || [0, 0, 0])] as [number, number, number];
                    currentTarget[1] = numVal;
                    updateCamera(camera.id, { target: currentTarget });
                  } else {
                    const newTarget = [...pt.target] as [number, number, number];
                    newTarget[1] = numVal;
                    updatePoint(pt.id, { target: newTarget });
                  }
                }
              },
              {
                axis: "Z",
                ariaLabel: "点位注视 Z",
                value: isActive ? (camera.target?.[2] ?? pt.target[2]) : pt.target[2],
                onChange: (value) => {
                  const numVal = Number(value);
                  if (isActive) {
                    const currentTarget = [...(camera.target || [0, 0, 0])] as [number, number, number];
                    currentTarget[2] = numVal;
                    updateCamera(camera.id, { target: currentTarget });
                  } else {
                    const newTarget = [...pt.target] as [number, number, number];
                    newTarget[2] = numVal;
                    updatePoint(pt.id, { target: newTarget });
                  }
                }
              }
            ]}
          />

          <InspectorRangeNumberField
            label="视野 (FOV)"
            rangeAriaLabel="点位 FOV 滑杆"
            numberAriaLabel="点位 FOV"
            max="120"
            min="10"
            step="0.1"
            value={isActive ? (camera.fov ?? pt.fov ?? 50) : (pt.fov ?? 50)}
            onValueChange={(value) => {
              const numVal = Number(value);
              if (isActive) {
                updateCamera(camera.id, { fov: numVal });
              } else {
                updatePoint(pt.id, { fov: numVal });
              }
            }}
          />

          <button
            onClick={() => overwritePointWithCurrent(pt.id)}
            style={{
              background: 'var(--button-bg)',
              border: 'none',
              color: 'white',
              padding: '4px 8px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '11px',
              alignSelf: 'flex-end',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              marginRight: '5px'
            }}
          >
            <MapPin size={11} /> 覆盖为当前位置
          </button>
        </div>
      )}
    </div>
  );
}

export function CameraPathSection({ 
  camera,
  isRecording,
  setIsRecording
}: { 
  camera: DirectorCameraShot;
  isRecording: boolean;
  setIsRecording: (recording: boolean) => void;
}) {
  const updateCamera = useDirectorStore(state => state.updateCamera);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const animationRef = useRef<number | null>(null);

  const pathPoints = camera.pathPoints || EMPTY_ARRAY;
  const hasPath = pathPoints.length > 1;
  const pathPointsRef = useRef(pathPoints);
  pathPointsRef.current = pathPoints;

  const progressRef = useRef(progress);
  progressRef.current = progress;
  
  const cameraRef = useRef(camera);
  cameraRef.current = camera;

  const getInterpolatedState = useCallback((p: number) => {
    const pts = pathPointsRef.current;
    if (pts.length < 2) return null;
    const positions = pts.map(pt => new Vector3(...pt.position));
    const targets = pts.map(pt => new Vector3(...pt.target));
    const fovs = pts.map(pt => pt.fov ?? 50);

    const posCurve = new CatmullRomCurve3(positions);
    const targetCurve = new CatmullRomCurve3(targets);

    const interpPos = posCurve.getPoint(Math.min(Math.max(p, 0), 1));
    const interpTarget = targetCurve.getPoint(Math.min(Math.max(p, 0), 1));
    
    const totalSegments = pts.length - 1;
    const scaledProgress = p * totalSegments;
    const segmentIndex = Math.min(Math.floor(scaledProgress), totalSegments - 1);
    const segmentProgress = scaledProgress - segmentIndex;
    const fovStart = fovs[segmentIndex];
    const fovEnd = fovs[segmentIndex + 1] ?? fovStart;
    const interpFov = fovStart + (fovEnd - fovStart) * segmentProgress;

    return { 
      position: [interpPos.x, interpPos.y, interpPos.z] as [number, number, number], 
      target: [interpTarget.x, interpTarget.y, interpTarget.z] as [number, number, number], 
      fov: isNaN(interpFov) ? 50 : interpFov 
    };
  }, []);

  const applyProgress = useCallback((p: number) => {
    const state = getInterpolatedState(p);
    if (!state) return;
    const cam = cameraRef.current;
    updateCamera(cam.id, {
      transform: {
        ...cam.transform,
        position: state.position,
      },
      target: state.target,
      fov: state.fov,
    });
  }, [getInterpolatedState, updateCamera]);

  const togglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
    } else {
      if (progress >= 1) {
        setProgress(0);
      }
      setIsPlaying(true);
    }
  };

  useEffect(() => {
    if (isPlaying) {
      let lastTime = performance.now();
      const pts = pathPointsRef.current;
      const duration = pts.length * 2000; // 2 seconds per segment
      let currentLocalProgress = progressRef.current; // internal accumulator

      const tick = (now: number) => {
        const delta = now - lastTime;
        lastTime = now;
        
        currentLocalProgress += delta / duration;
        
        if (currentLocalProgress >= 1) {
          setProgress(1);
          setIsPlaying(false);
          if (isRecording) {
              setIsRecording(false);
          }
        } else {
          setProgress(currentLocalProgress);
          applyProgress(currentLocalProgress);
          animationRef.current = requestAnimationFrame(tick);
        }
      };
      
      animationRef.current = requestAnimationFrame(tick);
    }

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isPlaying, isRecording, setIsRecording, applyProgress]);

  const recordInitRef = useRef(false);

  useEffect(() => {
    if (isRecording && !isPlaying && !recordInitRef.current) {
      recordInitRef.current = true;
      setProgress(0);
      applyProgress(0);
      
      // Delay to ensure the recorder started
      setTimeout(() => {
        setIsPlaying(true);
      }, 100);
    } else if (!isRecording) {
      recordInitRef.current = false;
    }
  }, [isRecording, isPlaying, applyProgress]);

  const addPoint = () => {
    let nextNum = pathPoints.length + 1;
    const existingNames = new Set(pathPoints.map(p => p.name));
    while (existingNames.has(`点位 ${nextNum}`)) {
      nextNum++;
    }

    const newId = uuidv4();
    const newPoint: CameraPathPoint = {
      id: newId,
      name: `点位 ${nextNum}`,
      position: [...camera.transform.position] as [number, number, number],
      target: [...camera.target] as [number, number, number],
      fov: camera.fov,
    };
    updateCamera(camera.id, {
      pathPoints: [...pathPoints, newPoint],
      activePathPointId: newId
    });
  };

  const removePoint = (id: string) => {
    updateCamera(camera.id, {
      pathPoints: pathPoints.filter(p => p.id !== id),
      activePathPointId: camera.activePathPointId === id ? null : camera.activePathPointId
    });
  };

  const renamePoint = (id: string, newName: string) => {
    updateCamera(camera.id, {
      pathPoints: pathPoints.map(p => p.id === id ? { ...p, name: newName } : p)
    });
  };

  const updatePoint = (id: string, patch: Partial<CameraPathPoint>) => {
    updateCamera(camera.id, {
      pathPoints: pathPoints.map(p => p.id === id ? { ...p, ...patch } : p)
    });
  };

  const overwritePointWithCurrent = (id: string) => {
    updatePoint(id, {
      position: [...camera.transform.position] as [number, number, number],
      target: [...camera.target] as [number, number, number],
      fov: camera.fov,
    });
  };

  const jumpToPoint = (pt: CameraPathPoint) => {
    updateCamera(camera.id, {
      transform: {
        ...camera.transform,
        position: pt.position,
      },
      target: pt.target,
      fov: pt.fov,
    });
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: any) => {
    const { active, over } = event;

    if (active && over && active.id !== over.id) {
      const oldIndex = pathPoints.findIndex((p) => p.id === active.id);
      const newIndex = pathPoints.findIndex((p) => p.id === over.id);

      const newPathPoints = arrayMove(pathPoints, oldIndex, newIndex);
      updateCamera(camera.id, {
        pathPoints: newPathPoints
      });
    }
  };

  return (
    <InspectorSection title="路径模式" className="camera-path-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '8px 0' }}>
        <label htmlFor="pathModeSwitch" style={{ fontSize: '13px', color: 'var(--text-color)' }}>启用路径模式</label>
        <input 
          id="pathModeSwitch"
          type="checkbox" 
          checked={camera.pathMode || false}
          onChange={(e) => updateCamera(camera.id, { pathMode: e.target.checked })}
        />
      </div>

      {camera.pathMode && (
        <div style={{ marginTop: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-color)' }}>路径点位 ({pathPoints.length})</span>
            <button
              onClick={addPoint}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--button-bg)', border: 'none', color: 'white', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
            >
              <Plus size={14} /> 新增当前点位
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '16px' }}>
            <DndContext 
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext 
                items={pathPoints.map(p => p.id)}
                strategy={verticalListSortingStrategy}
              >
                {pathPoints.map((pt, i) => (
                  <SortablePathPoint 
                    key={pt.id} 
                    pt={pt} 
                    index={i} 
                    isActive={camera.activePathPointId === pt.id}
                    camera={camera}
                    jumpToPoint={(p) => {
                      updateCamera(camera.id, { activePathPointId: p.id });
                      jumpToPoint(p);
                    }} 
                    removePoint={removePoint} 
                    renamePoint={renamePoint}
                    updatePoint={updatePoint}
                    overwritePointWithCurrent={overwritePointWithCurrent}
                  />
                ))}
              </SortableContext>
            </DndContext>
            {pathPoints.length === 0 && (
              <div style={{ fontSize: '12px', color: '#888', textAlign: 'center', padding: '8px' }}>暂无点位，请新增记录。</div>
            )}
          </div>

          {hasPath && (
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                <button
                  onClick={togglePlay}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--accent-color)', border: 'none', color: 'white', width: '40px', height: '40px', borderRadius: '50%', cursor: 'pointer', flexShrink: 0 }}
                >
                  {isPlaying ? <Pause size={20} /> : <Play size={20} />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={progress}
                  onChange={(e) => {
                    const p = parseFloat(e.target.value);
                    setProgress(p);
                    applyProgress(p);
                  }}
                  style={{ flex: 1 }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </InspectorSection>
  );
}
