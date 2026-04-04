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
            South Portland is closing Kaler elementary school. This tool lets you explore
            two options for how the remaining four schools could be organized — and what
            that means for families across the city in terms of which school their kids
            attend, how far they'd travel, and whether buildings would be over or under
            capacity.
          </p>
          <p>
            It's designed for anyone who wants to understand the tradeoffs — parents, city
            officials, school board members, and community members — no technical background
            needed.
          </p>

          <h3>The Two Options</h3>
          <p>
            Both options close Kaler and redistribute its students among the four remaining
            schools:
          </p>
          <table>
            <thead>
              <tr><th>School</th><th>Capacity</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr><td>Brown</td><td>260</td><td></td></tr>
              <tr><td>Dyer</td><td>240</td><td>Current PreK pilot site (29 students)</td></tr>
              <tr><td>Small</td><td>280</td><td></td></tr>
              <tr><td>Skillin</td><td>380</td><td></td></tr>
            </tbody>
          </table>
          <ul>
            <li>
              <strong>Community Schools</strong> — each building houses all grades K–4, just
              like today. Students are assigned to the nearest school with capacity.
            </li>
            <li>
              <strong>Grade Band Schools</strong> — two buildings become early-childhood
              centers serving PreK through 1st grade, while the other two serve Grades 2–4.
              Use the toggle above the map to switch between the two grade bands.
            </li>
          </ul>

          <h3>How Zone Boundaries Are Drawn</h3>
          <p>
            The suggested zone boundaries are generated automatically, not hand-drawn. The
            process prioritizes three things in order:
          </p>
          <ul>
            <li>
              <strong>Walkability first</strong> — neighborhoods within a 0.75-mile walk of a
              school are assigned there whenever possible. Walk distances use real sidewalk and
              road network data, so a highway or rail line between a home and a school will
              correctly show as non-walkable even if it looks close on a map.
            </li>
            <li>
              <strong>Capacity limits</strong> — no school is assigned more students than it
              can hold. If a neighborhood is walkable to a school that's already full, students
              are redirected to the nearest school with space.
            </li>
            <li>
              <strong>Neighborhood cohesion</strong> — nearby blocks are kept together in the
              same zone wherever possible, so neighbors and friends are more likely to end up
              at the same school.
            </li>
          </ul>
          <p>
            Student counts are estimates based on Census 2020 population data — they reflect
            where children likely live, not official enrollment records by home address.
          </p>

          <h3>What You Can Do</h3>
          <ul>
            <li>
              <strong>Compare options</strong> — click the tabs at the top to switch between
              Community Schools and Grade Band Schools and see how the map and statistics change.
            </li>
            <li>
              <strong>See who changes schools</strong> — click the <em>% Change Schools</em> button
              to highlight every block where students would move to a different school. A table
              shows each affected block with its original and proposed school.
            </li>
            <li>
              <strong>Adjust zone boundaries</strong> — click any colored block on the map to
              reassign it to a different school. Enrollment stats in the sidebar update instantly.
            </li>
            <li>
              <strong>Reset or export</strong> — use <strong>Reset to Base</strong> to undo your
              changes, or <strong>Download GeoJSON</strong> to save and share your modified zone map.
            </li>
            <li>
              <strong>Upload a plan</strong> — use the <strong>Upload Zones</strong> tab to load a
              zone file someone else created and see its live statistics.
            </li>
          </ul>

          <h3>A Note on the Numbers</h3>
          <p>
            Walk and drive distances reflect actual road network routing, not straight-line
            distances. However, they don't account for crossing guard locations, the quality
            of individual sidewalk segments, or family circumstances that affect how kids
            actually get to school. The enrollment figures are estimates — a family-level
            address dataset would produce more precise zone assignments.
          </p>
        </div>
      </div>
    </div>
  );
}
