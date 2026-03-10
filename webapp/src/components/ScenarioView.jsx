import { useState } from 'react'
import MapView    from './MapView'
import StatsPanel from './StatsPanel'

export default function ScenarioView({
  scenarioData, states, active,
  modeKey, studentKey, visibleSchools,
  onReassign, onReset,
}) {
  const [selectedBlock, setSelectedBlock] = useState(null);

  const state = states[modeKey];

  function handleReassign(blockId, newSchool) {
    onReassign(modeKey, blockId, newSchool);
  }

  function handleReset() {
    setSelectedBlock(null);
    onReset(modeKey);
  }

  return (
    <div className={`scenario-view${active ? '' : ' hidden'}`}>
      <div className="map-container">
        {active && (
          <MapView
            scenarioData={scenarioData}
            assignments={state.assignments}
            editedBlocks={state.editedBlocks}
            selectedBlockId={selectedBlock?.id ?? null}
            onBlockClick={setSelectedBlock}
            visibleSchools={visibleSchools}
            studentKey={studentKey}
          />
        )}
      </div>

      <div className="sidebar">
        <StatsPanel
          scenarioData={scenarioData}
          assignments={state.assignments}
          editedBlocks={state.editedBlocks}
          selectedBlock={selectedBlock}
          onReassign={handleReassign}
          onReset={handleReset}
          modeKey={modeKey}
          studentKey={studentKey}
          visibleSchools={visibleSchools}
        />
      </div>
    </div>
  );
}
