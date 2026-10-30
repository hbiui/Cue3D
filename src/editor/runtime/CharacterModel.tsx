import { Component, type ReactNode } from "react";
import type { CharacterRigState } from "../schema/directorProject";
import { PrimitiveMannequin } from "./PrimitiveMannequin";
import { UE4MannequinModel } from "./UE4MannequinModel";
import { GeometryPrimitiveModel } from "./GeometryPrimitiveModel";
import { GEOMETRY_PRIMITIVE_OPTIONS, type GeometryPrimitiveType } from "../schema/directorProject";

import type { CharacterBodyType } from "./mannequin/bodyTypes";

interface CharacterModelProps {
  bodyType?: CharacterBodyType;
  color?: string;
  onLabelAnchorYChange?: (anchorY: number) => void;
  rigState?: CharacterRigState;
}

class CharacterModelBoundary extends Component<
  {
    fallback: ReactNode;
    children: ReactNode;
  },
  {
    hasError: boolean;
  }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

export function CharacterModel({ bodyType, color, onLabelAnchorYChange, rigState }: CharacterModelProps) {
  const isGeometry = GEOMETRY_PRIMITIVE_OPTIONS.some((opt) => opt.type === bodyType);
  if (isGeometry) {
    return <GeometryPrimitiveModel color={color} geometryType={bodyType as GeometryPrimitiveType} />;
  }

  const fallback = <PrimitiveMannequin bodyType={bodyType} color={color} rigState={rigState} />;

  if (rigState?.rigType !== "ue4-mannequin") {
    return fallback;
  }

  return (
    <CharacterModelBoundary fallback={fallback}>
      <UE4MannequinModel
        bodyType={bodyType}
        color={color}
        onLabelAnchorYChange={onLabelAnchorYChange}
        rigState={rigState}
      />
    </CharacterModelBoundary>
  );
}
