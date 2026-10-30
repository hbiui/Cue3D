import { useLayoutEffect, useMemo, useEffect, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import {
  AnimationMixer,
  Box3,
  Color,
  Group,
  Matrix4,
  MeshStandardMaterial,
  Vector3,
  type Material,
  type Object3D,
  type SkinnedMesh,
} from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { CharacterRigState } from "../schema/directorProject";
import { VIEWPORT_OBJECT_LABEL_VERTICAL_GAP } from "../schema/viewportLabels";
import type { CharacterBodyType } from "./mannequin/bodyTypes";
import {
  UE4_MANNEQUIN_MODEL_URL,
  getUE4ModelScale,
} from "./ue4Mannequin/ue4MannequinRig";
import { applyUE4RestPoseAndRig, captureUE4RestPose } from "./ue4Mannequin/ue4MannequinPoseApplication";
import { createMannequinAnimations } from "./ue4Mannequin/ue4Animations";

interface UE4MannequinModelProps {
  bodyType?: CharacterBodyType;
  color?: string;
  onLabelAnchorYChange?: (anchorY: number) => void;
  rigState?: CharacterRigState;
}

interface LoadedGLTF {
  scene: Group;
  animations: unknown[];
}

function isSkinnedMesh(object: Object3D): object is SkinnedMesh {
  return "isSkinnedMesh" in object && object.isSkinnedMesh === true;
}

function tintMaterial(material: Material | Material[], color: string) {
  const materials = Array.isArray(material) ? material : [material];
  const nextColor = new Color(color);

  materials.forEach((item) => {
    if (item instanceof MeshStandardMaterial && item.name !== "SK_Mannequin_M_UE4Man_ChestLogo") {
      item.color.copy(nextColor);
      item.roughness = 0.68;
      item.metalness = 0.04;
      item.needsUpdate = true;
    }
  });
}

function cloneMaterialInstance(material: Material | Material[]) {
  return Array.isArray(material) ? material.map((item) => item.clone()) : material.clone();
}

export function isolateAndTintUE4MannequinMaterials(scene: Object3D, color: string) {
  scene.traverse((object) => {
    object.frustumCulled = false;

    if (isSkinnedMesh(object)) {
      object.castShadow = true;
      object.receiveShadow = true;

      if (!object.userData.storyAiIsolatedMaterial) {
        object.material = cloneMaterialInstance(object.material);
        object.userData.storyAiIsolatedMaterial = true;
      }

      tintMaterial(object.material, color);
    }
  });
}

function getBoundsInParentLocal(object: Object3D) {
  (object.parent ?? object).updateMatrixWorld(true);

  const worldBounds = new Box3().setFromObject(object, true);
  if (!object.parent || worldBounds.isEmpty()) return worldBounds;

  const parentInverse = new Matrix4().copy(object.parent.matrixWorld).invert();
  const bounds = new Box3().makeEmpty();
  const vertex = new Vector3();
  const xValues = [worldBounds.min.x, worldBounds.max.x];
  const yValues = [worldBounds.min.y, worldBounds.max.y];
  const zValues = [worldBounds.min.z, worldBounds.max.z];

  xValues.forEach((x) => {
    yValues.forEach((y) => {
      zValues.forEach((z) => {
        vertex.set(x, y, z).applyMatrix4(parentInverse);
        bounds.expandByPoint(vertex);
      });
    });
  });

  return bounds;
}

export function alignUE4MannequinToGround(scene: Object3D) {
  const rootX = scene.position.x;
  const rootZ = scene.position.z;

  function measureBoundsInParentLocal() {
    return getBoundsInParentLocal(scene);
  }

  scene.position.set(rootX, 0, rootZ);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const bounds = measureBoundsInParentLocal();
    const correctionY = bounds.isEmpty() || !Number.isFinite(bounds.min.y) ? 0 : -bounds.min.y;

    if (Math.abs(correctionY) < 0.00001) break;

    scene.position.set(rootX, scene.position.y + correctionY, rootZ);
  }

  scene.position.set(rootX, scene.position.y, rootZ);
  (scene.parent ?? scene).updateMatrixWorld(true);

  return scene.position.y;
}

export function UE4MannequinModel({
  bodyType = "mannequin",
  color = "#F3F5F7",
  onLabelAnchorYChange,
  rigState,
}: UE4MannequinModelProps) {
  const gltf = useGLTF(UE4_MANNEQUIN_MODEL_URL) as LoadedGLTF;
  const scene = useMemo(() => cloneSkeleton(gltf.scene) as Group, [gltf.scene]);
  const restPose = useMemo(() => captureUE4RestPose(scene), [scene]);
  const modelScale = getUE4ModelScale(bodyType);

  const mixerRef = useRef<AnimationMixer | null>(null);
  const activeAnimationId = rigState?.activeAnimationId;

  useLayoutEffect(() => {
    isolateAndTintUE4MannequinMaterials(scene, color);

    if (!activeAnimationId) {
      applyUE4RestPoseAndRig(scene, {
        bodyType,
        controls: rigState?.controls ?? {},
        restPose,
      });
      alignUE4MannequinToGround(scene);
    } else {
      applyUE4RestPoseAndRig(scene, {
        bodyType,
        controls: {},
        restPose,
      });
      alignUE4MannequinToGround(scene);
    }

    const modelRoot = scene.parent ?? scene;
    const bounds = getBoundsInParentLocal(modelRoot);
    const labelAnchorY = bounds.max.y + VIEWPORT_OBJECT_LABEL_VERTICAL_GAP;

    if (Number.isFinite(labelAnchorY)) {
      onLabelAnchorYChange?.(Number(labelAnchorY.toFixed(4)));
    }
  }, [bodyType, color, onLabelAnchorYChange, restPose, rigState?.controls, scene, activeAnimationId]);

  useEffect(() => {
    if (!scene) return;

    if (!mixerRef.current) {
      mixerRef.current = new AnimationMixer(scene);
    }

    const mixer = mixerRef.current;

    if (activeAnimationId) {
      mixer.stopAllAction();
      const clips = createMannequinAnimations(restPose, rigState?.isAnimationInPlace);
      const clip = clips[activeAnimationId];
      if (clip) {
        const action = mixer.clipAction(clip);
        action.play();
      }
    } else {
      mixer.stopAllAction();
      applyUE4RestPoseAndRig(scene, {
        bodyType,
        controls: rigState?.controls ?? {},
        restPose,
      });
      alignUE4MannequinToGround(scene);
    }

    return () => {
      mixer.stopAllAction();
    };
  }, [activeAnimationId, scene, bodyType, restPose, rigState?.controls, rigState?.isAnimationInPlace]);

  useFrame((state, delta) => {
    if (activeAnimationId && mixerRef.current) {
      if (!rigState?.isAnimationPaused) {
        mixerRef.current.update(delta);
      }

      const modelRoot = scene.parent ?? scene;
      const bounds = getBoundsInParentLocal(modelRoot);
      const labelAnchorY = bounds.max.y + VIEWPORT_OBJECT_LABEL_VERTICAL_GAP;

      if (Number.isFinite(labelAnchorY)) {
        onLabelAnchorYChange?.(Number(labelAnchorY.toFixed(4)));
      }
    }
  });

  return (
    <group name={`ue-retopology-mannequin-${bodyType}`} scale={modelScale}>
      <primitive object={scene} />
    </group>
  );
}

useGLTF.preload(UE4_MANNEQUIN_MODEL_URL);
