const WALK_THRESHOLD = 1609.34;

/**
 * Compute per-school metrics for one mode.
 *
 * studentKey: "studentsK4" | "studentsK1" | "studentsG24"
 * prekAllocations: {schoolId: prekCount}
 */
export function computeMetrics(blocks, assignments, openSchools, schools, studentKey, prekAllocations = {}) {
  const metrics = {};

  for (const sid of openSchools) {
    const zoneBlocks = blocks.filter(b => assignments[b.id] === sid);
    const zoneStudents = zoneBlocks.reduce((s, b) => s + (b[studentKey] || 0), 0);
    const prekCount    = prekAllocations[sid] || 0;
    const totalEnrolled = zoneStudents + prekCount;
    const capacity = schools[sid].capacity;

    // "Walkable" = OSM found a pedestrian route at all (any finite walk distance)
    const routableBlocks    = zoneBlocks.filter(b => b.walkDists[sid] !== null);
    const nonRoutableBlocks = zoneBlocks.filter(b => b.walkDists[sid] === null);
    // "Within 1 mile" = pedestrian route exists AND distance ≤ policy threshold
    const within1MiBlocks   = zoneBlocks.filter(b => b.walkDists[sid] !== null && b.walkDists[sid] <= WALK_THRESHOLD);
    // For drive-time stats, non-walkable = over threshold (includes non-routable)
    const nonWalkableBlocks = zoneBlocks.filter(b => b.walkDists[sid] === null  || b.walkDists[sid] >  WALK_THRESHOLD);

    const routableStudents    = routableBlocks.reduce((s, b)  => s + (b[studentKey] || 0), 0);
    const within1MiStudents   = within1MiBlocks.reduce((s, b) => s + (b[studentKey] || 0), 0);
    const nonWalkableStudents = nonWalkableBlocks.reduce((s, b) => s + (b[studentKey] || 0), 0);
    const pctWalkable    = zoneStudents > 0 ? (routableStudents  / zoneStudents) * 100 : 0;
    const pctWithin1Mile = zoneStudents > 0 ? (within1MiStudents / zoneStudents) * 100 : 0;

    // Alias for the drive-stats calculation below
    const walkableStudents = within1MiStudents;

    // Population-weighted avg drive for non-walkable blocks
    let avgDriveNonWalkMi = null;
    const nwPop = nonWalkableBlocks.reduce((s, b) => s + b.population, 0);
    if (nwPop > 0) {
      const weighted = nonWalkableBlocks.reduce((s, b) => {
        const dd = b.driveDists[sid];
        return dd !== null ? s + dd * b.population : s;
      }, 0);
      avgDriveNonWalkMi = weighted / nwPop / 1609.34;
    }

    // Max drive distance across all zone blocks
    let maxDriveMi = null;
    for (const b of zoneBlocks) {
      const dd = b.driveDists[sid];
      if (dd !== null && (maxDriveMi === null || dd > maxDriveMi * 1609.34))
        maxDriveMi = dd / 1609.34;
    }

    metrics[sid] = {
      zoneStudents:         Math.round(zoneStudents * 10) / 10,
      routableStudents:     Math.round(routableStudents * 10) / 10,
      within1MiStudents:    Math.round(within1MiStudents * 10) / 10,
      nonWalkableStudents:  Math.round(nonWalkableStudents * 10) / 10,
      prekCount,
      totalEnrolled:        Math.round(totalEnrolled * 10) / 10,
      capacity,
      utilization:          capacity > 0 ? totalEnrolled / capacity : 0,
      overCapacity:         totalEnrolled > capacity,
      pctWalkable:          Math.round(pctWalkable * 10) / 10,
      pctWithin1Mile:       Math.round(pctWithin1Mile * 10) / 10,
      avgDriveNonWalkMi:    avgDriveNonWalkMi !== null ? Math.round(avgDriveNonWalkMi * 100) / 100 : null,
      maxDriveMi:           maxDriveMi !== null ? Math.round(maxDriveMi * 100) / 100 : null,
    };
  }
  return metrics;
}
