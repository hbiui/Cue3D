import { Quaternion, Euler, QuaternionKeyframeTrack, AnimationClip, VectorKeyframeTrack } from "three";
import { UE4_MANNEQUIN_BONE_MAP, getUE4NeutralPoseBoneRotations } from "./ue4MannequinRig";
import type { UE4RestPose } from "./ue4MannequinPoseApplication";

const neutralRotations = getUE4NeutralPoseBoneRotations();

function makeQuatTrack(
  boneName: string,
  times: number[],
  degreeEulerAngles: [number, number, number][],
  restPose?: UE4RestPose
) {
  const values: number[] = [];
  const rest = restPose?.[boneName];

  degreeEulerAngles.forEach(([xDeg, yDeg, zDeg]) => {
    const q = new Quaternion();
    
    // 1. Start from the bone's actual GLTF rest pose quaternion if available
    if (rest) {
      q.set(rest.quaternion[0], rest.quaternion[1], rest.quaternion[2], rest.quaternion[3]);
    }

    // 2. Apply neutral rotation if any (e.g. upper arm T-pose to A-pose offset)
    const neutral = neutralRotations[boneName];
    if (neutral) {
      q.multiply(new Quaternion().setFromEuler(new Euler(neutral[0], neutral[1], neutral[2])));
    }

    // 3. Apply animated rotation
    // In our coordinate space:
    // xDeg = Twist/Yaw (X-axis)
    // yDeg = Spread/Roll (Y-axis)
    // zDeg = Pitch/Bend (Z-axis)
    const twistRad = (xDeg * Math.PI) / 180;
    const spreadRad = (yDeg * Math.PI) / 180;
    const pitchRad = (zDeg * Math.PI) / 180;

    q.multiply(new Quaternion().setFromEuler(new Euler(twistRad, spreadRad, pitchRad)));

    values.push(q.x, q.y, q.z, q.w);
  });

  return new QuaternionKeyframeTrack(`${boneName}.quaternion`, times, values);
}

function originalMakePosTrack(
  boneName: string,
  times: number[],
  positions: [number, number, number][], // in meters, relative to rest position
  restPose?: UE4RestPose,
  inPlace?: boolean
) {
  const values: number[] = [];
  const rest = restPose?.[boneName];
  const scaleFactor = 1 / 0.0254; // BIP001_LOCAL_UNITS_PER_WORLD_METER

  positions.forEach(([offsetX, offsetY, offsetZ]) => {
    const restX = rest ? rest.position[0] : 0;
    const restY = rest ? rest.position[1] : 0;
    const restZ = rest ? rest.position[2] : 0;

    // For pelvis / body bone, if inPlace is true, we ignore horizontal (sideways/forward) displacement offsets
    const effOffsetX = (inPlace && boneName === UE4_MANNEQUIN_BONE_MAP.body) ? 0 : offsetX;
    const effOffsetY = (inPlace && boneName === UE4_MANNEQUIN_BONE_MAP.body) ? 0 : offsetY;

    // Apply offset relative to the rest position in bone space
    values.push(
      restX + effOffsetX * scaleFactor,
      restY + effOffsetY * scaleFactor,
      restZ + offsetZ * scaleFactor
    );
  });

  return new VectorKeyframeTrack(`${boneName}.position`, times, values);
}

export const ANIMATION_LIST = [
  { id: "walk", name: "走路" },
  { id: "walk-forward", name: "向前走" },
  { id: "jog", name: "慢跑" },
  { id: "run", name: "快跑" },
  { id: "run-forward", name: "向前跑" },
  { id: "jump", name: "跳跃" },
  { id: "crouch", name: "蹲下" },
  { id: "sit", name: "坐下" },
  { id: "combat", name: "战斗" },
  { id: "turn-left", name: "左转身" },
  { id: "turn-right", name: "右转身" },
  { id: "jump-in-place", name: "原地跳" },
  { id: "jump-forward", name: "向前跳" },
  { id: "climb", name: "攀爬" },
  { id: "climb-obstacle", name: "跨越障碍" },
  { id: "wave", name: "打招呼" },
];

