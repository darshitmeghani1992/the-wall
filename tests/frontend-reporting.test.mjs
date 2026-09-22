import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Shared Walls expose a non-owner reporting route backed by real reports", () => {
  const shared = read("app/shared/[id].tsx");
  const reportWall = read("app/report-wall/[id].tsx");
  const layout = read("app/_layout.tsx");
  assert.match(shared, /!isOwner[\s\S]*Report Shared Wall[\s\S]*\/report-wall\//);
  assert.match(reportWall, /createReport\(subjectToken\.userId/);
  assert.match(reportWall, /wallId: targetToken\.targetId/);
  assert.match(reportWall, /joinState === "owner"/);
  assert.match(reportWall, /setReportSubmitted\(true\)/);
  assert.match(reportWall, /reportSubmitted \? "Report submitted"/);
  assert.match(layout, /name="report-wall\/\[id\]"/);
});

test("person reporting uses the ordered report-and-block coordinator", () => {
  const reportUser = read("app/report-user/[id].tsx");
  assert.match(reportUser, /runUserReportFlow/);
  assert.match(reportUser, /alreadyReported: reportSubmitted/);
  assert.match(reportUser, /blockUser/);
  assert.match(reportUser, /Retry blocking/);
  assert.match(reportUser, /The report was sent, but we couldn't block this person/);
});

test("report forms share one bounded reason/details component", () => {
  const form = read("src/components/ReportReasonForm.tsx");
  for (const screen of ["app/report-user/[id].tsx", "app/report-wall/[id].tsx"]) {
    assert.match(read(screen), /ReportReasonForm/, screen);
  }
  assert.match(form, /REPORT_REASONS\.map/);
  assert.match(form, /maxLength=\{500\}/);
  assert.match(form, /accessibilityRole="radiogroup"/);
});
