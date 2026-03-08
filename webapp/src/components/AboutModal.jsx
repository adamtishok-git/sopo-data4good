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
            members explore the tradeoffs involved in potential school closures.
          </p>

          <h3>The Data</h3>
          <p>
            Student and population estimates are derived from 317 Census 2020 blocks across
            South Portland. Each block's estimated enrollment is calculated proportionally from
            its population (total enrollment: 1,074 students across 5 schools). Walk and drive
            distances are computed using real road network data from OpenStreetMap, with a
            1-mile threshold for walkability.
          </p>

          <h3>The Schools</h3>
          <table>
            <thead>
              <tr><th>School</th><th>Capacity</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td>Brown</td><td>260</td><td></td></tr>
              <tr><td>Dyer</td><td>240</td><td></td></tr>
              <tr><td>Small</td><td>280</td><td></td></tr>
              <tr><td>Skillin</td><td>380</td><td></td></tr>
              <tr><td>Kaler</td><td>240</td><td></td></tr>
            </tbody>
          </table>
          <p>
            <em>Closing Skillin is excluded: the remaining four schools (combined capacity 1,020)
            cannot absorb all 1,074 enrolled students.</em>
          </p>

          <h3>The Algorithm</h3>
          <p>Each base scenario was computed using a three-stage algorithm:</p>
          <ul>
            <li>
              <strong>Stage 1 — Flood-fill:</strong> Zones grow outward from each school
              through the adjacency graph, respecting each school's proportional capacity target.
            </li>
            <li>
              <strong>Stage 2 — Capacity enforcement:</strong> Blocks are moved between zones
              to ensure no school exceeds its hard capacity limit, preferring moves that
              preserve zone contiguity.
            </li>
            <li>
              <strong>Stage 3 — Community cohesion:</strong> Non-walkable blocks (those
              requiring busing) are smoothed so that neighboring blocks are assigned to the
              same school where possible, keeping micro-communities together.
            </li>
          </ul>

          <h3>Using This Tool</h3>
          <ul>
            <li>Select a base closure scenario using the tabs at the top.</li>
            <li>Click any census block on the map to see its details and reassign it to a different school.</li>
            <li>School statistics update instantly as you make changes.</li>
            <li>Tabs with edits are marked with an orange dot — edits persist as you switch between scenarios.</li>
            <li>Use <strong>Reset</strong> to revert a scenario to the model's base assignment.</li>
            <li>Use <strong>Download GeoJSON</strong> to export your modified zone boundaries with embedded statistics.</li>
          </ul>

          <h3>Limitations</h3>
          <p>
            Student counts are estimates based on population proportionality — actual
            enrollment by address would produce more precise results. Walk and drive distances
            use network routing but do not account for crossing guards, sidewalk quality, or
            individual family circumstances.
          </p>
        </div>
      </div>
    </div>
  );
}
