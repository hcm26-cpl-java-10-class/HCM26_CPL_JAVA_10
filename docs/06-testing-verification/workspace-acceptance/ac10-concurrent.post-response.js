pm.test("Driver GET succeeded", () => pm.response.to.have.status(200));
if (pm.response.code !== 200) throw new Error("Cannot inspect clean state.");
const projectId = Number(pm.collectionVariables.get("ac10_projectId"));
const teamId = Number(pm.collectionVariables.get("ac10_teamId"));
if (!Number.isSafeInteger(projectId) || !Number.isSafeInteger(teamId) || projectId <= 0 || teamId <= 0) {
  throw new Error("Set ac10_projectId and ac10_teamId first.");
}
const target = pm.response.json().find(row => row.teamId === teamId && row.projectId === projectId);
const clean = !!target && !target.workspaceId && target.eligibleForWorkspace === true;
pm.test("Precondition: eligible pair has no workspace", () => pm.expect(clean).to.equal(true));
if (!clean) throw new Error("AC10 needs a fresh pair. Run the fixture setup again, then update fixturePrefix and inspect candidates.");
const run = "ac10-" + pm.variables.replaceIn("{{$guid}}");
pm.collectionVariables.set("ac10_run", run);
const payload = JSON.stringify({ projectId, teamId });
function dispatch(label) {
  return new Promise((resolve, reject) => {
    const sentAt = new Date().toISOString();
    pm.sendRequest({
      url: pm.collectionVariables.get("baseUrl") + "/api/workspaces",
      method: "POST",
      header: {
        Authorization: "Bearer " + pm.collectionVariables.get("token"),
        "Content-Type": "application/json",
        "X-Idempotency-Key": run + "-" + label,
        "X-Correlation-ID": run + "-" + label
      },
      body: { mode: "raw", raw: payload }
    }, (error, response) => {
      if (error) return reject(error);
      let responseBody;
      try { responseBody = response.json(); } catch (_) { responseBody = response.text(); }
      resolve({ label, key: run + "-" + label, sentAt, receivedAt: new Date().toISOString(),
        status: response.code, body: responseBody });
    });
  });
}
// Both sends start before Promise.all waits for either result.
const responses = await Promise.all([dispatch("A"), dispatch("B")]);
const codes = responses.map(r => r.status).sort((a, b) => a - b);
const evidence = { run, projectId, teamId, payload: JSON.parse(payload), responses };
pm.collectionVariables.set("ac10_evidence", JSON.stringify(evidence, null, 2));
console.log("AC10 concurrent evidence", JSON.stringify(evidence, null, 2));
pm.test("Two different idempotency keys", () => pm.expect(responses[0].key).not.to.equal(responses[1].key));
pm.test("Exactly HTTP 201 + HTTP 409", () => pm.expect(codes).to.deep.equal([201, 409]));
const winner = responses.find(r => r.status === 201);
if (winner) {
  pm.collectionVariables.set("ac10_workspaceId", String(winner.body.id));
  pm.test("Winner belongs to the selected pair", () => {
    pm.expect(winner.body.projectId).to.equal(projectId);
    pm.expect(winner.body.teamId).to.equal(teamId);
  });
}
console.log("Save this console evidence AND run verify.sql. HTTP results alone do not establish database uniqueness.");

