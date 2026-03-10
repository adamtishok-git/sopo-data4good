import { useState } from 'react'
import MapView    from './MapView'
import StatsPanel from './StatsPanel'

const SEGMENTS = [
  { key: 'community', label: 'Community Schools' },
  { key: 'prek1',     label: 'Grade Centers: PreK–1' },
  { key: 'g24',       label: 'Grade Centers: 2–4' },
];

function getModeKey(activeMode, activePrek) {
  return activeMode === 'g24' ? 'g24' : `${activeMode}_${activePrek}`;
}

function getStudentKey(activeMode) {
  if (activeMode === 'prek1') return 'studentsK1';
  if (activeMode === 'g24')   return 'studentsG24';
  return 'studentsK4';
}

export default function ScenarioView({ scenarioData, states, active, onReassign, onReset }) {
  const [activeMode, setActiveMode] = useState('community');
  const [activePrek, setActivePrek] = useState('current');
  const [selectedBlock, setSelectedBlock] = useState(null);

  const modeKey    = getModeKey(activeMode, activePrek);
  const studentKey = getStudentKey(activeMode);
  const state      = states[modeKey];

  const { reconfig, openSchools } = scenarioData;
  const visibleSchools =
    activeMode === 'prek1' ? reconfig.prek1Schools :
    activeMode === 'g24'   ? reconfig.g24Schools   : openSchools;

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
        {/* Mode segment control — overlaid on map top-left */}
        <div className="mode-bar">
          {SEGMENTS.map(seg => (
            <button
              key={seg.key}
              className={`mode-btn${activeMode === seg.key ? ' active' : ''}`}
              onClick={() => { setActiveMode(seg.key); setSelectedBlock(null); }}
            >{seg.label}</button>
          ))}
          {activeMode !== 'g24' && (
            <div className="prek-toggle">
              <span className="prek-label">PreK:</span>
              {['current', 'full'].map(p => (
                <button
                  key={p}
                  className={`prek-btn${activePrek === p ? ' active' : ''}`}
                  onClick={() => { setActivePrek(p); setSelectedBlock(null); }}
                >{p === 'current' ? 'Current (pilot)' : 'Full capacity'}</button>
              ))}
            </div>
          )}
        </div>
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
