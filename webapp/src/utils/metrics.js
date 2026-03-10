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

    // Walkable = pedestrian route exists via OSM AND distance ≤ 1-mile policy threshold
    const walkableBlocks    = zoneBlocks.filter(b => b.walkDists[sid] !== null && b.walkDists[sid] <= WALK_THRESHOLD);
    const nonWalkableBlocks = zoneBlocks.filter(b => b.walkDists[sid] === null  || b.walkDists[sid] >  WALK_THRESHOLD);

    const walkableStudents    = walkableBlocks.reduce((s, b) => s + (b[studentKey] || 0), 0);
    const nonWalkableStudents = nonWalkableBlocks.reduce((s, b) => s + (b[studentKey] || 0), 0);
    const pctWalkable         = zoneStudents > 0 ? (walkableStudents / zoneStudents) * 100 : 0;

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
      walkableStudents:     Math.round(walkableStudents * 10) / 10,
      nonWalkableStudents:  Math.round(nonWalkableStudents * 10) / 10,
      prekCount,
      totalEnrolled:        Math.round(totalEnrolled * 10) / 10,
      capacity,
      utilization:          capacity > 0 ? totalEnrolled / capacity : 0,
      overCapacity:         totalEnrolled > capacity,
      pctWalkable:          Math.round(pctWalkable * 10) / 10,
      avgDriveNonWalkMi:    avgDriveNonWalkMi !== null ? Math.round(avgDriveNonWalkMi * 100) / 100 : null,
      maxDriveMi:           maxDriveMi !== null ? Math.round(maxDriveMi * 100) / 100 : null,
    };
  }
  return metrics;
}
