import type { GeometryPrimitiveType } from "../schema/directorProject";

export function GeometryPrimitiveModel({
  color = "#d7e7ff",
  geometryType,
}: {
  color?: string;
  geometryType: GeometryPrimitiveType;
}) {
  const material = <meshStandardMaterial color={color} metalness={0.02} roughness={0.68} />;

  if (geometryType === "sphere") {
    return (
      <mesh name="geometry-sphere" position={[0, 0.55, 0]}>
        <sphereGeometry args={[0.55, 32, 16]} />
        {material}
      </mesh>
    );
  }

  if (geometryType === "cylinder") {
    return (
      <mesh name="geometry-cylinder" position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.45, 0.45, 1.2, 32]} />
        {material}
      </mesh>
    );
  }

  if (geometryType === "torus") {
    return (
      <mesh name="geometry-torus" position={[0, 0.14, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.45, 0.14, 16, 48]} />
        {material}
      </mesh>
    );
  }

  if (geometryType === "cone") {
    return (
      <mesh name="geometry-cone" position={[0, 0.55, 0]}>
        <coneGeometry args={[0.5, 1.1, 32]} />
        {material}
      </mesh>
    );
  }

  if (geometryType === "pyramid") {
    return (
      <mesh name="geometry-pyramid" position={[0, 0.55, 0]}>
        <coneGeometry args={[0.55, 1.1, 4]} />
        {material}
      </mesh>
    );
  }

  return (
    <mesh name="geometry-box" position={[0, 0.5, 0]}>
      <boxGeometry args={[1, 1, 1]} />
      {material}
    </mesh>
  );
}
