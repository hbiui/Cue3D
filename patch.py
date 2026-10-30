import os

with open('src/editor/panels/CharacterPanel.tsx', 'r', encoding='utf8') as f:
    code = f.read()

target = """            onHexChange={(value) =>
              isCrowd && selection.crowdId ? updateCrowdColor(selection.crowdId, value) : updateObjectColor(role.id, value)
            }
          />
        </>
      ) : ("""

repl = """            onHexChange={(value) =>
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
      ) : ("""

if target in code:
    code = code.replace(target, repl)
    with open('src/editor/panels/CharacterPanel.tsx', 'w', encoding='utf8') as f:
        f.write(code)
    print("Patched!")
else:
    print("Target not found!")
