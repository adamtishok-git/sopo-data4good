export default function AboutModal({ onClose }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2>About This Tool</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <p>
            This interactive tool models school boundary scenarios for South Portland, Maine's
            elementary schools. It was built to help residents, city officials, and community
            members explore the tradeoffs involved in potential school closures and
            grade-level reconfigurations.
          </p>

          <h3>The Data</h3>
          <p>
            Student and population estimates are derived from 317 Census 2020 blocks across
            South Portland. Each block's estimated enrollment is calculated proportionally from
            its population (1,013 K–4 students across 5 schools, based on March 2026 enrollment).
            Walk and drive distances are computed using real road network data from OpenStreetMap —
            pedestrian routing automatically accounts for highway crossings and sidewalk
            connectivity. A 1-mile threshold is used to define walkability.
          </p>

          <h3>The Schools</h3>
          <table>
            <thead>
              <tr><th>School</th><th>Capacity</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td>Brown</td><td>260</td><td></td></tr>
              <tr><td>Dyer</td><td>240</td><td>Current PreK pilot (29 students)</td></tr>
              <tr><td>Small</td><td>280</td><td></td></tr>
              <tr><td>Skillin</td><td>380</td><td></td></tr>
              <tr><td>Kaler</td><td>240</td><td>Current PreK pilot (29 students)</td></tr>
            </tbody>
          </table>
          <p>
            <em>Closing Skillin is excluded: the remaining four schools (combined capacity 1,020)
            cannot absorb all 1,013 K–4 students when Skillin closes.</em>
          </p>

          <h3>Viewing Modes</h3>
          <p>Each scenario can be explored in three modes, selectable via the control bar on the map:</p>
          <ul>
            <li>
              <strong>Community Schools</strong> — all grades (K–4) at each building, as today.
              The PreK toggle switches between the current pilot (Dyer + Kaler only) and a
              full-expansion model (29 PreK seats per open school).
            </li>
            <li>
              <strong>Grade Centers: PreK–1</strong> — two buildings serve PreK and Grades 1–2.
              The PreK toggle switches between 29 seats per center (current) and 58 seats
              (two merged classes).
            </li>
            <li>
              <strong>Grade Centers: 2–4</strong> — two buildings serve Grades 2–4 (no PreK
              impact on these buildings).
            </li>
          </ul>

          <h3>The Algorithm</h3>
          <p>Each base assignment was computed using a three-stage algorithm:</p>
          <ul>
            <li>
              <strong>Stage 1 — Flood-fill:</strong> Zones grow outward from each school
              through the block adjacency graph, respecting each school's proportional
              capacity target. Each school is first guaranteed a unique seed block closest
              to it, preventing any school from starting with zero zone blocks.
            </li>
            <li>
              <strong>Stage 2 — Capacity enforcement:</strong> Blocks are moved between zones
              to ensure no school exceeds its hard capacity, preferring moves that preserve
              zone contiguity. Moves are tried in priority order: fully contiguous transfers
              first, then adjacent-zone transfers, then nearest under-capacity school.
            </li>
            <li>
              <strong>Stage 3 — Community cohesion:</strong> Non-walkable blocks are smoothed
              so that neighboring blocks are assigned to the same school where possible.
              If moving a block would disconnect its zone into an isolated peninsula, the
              entire peninsula moves together to keep micro-communities intact.
            </li>
          </ul>

          <h3>Using This Tool</h3>
          <ul>
            <li>Select a closure scenario using the tabs at the top.</li>
            <li>Use the segment control on the map to switch between Community Schools, Grade Centers: PreK–1, and Grade Centers: 2–4 modes.</li>
            <li>Use the PreK toggle to compare current pilot vs. full PreK expansion.</li>
            <li>Click any census block on the map to see its details and reassign it to a different school.</li>
            <li>School statistics update instantly as you make changes.</li>
            <li>Tabs with edits are marked with an orange dot — edits persist as you switch between tabs.</li>
            <li>Use <strong>Reset to Base</strong> to revert the current mode to its model assignment.</li>
            <li>Use <strong>Download GeoJSON</strong> to export your modified zone boundaries with all distances and metrics embedded.</li>
            <li>Use the <strong>Upload Zones</strong> tab to load a GeoJSON file shared by a collaborator and compare their zone plan with live statistics.</li>
          </ul>

          <h3>Limitations</h3>
          <p>
            Student counts are estimates based on population proportionality — actual
            enrollment by home address would produce more precise zone assignments.
            Walk and drive distances use OpenStreetMap network routing but do not
            account for crossing guard locations, sidewalk quality, or individual
            family transportation circumstances.
          </p>
        </div>
      </div>
    </div>
  );
}