export function createMannequinAnimations(restPose?: UE4RestPose, inPlace?: boolean): Record<string, AnimationClip> {
  const bones = UE4_MANNEQUIN_BONE_MAP;
  const clips: Record<string, AnimationClip> = {};

  const makePosTrack = (
    boneName: string,
    times: number[],
    positions: [number, number, number][],
    rp?: UE4RestPose
  ) => {
    return originalMakePosTrack(boneName, times, positions, rp, inPlace);
  };

  // 1. Walk (走路)
  {
    const times = [0, 0.25, 0.5, 0.75, 1.0];
    clips["walk"] = new AnimationClip("walk", 1.0, [
      makeQuatTrack(bones.leftHip, times, [[0, 0, -20], [0, 0, 0], [0, 0, 20], [0, 0, 0], [0, 0, -20]], restPose),
      makeQuatTrack(bones.rightHip, times, [[0, 0, 20], [0, 0, 0], [0, 0, -20], [0, 0, 0], [0, 0, 20]], restPose),
      makeQuatTrack(bones.leftKnee, times, [[0, 0, -5], [0, 0, -45], [0, 0, -5], [0, 0, -15], [0, 0, -5]], restPose),
      makeQuatTrack(bones.rightKnee, times, [[0, 0, -5], [0, 0, -15], [0, 0, -5], [0, 0, -45], [0, 0, -5]], restPose),
      makeQuatTrack(bones.leftShoulder, times, [[0, 0, -20], [0, 0, 0], [0, 0, 20], [0, 0, 0], [0, 0, -20]], restPose),
      makeQuatTrack(bones.rightShoulder, times, [[0, 0, 20], [0, 0, 0], [0, 0, -20], [0, 0, 0], [0, 0, 20]], restPose),
      makeQuatTrack(bones.leftElbow, times, [[0, 0, -25], [0, 0, -35], [0, 0, -25], [0, 0, -15], [0, 0, -25]], restPose),
      makeQuatTrack(bones.rightElbow, times, [[0, 0, -25], [0, 0, -15], [0, 0, -25], [0, 0, -35], [0, 0, -25]], restPose),
      makePosTrack(bones.body, times, [[0, 0, -0.05], [0, 0, 0], [0, 0, -0.05], [0, 0, 0], [0, 0, -0.05]], restPose),
    ]);
  }

  // 1b. Walk Forward (向前走)
  {
    const times = [0, 0.25, 0.5, 0.75, 1.0];
    clips["walk-forward"] = new AnimationClip("walk-forward", 1.0, [
      makeQuatTrack(bones.leftHip, times, [[0, 0, -20], [0, 0, 0], [0, 0, 20], [0, 0, 0], [0, 0, -20]], restPose),
      makeQuatTrack(bones.rightHip, times, [[0, 0, 20], [0, 0, 0], [0, 0, -20], [0, 0, 0], [0, 0, 20]], restPose),
      makeQuatTrack(bones.leftKnee, times, [[0, 0, -5], [0, 0, -45], [0, 0, -5], [0, 0, -15], [0, 0, -5]], restPose),
      makeQuatTrack(bones.rightKnee, times, [[0, 0, -5], [0, 0, -15], [0, 0, -5], [0, 0, -45], [0, 0, -5]], restPose),
      makeQuatTrack(bones.leftShoulder, times, [[0, 0, -20], [0, 0, 0], [0, 0, 20], [0, 0, 0], [0, 0, -20]], restPose),
      makeQuatTrack(bones.rightShoulder, times, [[0, 0, 20], [0, 0, 0], [0, 0, -20], [0, 0, 0], [0, 0, 20]], restPose),
      makeQuatTrack(bones.leftElbow, times, [[0, 0, -25], [0, 0, -35], [0, 0, -25], [0, 0, -15], [0, 0, -25]], restPose),
      makeQuatTrack(bones.rightElbow, times, [[0, 0, -25], [0, 0, -15], [0, 0, -25], [0, 0, -35], [0, 0, -25]], restPose),
      makePosTrack(bones.body, times, [[0, 0, -0.05], [0, 0, 0], [0, 0, -0.05], [0, 0, 0], [0, 0, -0.05]], restPose),
    ]);
  }

  // 2. Jog (慢跑)
  {
    const times = [0, 0.2, 0.4, 0.6, 0.8];
    clips["jog"] = new AnimationClip("jog", 0.8, [
      makeQuatTrack(bones.leftHip, times, [[0, 0, -30], [0, 0, 0], [0, 0, 30], [0, 0, 0], [0, 0, -30]], restPose),
      makeQuatTrack(bones.rightHip, times, [[0, 0, 30], [0, 0, 0], [0, 0, -30], [0, 0, 0], [0, 0, 30]], restPose),
      makeQuatTrack(bones.leftKnee, times, [[0, 0, -10], [0, 0, -50], [0, 0, -10], [0, 0, -20], [0, 0, -10]], restPose),
      makeQuatTrack(bones.rightKnee, times, [[0, 0, -10], [0, 0, -20], [0, 0, -10], [0, 0, -50], [0, 0, -10]], restPose),
      makeQuatTrack(bones.leftShoulder, times, [[0, 0, -35], [0, 0, 0], [0, 0, 35], [0, 0, 0], [0, 0, -35]], restPose),
      makeQuatTrack(bones.rightShoulder, times, [[0, 0, 35], [0, 0, 0], [0, 0, -35], [0, 0, 0], [0, 0, 35]], restPose),
      makeQuatTrack(bones.leftElbow, times, [[0, 0, -40], [0, 0, -60], [0, 0, -40], [0, 0, -30], [0, 0, -40]], restPose),
      makeQuatTrack(bones.rightElbow, times, [[0, 0, -40], [0, 0, -30], [0, 0, -40], [0, 0, -60], [0, 0, -40]], restPose),
      makePosTrack(bones.body, times, [[0, 0, -0.08], [0, 0, 0], [0, 0, -0.08], [0, 0, 0], [0, 0, -0.08]], restPose),
    ]);
  }

  // 3. Run (快跑)
  {
    const times = [0, 0.15, 0.3, 0.45, 0.6];
    clips["run"] = new AnimationClip("run", 0.6, [
      makeQuatTrack(bones.leftHip, times, [[0, 0, -45], [0, 0, 0], [0, 0, 45], [0, 0, 0], [0, 0, -45]], restPose),
      makeQuatTrack(bones.rightHip, times, [[0, 0, 45], [0, 0, 0], [0, 0, -45], [0, 0, 0], [0, 0, 45]], restPose),
      makeQuatTrack(bones.leftKnee, times, [[0, 0, -15], [0, 0, -70], [0, 0, -15], [0, 0, -30], [0, 0, -15]], restPose),
      makeQuatTrack(bones.rightKnee, times, [[0, 0, -15], [0, 0, -30], [0, 0, -15], [0, 0, -70], [0, 0, -15]], restPose),
      makeQuatTrack(bones.leftShoulder, times, [[0, 0, -50], [0, 0, 0], [0, 0, 50], [0, 0, 0], [0, 0, -50]], restPose),
      makeQuatTrack(bones.rightShoulder, times, [[0, 0, 50], [0, 0, 0], [0, 0, -50], [0, 0, 0], [0, 0, 50]], restPose),
      makeQuatTrack(bones.leftElbow, times, [[0, 0, -55], [0, 0, -85], [0, 0, -55], [0, 0, -40], [0, 0, -55]], restPose),
      makeQuatTrack(bones.rightElbow, times, [[0, 0, -55], [0, 0, -40], [0, 0, -55], [0, 0, -85], [0, 0, -55]], restPose),
      makePosTrack(bones.body, times, [[0, 0, -0.12], [0, 0, 0], [0, 0, -0.12], [0, 0, 0], [0, 0, -0.12]], restPose),
    ]);
  }

  // 3b. Run Forward (向前跑)
  {
    const times = [0, 0.15, 0.3, 0.45, 0.6];
    clips["run-forward"] = new AnimationClip("run-forward", 0.6, [
      makeQuatTrack(bones.leftHip, times, [[0, 0, -45], [0, 0, 0], [0, 0, 45], [0, 0, 0], [0, 0, -45]], restPose),
      makeQuatTrack(bones.rightHip, times, [[0, 0, 45], [0, 0, 0], [0, 0, -45], [0, 0, 0], [0, 0, 45]], restPose),
      makeQuatTrack(bones.leftKnee, times, [[0, 0, -15], [0, 0, -70], [0, 0, -15], [0, 0, -30], [0, 0, -15]], restPose),
      makeQuatTrack(bones.rightKnee, times, [[0, 0, -15], [0, 0, -30], [0, 0, -15], [0, 0, -70], [0, 0, -15]], restPose),
      makeQuatTrack(bones.leftShoulder, times, [[0, 0, -50], [0, 0, 0], [0, 0, 50], [0, 0, 0], [0, 0, -50]], restPose),
      makeQuatTrack(bones.rightShoulder, times, [[0, 0, 50], [0, 0, 0], [0, 0, -50], [0, 0, 0], [0, 0, 50]], restPose),
      makeQuatTrack(bones.leftElbow, times, [[0, 0, -55], [0, 0, -85], [0, 0, -55], [0, 0, -40], [0, 0, -55]], restPose),
      makeQuatTrack(bones.rightElbow, times, [[0, 0, -55], [0, 0, -40], [0, 0, -55], [0, 0, -85], [0, 0, -55]], restPose),
      makePosTrack(bones.body, times, [[0, 0, -0.12], [0, 0, 0], [0, 0, -0.12], [0, 0, 0], [0, 0, -0.12]], restPose),
    ]);
  }

  // 4. Jump (跳跃)
  {
    const times = [0, 0.3, 0.6, 0.9, 1.2, 1.5];
    clips["jump"] = new AnimationClip("jump", 1.5, [
      makeQuatTrack(bones.leftHip, times, [[0, 0, 0], [0, 0, 40], [0, 0, 50], [0, 0, 55], [0, 0, 45], [0, 0, 0]], restPose),
      makeQuatTrack(bones.rightHip, times, [[0, 0, 0], [0, 0, 40], [0, 0, 50], [0, 0, 55], [0, 0, 45], [0, 0, 0]], restPose),
      makeQuatTrack(bones.leftKnee, times, [[0, 0, -5], [0, 0, -60], [0, 0, -75], [0, 0, -80], [0, 0, -65], [0, 0, -5]], restPose),
      makeQuatTrack(bones.rightKnee, times, [[0, 0, -5], [0, 0, -60], [0, 0, -75], [0, 0, -80], [0, 0, -65], [0, 0, -5]], restPose),
      makeQuatTrack(bones.leftShoulder, times, [[0, 0, 0], [0, 0, 20], [0, 0, -90], [0, 0, -60], [0, 0, 10], [0, 0, 0]], restPose),
      makeQuatTrack(bones.rightShoulder, times, [[0, 0, 0], [0, 0, 20], [0, 0, -90], [0, 0, -60], [0, 0, 10], [0, 0, 0]], restPose),
      makePosTrack(bones.body, times, [[0, 0, 0], [0, 0, -0.2], [0, 0, 0.4], [0, 0, 0.8], [0, 0, -0.2], [0, 0, 0]], restPose),
    ]);
  }

  // 5. Crouch (蹲下)
  {
    const times = [0, 0.4, 0.8, 1.5, 2.2, 2.6, 3.0];
    clips["crouch"] = new AnimationClip("crouch", 3.0, [
      makeQuatTrack(bones.leftHip, times, [[0, 0, 0], [0, 0, 55], [0, 0, 115], [0, 0, 120], [0, 0, 115], [0, 0, 55], [0, 0, 0]], restPose),
      makeQuatTrack(bones.rightHip, times, [[0, 0, 0], [0, 0, 55], [0, 0, 115], [0, 0, 120], [0, 0, 115], [0, 0, 55], [0, 0, 0]], restPose),
      makeQuatTrack(bones.leftKnee, times, [[0, 0, 0], [0, 0, -65], [0, 0, -130], [0, 0, -135], [0, 0, -130], [0, 0, -65], [0, 0, 0]], restPose),
      makeQuatTrack(bones.rightKnee, times, [[0, 0, 0], [0, 0, -65], [0, 0, -130], [0, 0, -135], [0, 0, -130], [0, 0, -65], [0, 0, 0]], restPose),
      makeQuatTrack(bones.leftShoulder, times, [[0, 0, 0], [0, 0, -10], [0, 0, -20], [0, 0, -22], [0, 0, -20], [0, 0, -10], [0, 0, 0]], restPose),
      makeQuatTrack(bones.rightShoulder, times, [[0, 0, 0], [0, 0, -10], [0, 0, -20], [0, 0, -22], [0, 0, -20], [0, 0, -10], [0, 0, 0]], restPose),
      makePosTrack(bones.body, times, [[0, 0, 0], [0, 0, -0.4], [0, 0, -0.85], [0, 0, -0.88], [0, 0, -0.85], [0, 0, -0.4], [0, 0, 0]], restPose),
    ]);
  }

  // 6. Sit (坐下)
  {
    const times = [0, 0.4, 0.8, 1.5, 2.2, 2.6, 3.0];
    clips["sit"] = new AnimationClip("sit", 3.0, [
      makeQuatTrack(bones.leftHip, times, [[0, 0, 0], [0, 0, 45], [0, 0, 90], [0, 0, 92], [0, 0, 90], [0, 0, 45], [0, 0, 0]], restPose),
      makeQuatTrack(bones.rightHip, times, [[0, 0, 0], [0, 0, 45], [0, 0, 90], [0, 0, 92], [0, 0, 90], [0, 0, 45], [0, 0, 0]], restPose),
      makeQuatTrack(bones.leftKnee, times, [[0, 0, 0], [0, 0, -45], [0, 0, -90], [0, 0, -92], [0, 0, -90], [0, 0, -45], [0, 0, 0]], restPose),
      makeQuatTrack(bones.rightKnee, times, [[0, 0, 0], [0, 0, -45], [0, 0, -90], [0, 0, -92], [0, 0, -90], [0, 0, -45], [0, 0, 0]], restPose),
      makeQuatTrack(bones.leftShoulder, times, [[0, 0, 0], [0, 5, -8], [0, 10, -15], [0, 11, -16], [0, 10, -15], [0, 5, -8], [0, 0, 0]], restPose),
      makeQuatTrack(bones.rightShoulder, times, [[0, 0, 0], [0, -5, -8], [0, -10, -15], [0, -11, -16], [0, -10, -15], [0, -5, -8], [0, 0, 0]], restPose),
      makePosTrack(bones.body, times, [[0, 0, 0], [0, 0, -0.37], [0, 0, -0.75], [0, 0, -0.76], [0, 0, -0.75], [0, 0, -0.37], [0, 0, 0]], restPose),
    ]);
  }

  // 7. Combat (战斗)
  {
    const times = [0, 0.2, 0.4, 0.6, 0.8, 1.2];
    clips["combat"] = new AnimationClip("combat", 1.2, [
      makeQuatTrack(bones.leftHip, times, [[0, 0, -10], [0, 0, -15], [0, 0, -10], [0, 0, -10], [0, 0, -10], [0, 0, -10]], restPose),
      makeQuatTrack(bones.rightHip, times, [[0, 0, 10], [0, 0, 10], [0, 0, 10], [0, 0, 15], [0, 0, 10], [0, 0, 10]], restPose),
      makeQuatTrack(bones.leftKnee, times, [[0, 0, -20], [0, 0, -25], [0, 0, -20], [0, 0, -20], [0, 0, -20], [0, 0, -20]], restPose),
      makeQuatTrack(bones.rightKnee, times, [[0, 0, -20], [0, 0, -20], [0, 0, -20], [0, 0, -25], [0, 0, -20], [0, 0, -20]], restPose),
      makeQuatTrack(bones.leftShoulder, times, [[0, 20, -45], [0, 5, -85], [0, 20, -45], [0, 20, -45], [0, 20, -45], [0, 20, -45]], restPose),
      makeQuatTrack(bones.rightShoulder, times, [[0, -20, -45], [0, -20, -45], [0, -20, -45], [0, -5, -85], [0, -20, -45], [0, -20, -45]], restPose),
      makeQuatTrack(bones.leftElbow, times, [[0, 0, -100], [0, 0, -10], [0, 0, -100], [0, 0, -100], [0, 0, -100], [0, 0, -100]], restPose),
      makeQuatTrack(bones.rightElbow, times, [[0, 0, -100], [0, 0, -100], [0, 0, -100], [0, 0, -10], [0, 0, -100], [0, 0, -100]], restPose),
      makeQuatTrack(bones.leftHand, times, [[0, 0, -20], [0, 0, -20], [0, 0, -20], [0, 0, -20], [0, 0, -20], [0, 0, -20]], restPose),
      makeQuatTrack(bones.rightHand, times, [[0, 0, -20], [0, 0, -20], [0, 0, -20], [0, 0, -20], [0, 0, -20], [0, 0, -20]], restPose),
      makeQuatTrack(bones.torso, times, [[0, 0, 5], [-20, 0, 5], [0, 0, 5], [30, 0, 5], [0, 0, 5], [0, 0, 5]], restPose),
      makePosTrack(bones.body, times, [[0, 0, -0.1], [0, 0, -0.12], [0, 0, -0.1], [0, 0, -0.12], [0, 0, -0.1], [0, 0, -0.1]], restPose),
    ]);
  }

  // 8. Turn Left (左转身)
  {
    const times = [0, 0.3, 0.6, 0.9, 1.2];
    clips["turn-left"] = new AnimationClip("turn-left", 1.2, [
      makeQuatTrack(bones.body, times, [[0, 0, 0], [22.5, 0, 0], [45, 0, 0], [67.5, 0, 0], [90, 0, 0]], restPose),
      makeQuatTrack(bones.leftHip, times, [[0, 0, 0], [0, 0, 25], [0, 0, 0], [0, 0, -10], [0, 0, 0]], restPose),
      makeQuatTrack(bones.rightHip, times, [[0, 0, 0], [0, 0, -10], [0, 0, 0], [0, 0, 25], [0, 0, 0]], restPose),
    ]);
  }

  // 9. Turn Right (右转身)
  {
    const times = [0, 0.3, 0.6, 0.9, 1.2];
    clips["turn-right"] = new AnimationClip("turn-right", 1.2, [
      makeQuatTrack(bones.body, times, [[0, 0, 0], [-22.5, 0, 0], [-45, 0, 0], [-67.5, 0, 0], [-90, 0, 0]], restPose),
      makeQuatTrack(bones.leftHip, times, [[0, 0, 0], [0, 0, -10], [0, 0, 0], [0, 0, 25], [0, 0, 0]], restPose),
      makeQuatTrack(bones.rightHip, times, [[0, 0, 0], [0, 0, 25], [0, 0, 0], [0, 0, -10], [0, 0, 0]], restPose),
    ]);
  }

  // 10. Jump In Place (原地跳)
  {
    const times = [0, 0.2, 0.5, 0.8, 1.0, 1.2];
    clips["jump-in-place"] = new AnimationClip("jump-in-place", 1.2, [
      makeQuatTrack(bones.leftHip, times, [[0, 0, 0], [0, 0, 35], [0, 0, 45], [0, 0, 50], [0, 0, 35], [0, 0, 0]], restPose),
      makeQuatTrack(bones.rightHip, times, [[0, 0, 0], [0, 0, 35], [0, 0, 45], [0, 0, 50], [0, 0, 35], [0, 0, 0]], restPose),
      makeQuatTrack(bones.leftKnee, times, [[0, 0, 0], [0, 0, -50], [0, 0, -65], [0, 0, -75], [0, 0, -50], [0, 0, 0]], restPose),
      makeQuatTrack(bones.rightKnee, times, [[0, 0, 0], [0, 0, -50], [0, 0, -65], [0, 0, -75], [0, 0, -50], [0, 0, 0]], restPose),
      makePosTrack(bones.body, times, [[0, 0, 0], [0, 0, -0.15], [0, 0, 0.3], [0, 0, 0.5], [0, 0, -0.15], [0, 0, 0]], restPose),
    ]);
  }

  // 11. Jump Forward (向前跳)
  {
    const times = [0, 0.2, 0.5, 0.8, 1.1, 1.5];
    clips["jump-forward"] = new AnimationClip("jump-forward", 1.5, [
      makeQuatTrack(bones.leftHip, times, [[0, 0, 0], [0, 0, 35], [0, 0, 50], [0, 0, 55], [0, 0, 40], [0, 0, 0]], restPose),
      makeQuatTrack(bones.rightHip, times, [[0, 0, 0], [0, 0, 35], [0, 0, 50], [0, 0, 55], [0, 0, 40], [0, 0, 0]], restPose),
      makeQuatTrack(bones.leftKnee, times, [[0, 0, 0], [0, 0, -50], [0, 0, -70], [0, 0, -80], [0, 0, -55], [0, 0, 0]], restPose),
      makeQuatTrack(bones.rightKnee, times, [[0, 0, 0], [0, 0, -50], [0, 0, -70], [0, 0, -80], [0, 0, -55], [0, 0, 0]], restPose),
      makeQuatTrack(bones.leftShoulder, times, [[0, 0, 0], [0, 0, 30], [0, 0, -60], [0, 0, -40], [0, 0, 10], [0, 0, 0]], restPose),
      makeQuatTrack(bones.rightShoulder, times, [[0, 0, 0], [0, 0, 30], [0, 0, -60], [0, 0, -40], [0, 0, 10], [0, 0, 0]], restPose),
      makePosTrack(bones.body, times, [[0, 0, 0], [0.15, 0, -0.15], [0.7, 0, 0.4], [1.3, 0, 0.6], [1.7, 0, -0.15], [1.8, 0, 0]], restPose),
    ]);
  }

  // 14. Climb (攀爬)
  {
    const times = [0, 0.4, 0.8, 1.2, 1.6];
    clips["climb"] = new AnimationClip("climb", 1.6, [
      makeQuatTrack(bones.leftShoulder, times, [[0, 10, -120], [0, 10, -45], [0, 10, -30], [0, 10, -90], [0, 10, -120]], restPose),
      makeQuatTrack(bones.rightShoulder, times, [[0, -10, -30], [0, -10, -90], [0, -10, -120], [0, -10, -45], [0, -10, -30]], restPose),
      makeQuatTrack(bones.leftElbow, times, [[0, 0, -30], [0, 0, -90], [0, 0, -60], [0, 0, -40], [0, 0, -30]], restPose),
      makeQuatTrack(bones.rightElbow, times, [[0, 0, -60], [0, 0, -40], [0, 0, -30], [0, 0, -90], [0, 0, -60]], restPose),
      makeQuatTrack(bones.leftHip, times, [[0, 0, -10], [0, 0, 45], [0, 0, 10], [0, 0, -20], [0, 0, -10]], restPose),
      makeQuatTrack(bones.rightHip, times, [[0, 0, 10], [0, 0, -20], [0, 0, -10], [0, 0, 45], [0, 0, 10]], restPose),
      makeQuatTrack(bones.leftKnee, times, [[0, 0, -20], [0, 0, -90], [0, 0, -40], [0, 0, -10], [0, 0, -20]], restPose),
      makeQuatTrack(bones.rightKnee, times, [[0, 0, -40], [0, 0, -10], [0, 0, -20], [0, 0, -90], [0, 0, -40]], restPose),
      makePosTrack(bones.body, times, [[0, 0, 0.1], [0, 0, 0.2], [0, 0, 0.1], [0, 0, 0.0], [0, 0, 0.1]], restPose),
    ]);
  }

  // 15. Climb Obstacle (跨越障碍)
  {
    const times = [0, 0.3, 0.6, 0.9, 1.2, 1.5, 1.8];
    clips["climb-obstacle"] = new AnimationClip("climb-obstacle", 1.8, [
      makeQuatTrack(bones.leftShoulder, times, [[0, 0, -30], [0, 0, -60], [0, 0, -120], [0, 0, -90], [0, 0, -30], [0, 0, -10], [0, 0, 0]], restPose),
      makeQuatTrack(bones.rightShoulder, times, [[0, 0, -30], [0, 0, -60], [0, 0, -120], [0, 0, -90], [0, 0, -30], [0, 0, -10], [0, 0, 0]], restPose),
      makeQuatTrack(bones.leftElbow, times, [[0, 0, -20], [0, 0, -40], [0, 0, -80], [0, 0, -60], [0, 0, -30], [0, 0, -10], [0, 0, 0]], restPose),
      makeQuatTrack(bones.rightElbow, times, [[0, 0, -20], [0, 0, -40], [0, 0, -80], [0, 0, -60], [0, 0, -30], [0, 0, -10], [0, 0, 0]], restPose),
      makeQuatTrack(bones.leftHip, times, [[0, 0, 0], [0, 0, 30], [0, 0, 80], [0, 0, 45], [0, 0, -15], [0, 0, 10], [0, 0, 0]], restPose),
      makeQuatTrack(bones.rightHip, times, [[0, 0, 0], [0, 0, 10], [0, 0, 30], [0, 0, 80], [0, 0, 45], [0, 0, -15], [0, 0, 0]], restPose),
      makeQuatTrack(bones.leftKnee, times, [[0, 0, -10], [0, 0, -30], [0, 0, -100], [0, 0, -45], [0, 0, -15], [0, 0, -10], [0, 0, 0]], restPose),
      makeQuatTrack(bones.rightKnee, times, [[0, 0, -10], [0, 0, -10], [0, 0, -30], [0, 0, -100], [0, 0, -45], [0, 0, -15], [0, 0, 0]], restPose),
      makePosTrack(bones.body, times, [[0, 0, 0], [0, 0, 0.2], [0, 0, 0.5], [0, 0, 0.4], [0, 0, 0.1], [0, 0, 0.0], [0, 0, 0]], restPose),
    ]);
  }

  // 16. Wave (打招呼)
  {
    const times = [0, 0.2, 0.4, 0.6, 0.8, 1.0, 1.2, 1.4];
    clips["wave"] = new AnimationClip("wave", 1.4, [
      makeQuatTrack(bones.rightShoulder, times, [[0, 0, 0], [0, -30, -90], [0, -45, -110], [0, -15, -90], [0, -45, -110], [0, -15, -90], [0, -30, -90], [0, 0, 0]], restPose),
      makeQuatTrack(bones.rightElbow, times, [[0, 0, 0], [0, 0, -90], [0, 0, -45], [0, 0, -90], [0, 0, -45], [0, 0, -90], [0, 0, -90], [0, 0, 0]], restPose),
      makeQuatTrack(bones.rightHand, times, [[0, 0, 0], [0, 0, -30], [0, 0, 10], [0, 0, -30], [0, 0, 10], [0, 0, -30], [0, 0, -30], [0, 0, 0]], restPose),
      makeQuatTrack(bones.head, times, [[0, 0, 0], [10, 0, 0], [20, 0, 0], [10, 0, 0], [20, 0, 0], [10, 0, 0], [10, 0, 0], [0, 0, 0]], restPose),
    ]);
  }

  return clips;
}
