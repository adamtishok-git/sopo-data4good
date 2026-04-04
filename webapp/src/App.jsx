import { useState, useEffect } from 'react'
import ScenarioView from './components/ScenarioView'
import UploadTab    from './components/UploadTab'
import AboutModal   from './components/AboutModal'

const BOUNDARIES_URL = 'https://www.arcgis.com/apps/instant/basic/index.html?appid=185441c7918f4681b4653653fc30a27c';

const ALL_MODE_KEYS = ['community_current', 'prek1_current', 'g24'];

function getStudentKey(modeKey) {
  if (modeKey.startsWith('prek1')) return 'studentsK1';
  if (modeKey === 'g24')           return 'studentsG24';
  return 'studentsK4';
}

function getVisibleSchools(modeKey, data) {
  if (modeKey.startsWith('prek1')) return data.reconfig.prek1Schools;
  if (modeKey === 'g24')           return data.reconfig.g24Schools;
  return data.openSchools;
}

function initModeStates(data) {
  const states = {};
  for (const modeKey of ALL_MODE_KEYS) {
    const assignments = {};
    data.blocks.forEach(b => { assignments[b.id] = b.baseAssignments[modeKey]; });
    states[modeKey] = { assignments, editedBlocks: new Set() };
  }
  return states;
}

export default function App() {
  const [activeTab,    setActiveTab]    = useState('community');
  const [gradeLevel,   setGradeLevel]   = useState('prek1');
  const [showAbout,    setShowAbout]    = useState(false);
  const [data,         setData]         = useState(null);
  const [modeStates,   setModeStates]   = useState(null);

  useEffect(() => {
    fetch('/data/kaler_closed.json')
      .then(r => r.json())
      .then(d => {
        setData(d);
        setModeStates(initModeStates(d));
      });
  }, []);

  function reassignBlock(mk, blockId, newSchool) {
    setModeStates(prev => {
      const modeState = prev[mk];
      const newAssignments = { ...modeState.assignments, [blockId]: newSchool };
      const newEdited = new Set(modeState.editedBlocks);
      const base = data.blocks.find(b => b.id === blockId)?.baseAssignments[mk];
      if (newSchool === base) newEdited.delete(blockId);
      else                    newEdited.add(blockId);
      return { ...prev, [mk]: { assignments: newAssignments, editedBlocks: newEdited } };
    });
  }

  function resetMode(mk) {
    setModeStates(prev => {
      const newAssignments = {};
      data.blocks.forEach(b => { newAssignments[b.id] = b.baseAssignments[mk]; });
      return { ...prev, [mk]: { assignments: newAssignments, editedBlocks: new Set() } };
    });
  }

  if (!data || !modeStates) {
    return <div className="app"><div className="loading">Loading scenario data…</div></div>;
  }

  const communityEdits  = modeStates['community_current'].editedBlocks.size > 0;
  const gradebandEdits  = modeStates['prek1_current'].editedBlocks.size > 0
                       || modeStates['g24'].editedBlocks.size > 0;

  return (
    <div className="app">
      <header className="header">
        <h1>South Portland Elementary School Redistricting</h1>
        <div className="header-right">
          <button className="btn-about" onClick={() => setShowAbout(true)}>About</button>
        </div>
      </header>

      <div className="tabs">
        <button
          className={`tab${activeTab === 'community' ? ' active' : ''}`}
          onClick={() => setActiveTab('community')}
        >
          Community Schools
          {communityEdits && <span className="tab-dot" title="Has unsaved edits" />}
        </button>
        <button
          className={`tab${activeTab === 'gradeband' ? ' active' : ''}`}
          onClick={() => setActiveTab('gradeband')}
        >
          Grade Band Schools
          {gradebandEdits && <span className="tab-dot" title="Has unsaved edits" />}
        </button>
        <button
          className={`tab${activeTab === 'upload' ? ' active' : ''}`}
          onClick={() => setActiveTab('upload')}
        >
          Upload Zones
        </button>

        <div className="tabs-right">
          <a
            className="tab-action-btn"
            href={BOUNDARIES_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            Current Boundaries ↗
          </a>
        </div>
      </div>

      <div className="main">
        <ScenarioView
          scenarioData={data}
          states={modeStates}
          active={activeTab === 'community'}
          modeKey="community_current"
          modeOption="community_current"
          studentKey="studentsK4"
          visibleSchools={data.openSchools}
          gcMode={false}
          gradeLevel={gradeLevel}
          onGradeLevelChange={setGradeLevel}
          onReassign={(mk, blockId, school) => reassignBlock(mk, blockId, school)}
          onReset={(mk) => resetMode(mk)}
        />
        <ScenarioView
          scenarioData={data}
          states={modeStates}
          active={activeTab === 'gradeband'}
          modeKey={gradeLevel === 'g24' ? 'g24' : 'prek1_current'}
          modeOption="prek1_current"
          studentKey={getStudentKey(gradeLevel === 'g24' ? 'g24' : 'prek1_current')}
          visibleSchools={getVisibleSchools(gradeLevel === 'g24' ? 'g24' : 'prek1_current', data)}
          gcMode={true}
          gradeLevel={gradeLevel}
          onGradeLevelChange={setGradeLevel}
          onReassign={(mk, blockId, school) => reassignBlock(mk, blockId, school)}
          onReset={(mk) => resetMode(mk)}
        />
        <UploadTab active={activeTab === 'upload'} />
      </div>

      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}

      <footer className="disclaimer">
        <strong>Unofficial tool.</strong> Zone assignments shown here are computer-generated
        estimates based on straight-line and road distances from school addresses — they are
        not official school district boundaries and should not be treated as such.
        This site was created independently by a South Portland parent and has no affiliation
        with South Portland School Department or the School Board.
      </footer>
    </div>
  );
}
