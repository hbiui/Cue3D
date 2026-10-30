import { useEffect, useMemo, useState } from "react";
import { Play, Pause, RotateCcw } from "lucide-react";
import {
  InspectorAxisGroup,
  InspectorColorField,
  InspectorSelectField,
  InspectorPanel,
  InspectorRangeNumberField,
  InspectorTextField,
  InspectorSection,
} from "./InspectorControls";
import { BODY_TYPE_OPTIONS, type CharacterBodyType } from "../runtime/mannequin/bodyTypes";
import { MANNEQUIN_POSE_PRESETS } from "../presets/mannequinPosePresets";
import { getCrowdAnchorTransform, useDirectorStore } from "../store/directorStore";
import { ANIMATION_LIST } from "../runtime/ue4Mannequin/ue4Animations";

function replaceAxis(tuple: [number, number, number], axis: 0 | 1 | 2, value: number): [number, number, number] {
  return tuple.map((item, index) => (index === axis ? value : item)) as [number, number, number];
}

export function CharacterPanel() {
  const [activeTab, setActiveTab] = useState<"properties" | "pose" | "animation">("properties");
  const selectedCrowdId = useDirectorStore((state) => state.selectedCrowdId);
  const selectedObjectId = useDirectorStore((state) => state.selectedObjectId);
  const objects = useDirectorStore((state) => state.project.objects);
  const updateObjectName = useDirectorStore((state) => state.updateObjectName);
  const updateCrowdLabel = useDirectorStore((state) => state.updateCrowdLabel);
  const updateObjectTransform = useDirectorStore((state) => state.updateObjectTransform);
  const updateCrowdTransform = useDirectorStore((state) => state.updateCrowdTransform);
  const updateUniformScale = useDirectorStore((state) => state.updateUniformScale);
  const updateCrowdUniformScale = useDirectorStore((state) => state.updateCrowdUniformScale);
  const updateObjectColor = useDirectorStore((state) => state.updateObjectColor);
  const updateCharacterBodyType = useDirectorStore((state) => state.updateCharacterBodyType);
  const updateCrowdBodyType = useDirectorStore((state) => state.updateCrowdBodyType);
  const updateCrowdColor = useDirectorStore((state) => state.updateCrowdColor);
  const applyPosePreset = useDirectorStore((state) => state.applyPosePreset);
  const applyCrowdPosePreset = useDirectorStore((state) => state.applyCrowdPosePreset);
  const updatePoseControl = useDirectorStore((state) => state.updatePoseControl);
  const updateCrowdPoseControl = useDirectorStore((state) => state.updateCrowdPoseControl);
  const updateCharacterAnimation = useDirectorStore((state) => state.updateCharacterAnimation);
  const updateCrowdAnimation = useDirectorStore((state) => state.updateCrowdAnimation);
  const updateCharacterAnimationInPlace = useDirectorStore((state) => state.updateCharacterAnimationInPlace);
  const updateCrowdAnimationInPlace = useDirectorStore((state) => state.updateCrowdAnimationInPlace);
  const toggleCharacterAnimationPause = useDirectorStore((state) => state.toggleCharacterAnimationPause);
  const toggleCrowdAnimationPause = useDirectorStore((state) => state.toggleCrowdAnimationPause);

  const selection = useMemo(() => {
    const role = objects.find((item) => item.id === selectedObjectId && item.kind === "character");

    if (selectedCrowdId) {
      const crowdMembers = objects.filter((item) => item.kind === "character" && item.crowdId === selectedCrowdId);
      const crowdAnchor = getCrowdAnchorTransform(objects, selectedCrowdId);

      if (crowdMembers.length && crowdAnchor) {
        return {
          mode: "crowd" as const,
          crowdId: selectedCrowdId,
          crowdMembers,
          crowdAnchor,
          role: crowdMembers[crowdMembers.length - 1] ?? crowdMembers[0],
          name: crowdMembers[0]?.crowdLabel ?? "群众",
          color: crowdMembers[0]?.color ?? "#4F8EF7",
        };
      }
    }

    if (!role) return null;

    return {
      mode: "single" as const,
      crowdId: null,
      crowdMembers: [role],
      crowdAnchor: role.transform,
      role,
      name: role.name,
      color: role.color ?? "#4F8EF7",
    };
  }, [objects, selectedCrowdId, selectedObjectId]);

  const roleBodyType = selection?.role?.bodyType;

  useEffect(() => {
    const isGeom = ["box", "sphere", "cylinder", "torus", "cone", "pyramid"].includes(roleBodyType ?? "");
    if (isGeom && activeTab !== "properties") {
      setActiveTab("properties");
    }
  }, [roleBodyType, activeTab]);

  if (!selection) return null;

  const role = selection.role;
  const roleColor = selection.color;
  const transform = selection.crowdAnchor;
  const isCrowd = selection.mode === "crowd";
  const isGeometry = ["box", "sphere", "cylinder", "torus", "cone", "pyramid"].includes(role.bodyType ?? "");
  const poseGroups = [
    {
      title: "身体",
      controls: [
        { key: "body.pitch", label: "前倾" },
        { key: "body.yaw", label: "转身" },
        { key: "body.roll", label: "侧倾" },
      ],
    },
    {
      title: "躯干",
      controls: [
        { key: "torso.pitch", label: "前倾" },
        { key: "torso.yaw", label: "扭转" },
        { key: "torso.roll", label: "侧倾" },
      ],
    },
    {
      title: "头部",
      controls: [
        { key: "head.pitch", label: "点头" },
        { key: "head.yaw", label: "转头" },
        { key: "head.roll", label: "歪头" },
      ],
    },
    {
      title: "左肩",
      controls: [
        { key: "leftShoulder.pitch", label: "前举" },
        { key: "leftShoulder.spread", label: "外展" },
        { key: "leftShoulder.twist", label: "扭转" },
      ],
    },
    {
      title: "右肩",
      controls: [
        { key: "rightShoulder.pitch", label: "前举" },
        { key: "rightShoulder.spread", label: "外展" },
        { key: "rightShoulder.twist", label: "扭转" },
      ],
    },
    {
      title: "左肘",
      controls: [{ key: "leftElbow.bend", label: "弯曲" }],
    },
    {
      title: "右肘",
      controls: [{ key: "rightElbow.bend", label: "弯曲" }],
    },
    {
      title: "左髋",
      controls: [
        { key: "leftHip.pitch", label: "前抬" },
        { key: "leftHip.spread", label: "外展" },
        { key: "leftHip.twist", label: "扭转" },
      ],
    },
    {
      title: "右髋",
      controls: [
        { key: "rightHip.pitch", label: "前抬" },
        { key: "rightHip.spread", label: "外展" },
        { key: "rightHip.twist", label: "扭转" },
      ],
    },
    {
      title: "左膝",
      controls: [{ key: "leftKnee.bend", label: "弯曲" }],
    },
    {
      title: "右膝",
      controls: [{ key: "rightKnee.bend", label: "弯曲" }],
    },
  ] as const;

  return (
    <InspectorPanel
      title="角色"
      ariaLabel="角色右侧属性面板"
      className="character-inspector"
      tabs={
        isGeometry
          ? [{ label: "属性", active: activeTab === "properties", onClick: () => setActiveTab("properties") }]
          : [
              { label: "属性", active: activeTab === "properties", onClick: () => setActiveTab("properties") },
              { label: "姿势", active: activeTab === "pose", onClick: () => setActiveTab("pose") },
              { label: "动作", active: activeTab === "animation", onClick: () => setActiveTab("animation") },
            ]
      }
    >
      {activeTab === "properties" ? (
        <>
          <InspectorTextField
            label="名称"
            ariaLabel="角色名称"
            value={selection.name}
            onChange={(value) => {
              if (isCrowd && selection.crowdId) {
                updateCrowdLabel(selection.crowdId, value);
                return;
              }

              updateObjectName(role.id, value);
            }}
          />
          <InspectorAxisGroup
            label="位置"
            axes={[
              {
                axis: "X",
                ariaLabel: "角色位置 X",
                value: transform.position[0],
                onChange: (value) =>
                  isCrowd && selection.crowdId
                    ? updateCrowdTransform(selection.crowdId, {
                        position: replaceAxis(transform.position, 0, Number(value)),
                      })
                    : updateObjectTransform(role.id, {
                        position: replaceAxis(transform.position, 0, Number(value)),
                      }),
              },
              {
                axis: "Y",
                ariaLabel: "角色位置 Y",
                value: transform.position[1],
                onChange: (value) =>
                  isCrowd && selection.crowdId
                    ? updateCrowdTransform(selection.crowdId, {
                        position: replaceAxis(transform.position, 1, Number(value)),
                      })
                    : updateObjectTransform(role.id, {
                        position: replaceAxis(transform.position, 1, Number(value)),
                      }),
              },
              {
                axis: "Z",
                ariaLabel: "角色位置 Z",
                value: transform.position[2],
                onChange: (value) =>
                  isCrowd && selection.crowdId
                    ? updateCrowdTransform(selection.crowdId, {
                        position: replaceAxis(transform.position, 2, Number(value)),
                      })
                    : updateObjectTransform(role.id, {
                        position: replaceAxis(transform.position, 2, Number(value)),
                      }),
              },
            ]}
          />
          <InspectorAxisGroup
            label="旋转"
            axes={[
              {
                axis: "X",
                ariaLabel: "角色旋转 X",
                value: transform.rotation[0],
                onChange: (value) =>
                  isCrowd && selection.crowdId
                    ? updateCrowdTransform(selection.crowdId, {
                        rotation: replaceAxis(transform.rotation, 0, Number(value)),
                      })
                    : updateObjectTransform(role.id, {
                        rotation: replaceAxis(transform.rotation, 0, Number(value)),
                      }),
              },
              {
                axis: "Y",
                ariaLabel: "角色旋转 Y",
                value: transform.rotation[1],
                onChange: (value) =>
                  isCrowd && selection.crowdId
                    ? updateCrowdTransform(selection.crowdId, {
                        rotation: replaceAxis(transform.rotation, 1, Number(value)),
                      })
                    : updateObjectTransform(role.id, {
                        rotation: replaceAxis(transform.rotation, 1, Number(value)),
                      }),
              },
              {
                axis: "Z",
                ariaLabel: "角色旋转 Z",
                value: transform.rotation[2],
                onChange: (value) =>
                  isCrowd && selection.crowdId
                    ? updateCrowdTransform(selection.crowdId, {
                        rotation: replaceAxis(transform.rotation, 2, Number(value)),
                      })
                    : updateObjectTransform(role.id, {
                        rotation: replaceAxis(transform.rotation, 2, Number(value)),
                      }),
              },
            ]}
          />
          <InspectorAxisGroup
            label="缩放"
            axes={[
              {
                axis: "X",
                ariaLabel: "角色缩放 X",
                step: "0.01",
                value: transform.scale[0],
                onChange: (value) =>
                  isCrowd && selection.crowdId
                    ? updateCrowdTransform(selection.crowdId, {
                        scale: replaceAxis(transform.scale, 0, Number(value)),
                      })
                    : updateObjectTransform(role.id, {
                        scale: replaceAxis(transform.scale, 0, Number(value)),
                      }),
              },
              {
                axis: "Y",
                ariaLabel: "角色缩放 Y",
                step: "0.01",
                value: transform.scale[1],
                onChange: (value) =>
                  isCrowd && selection.crowdId
                    ? updateCrowdTransform(selection.crowdId, {
                        scale: replaceAxis(transform.scale, 1, Number(value)),
                      })
                    : updateObjectTransform(role.id, {
                        scale: replaceAxis(transform.scale, 1, Number(value)),
                      }),
              },
              {
                axis: "Z",
                ariaLabel: "角色缩放 Z",
                step: "0.01",
                value: transform.scale[2],
                onChange: (value) =>
                  isCrowd && selection.crowdId
                    ? updateCrowdTransform(selection.crowdId, {
                        scale: replaceAxis(transform.scale, 2, Number(value)),
                      })
                    : updateObjectTransform(role.id, {
                        scale: replaceAxis(transform.scale, 2, Number(value)),
                      }),
              },
            ]}
          />
          <InspectorRangeNumberField
            label="统一缩放"
            rangeAriaLabel="角色统一缩放滑杆"
            numberAriaLabel="角色统一缩放"
            max="3"
            min="0.2"
            step="0.01"
            value={transform.scale[0]}
            onValueChange={(value) =>
              isCrowd && selection.crowdId
                ? updateCrowdUniformScale(selection.crowdId, Number(value))
                : updateUniformScale(role.id, Number(value))
            }
          />
          <InspectorColorField
            label="颜色"
            colorAriaLabel="角色颜色"
            hexAriaLabel="角色颜色 HEX"
            value={roleColor}
            onColorChange={(value) =>
              isCrowd && selection.crowdId ? updateCrowdColor(selection.crowdId, value) : updateObjectColor(role.id, value)
            }
            onHexChange={(value) =>
              isCrowd && selection.crowdId ? updateCrowdColor(selection.crowdId, value) : updateObjectColor(role.id, value)
            }
          />
          <InspectorSelectField
            label="体型"
            ariaLabel="角色体型"
            value={role.bodyType ?? "mannequin"}
            options={BODY_TYPE_OPTIONS.map((opt) => ({ value: opt.bodyType, label: opt.label }))}
            onChange={(value) =>
              isCrowd && selection.crowdId
                ? updateCrowdBodyType(selection.crowdId, value as CharacterBodyType)
                : updateCharacterBodyType(role.id, value as CharacterBodyType)
            }
          />
        </>
      ) : activeTab === "pose" ? (
        <InspectorSection title="姿势预设" className="pose-preset-section">
          {role.characterRig ? (
            <>
              <div className="preset-grid">
                {MANNEQUIN_POSE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    className={role.characterRig?.posePresetId === preset.id ? "is-active" : undefined}
                    type="button"
                    onClick={() =>
                      isCrowd && selection.crowdId
                        ? applyCrowdPosePreset(selection.crowdId, preset.id)
                        : applyPosePreset(role.id, preset.id)
                    }
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <InspectorSection title="姿势调节" className="pose-adjust-section">
                <div className="pose-groups">
                  {poseGroups.map((group) => (
                    <section key={group.title} className="pose-group">
                      <h4>{group.title}</h4>
                      {group.controls.map((control) => (
                        <InspectorRangeNumberField
                          key={control.key}
                          label={control.label}
                          rangeAriaLabel={`${group.title} · ${control.label} 滑杆`}
                          numberAriaLabel={`${group.title} · ${control.label}`}
                          max="90"
                          min="-90"
                          step="1"
                          value={role.characterRig?.controls[control.key] ?? 0}
                          onValueChange={(value) =>
                            isCrowd && selection.crowdId
                              ? updateCrowdPoseControl(selection.crowdId, control.key, Number(value))
                              : updatePoseControl(role.id, control.key, Number(value))
                          }
                        />
                      ))}
                    </section>
                  ))}
                </div>
              </InspectorSection>
            </>
          ) : (
            <p>该模型未识别到标准 humanoid 骨骼，暂不支持姿势编辑。</p>
          )}
        </InspectorSection>
      ) : (
        <InspectorSection title="动态动作库" className="animation-preset-section">
          {role.characterRig ? (
            <>
              <div className="preset-grid">
                {ANIMATION_LIST.map((anim) => (
                  <button
                    key={anim.id}
                    className={role.characterRig?.activeAnimationId === anim.id ? "is-active" : undefined}
                    type="button"
                    onClick={() =>
                      isCrowd && selection.crowdId
                        ? updateCrowdAnimation(selection.crowdId, anim.id)
                        : updateCharacterAnimation(role.id, anim.id)
                    }
                  >
                    {anim.name}
                  </button>
                ))}
              </div>

              {role.characterRig?.activeAnimationId && (
                <div className="mt-[26px] flex gap-3">
                  <button
                    className={`flex-1 char-control-btn ${
                      role.characterRig?.isAnimationPaused
                        ? "char-control-btn-play"
                        : "char-control-btn-pause"
                    }`}
                    type="button"
                    onClick={() =>
                      isCrowd && selection.crowdId
                        ? toggleCrowdAnimationPause(selection.crowdId)
                        : toggleCharacterAnimationPause(role.id)
                    }
                  >
                    {role.characterRig?.isAnimationPaused ? (
                      <>
                        <Play size={14} />
                        <span>继续播放</span>
                      </>
                    ) : (
                      <>
                        <Pause size={14} />
                        <span>停止播放</span>
                      </>
                    )}
                  </button>
                  <button
                    className="flex-1 char-control-btn char-control-btn-reset"
                    type="button"
                    onClick={() => {
                      if (isCrowd && selection.crowdId) {
                        updateCrowdAnimation(selection.crowdId, null);
                        updateCrowdTransform(selection.crowdId, { position: [0, 0, 0] });
                      } else {
                        updateCharacterAnimation(role.id, null);
                        updateObjectTransform(role.id, { position: [0, 0, 0] });
                      }
                    }}
                  >
                    <RotateCcw size={14} />
                    <span>恢复静态姿势</span>
                  </button>
                </div>
              )}
            </>
          ) : (
            <p className="text-xs text-gray-400">该模型未识别到标准 humanoid 骨骼，暂不支持动作库播放。</p>
          )}
        </InspectorSection>
      )}
    </InspectorPanel>
  );
}
