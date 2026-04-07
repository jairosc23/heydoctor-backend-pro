/** Browser RTCStatsReport is map-like; DOM typings differ across TS versions. */
export function rtcStatsReportGet(
  report: RTCStatsReport,
  id: string,
): RTCStats | undefined {
  return (report as unknown as Map<string, RTCStats>).get(id);
}
