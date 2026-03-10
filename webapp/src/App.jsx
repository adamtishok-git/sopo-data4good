import { useState, useEffect } from 'react'
import ScenarioView from './components/ScenarioView'
import UploadTab    from './components/UploadTab'
import AboutModal   from './components/AboutModal'

const SCENARIO_KEYS = ['brown_closed', 'dyer_closed', 'small_closed', 'kaler_closed'];
const SCENARIO_LABELS = {
  brown_closed: 'Close Brown',
  dyer_closed:  'Close Dyer',
  small_closed: 'Close Small',
  kaler_closed: 'Close Kaler',
};
const MODE_KEYS = ['community_current', 'community_full', 'prek1_current', 'prek1_full', 'g24'];

function initScenarioStates(data) {
  const states = {};
  for (const modeKey of MODE_KEYS) {
    const assignments = {};
    data.blocks.forEach(b => { assignments[b.id] = b.baseAssignments[modeKey]; });
    states[modeKey] = { assignments, editedBlocks: new Set() };
  }
  return states;
}

export default function App() {
  const [activeTab,      setActiveTab]      = useState('brown_closed');
  const [showAbout,      setShowAbout]      = useState(false);
  const [scenarioData,   setScenarioData]   = useState(null);
  const [scenarioStates, setScenarioStates] = useState(null);

  useEffect(() => {
    Promise.all(SCENARIO_KEYS.map(k => fetch(`/data/${k}.json`).then(r => r.json())))
      .then(results => {
        const data   = {};
        const states = {};
        SCENARIO_KEYS.forEach((k, i) => {
          data[k]   = results[i];
          states[k] = initScenarioStates(results[i]);
        });
        setScenarioData(data);
        setScenarioStates(states);
      });
  }, []);

  function reassignBlock(scenarioKey, modeKey, blockId, newSchool) {
    setScenarioStates(prev => {
      const modeState = prev[scenarioKey][modeKey];
      const newAssignments = { ...modeState.assignments, [blockId]: newSchool };
      const newEdited = new Set(modeState.editedBlocks);
      const base = scenarioData[scenarioKey].blocks.find(b => b.id === blockId)?.baseAssignments[modeKey];
      if (newSchool === base) newEdited.delete(blockId);
      else                    newEdited.add(blockId);
      return {
        ...prev,
        [scenarioKey]: {
          ...prev[scenarioKey],
          [modeKey]: { assignments: newAssignments, editedBlocks: newEdited },
        },
      };
    });
  }

  function resetMode(scenarioKey, modeKey) {
    setScenarioStates(prev => {
      const newAssignments = {};
      scenarioData[scenarioKey].blocks.forEach(b => {
        newAssignments[b.id] = b.baseAssignments[modeKey];
      });
      return {
        ...prev,
        [scenarioKey]: {
          ...prev[scenarioKey],
          [modeKey]: { assignments: newAssignments, editedBlocks: new Set() },
        },
      };
    });
  }

  if (!scenarioData || !scenarioStates) {
    return (
      <div className="app">
        <div className="loading">Loading scenario data…</div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <h1>South Portland Elementary School Redistricting</h1>
        <div className="header-right">
          <button className="btn-about" onClick={() => setShowAbout(true)}>About</button>
        </div>
      </header>

      <div className="tabs">
        {SCENARIO_KEYS.map(key => {
          const hasEdits = Object.values(scenarioStates[key]).some(s => s.editedBlocks.size > 0);
          return (
            <button
              key={key}
              className={`tab${activeTab === key ? ' active' : ''}`}
              onClick={() => setActiveTab(key)}
            >
              {SCENARIO_LABELS[key]}
              {hasEdits && <span className="tab-dot" title="Has unsaved edits" />}
            </button>
          );
        })}
        <button
          className={`tab${activeTab === 'upload' ? ' active' : ''}`}
          onClick={() => setActiveTab('upload')}
        >
          Upload Zones
        </button>
      </div>

      <div className="main">
        {SCENARIO_KEYS.map(key => (
          <ScenarioView
            key={key}
            scenarioData={scenarioData[key]}
            states={scenarioStates[key]}
            active={activeTab === key}
            onReassign={(modeKey, blockId, school) => reassignBlock(key, modeKey, blockId, school)}
            onReset={(modeKey) => resetMode(key, modeKey)}
          />
        ))}
        <UploadTab active={activeTab === 'upload'} />
      </div>

      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}
    </div>
  );
}
