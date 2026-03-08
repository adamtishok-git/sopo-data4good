import { useState, useEffect } from 'react'
import ScenarioView from './components/ScenarioView'
import AboutModal   from './components/AboutModal'

const SCENARIO_KEYS = ['brown_closed', 'dyer_closed', 'small_closed', 'kaler_closed'];
const SCENARIO_LABELS = {
  brown_closed: 'Close Brown',
  dyer_closed:  'Close Dyer',
  small_closed: 'Close Small',
  kaler_closed: 'Close Kaler',
};

function initState(data) {
  const assignments = {};
  data.blocks.forEach(b => { assignments[b.id] = b.baseAssignment; });
  return { assignments, editedBlocks: new Set() };
}

export default function App() {
  const [activeTab,      setActiveTab]      = useState('brown_closed');
  const [showAbout,      setShowAbout]      = useState(false);
  const [scenarioData,   setScenarioData]   = useState(null);
  const [scenarioStates, setScenarioStates] = useState(null);

  // Load all scenario data on mount
  useEffect(() => {
    Promise.all(SCENARIO_KEYS.map(k => fetch(`/data/${k}.json`).then(r => r.json())))
      .then(results => {
        const data   = {};
        const states = {};
        SCENARIO_KEYS.forEach((k, i) => {
          data[k]   = results[i];
          states[k] = initState(results[i]);
        });
        setScenarioData(data);
        setScenarioStates(states);
      });
  }, []);

  function reassignBlock(scenarioKey, blockId, newSchool) {
    setScenarioStates(prev => {
      const state = prev[scenarioKey];
      const newAssignments = { ...state.assignments, [blockId]: newSchool };
      const newEdited = new Set(state.editedBlocks);
      const base = scenarioData[scenarioKey].blocks.find(b => b.id === blockId)?.baseAssignment;
      if (newSchool === base) newEdited.delete(blockId);
      else                    newEdited.add(blockId);
      return { ...prev, [scenarioKey]: { assignments: newAssignments, editedBlocks: newEdited } };
    });
  }

  function resetScenario(scenarioKey) {
    setScenarioStates(prev => ({
      ...prev,
      [scenarioKey]: initState(scenarioData[scenarioKey]),
    }));
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
      {/* Header */}
      <header className="header">
        <h1>South Portland Elementary School Redistricting</h1>
        <div className="header-right">
          <button className="btn-about" onClick={() => setShowAbout(true)}>About</button>
        </div>
      </header>

      {/* Scenario Tabs */}
      <div className="tabs">
        {SCENARIO_KEYS.map(key => {
          const hasEdits = scenarioStates[key].editedBlocks.size > 0;
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
      </div>

      {/* Scenario Views — all mounted but only active is shown */}
      <div className="main">
        {SCENARIO_KEYS.map(key => (
          <ScenarioView
            key={key}
            scenarioData={scenarioData[key]}
            state={scenarioStates[key]}
            active={activeTab === key}
            onReassign={(blockId, school) => reassignBlock(key, blockId, school)}
            onReset={() => resetScenario(key)}
          />
        ))}
      </div>

      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}
    </div>
  );
}
