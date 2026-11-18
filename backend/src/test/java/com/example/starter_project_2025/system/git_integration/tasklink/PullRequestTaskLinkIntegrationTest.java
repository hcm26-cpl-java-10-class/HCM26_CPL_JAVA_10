package com.example.starter_project_2025.system.git_integration.tasklink;

import com.example.starter_project_2025.system.git_integration.domain.BacklogGitLink;
import com.example.starter_project_2025.system.git_integration.domain.BacklogLinkSource;
import com.example.starter_project_2025.system.git_integration.domain.BacklogReference;
import com.example.starter_project_2025.system.git_integration.domain.BacklogReferenceField;
import com.example.starter_project_2025.system.git_integration.domain.BacklogReferenceReason;
import com.example.starter_project_2025.system.git_integration.domain.BacklogReferenceStatus;
import com.example.starter_project_2025.system.git_integration.domain.GitArtifactType;
import com.example.starter_project_2025.system.git_integration.domain.GitPullRequestState;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklog;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogStatus;
import com.example.starter_project_2025.system.project.tenant.Tenant;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** US-TM-03 acceptance criteria: pull requests mapped to tasks from their title / description, and manual links. */
class PullRequestTaskLinkIntegrationTest extends AbstractTaskLinkIntegrationTest {

    @Autowired PullRequestBranchRefCleanup branchCleanup;

    // ---- AC01 / AC02: title, then description ------------------------------------------------------

    @Test
    void ac01ATaskIdInTheTitleLinksThePullRequest() throws Exception {
        openPr(10, "Add cart " + moduleTask.getTaskKey(), "No task here");

        Long prId = prId(10);
        assertThat(link(moduleTask, prId)).isNotNull()
                .satisfies(link -> assertThat(link.getLinkSource()).isEqualTo(BacklogLinkSource.AUTO));
        assertThat(prRefs(prId)).singleElement().satisfies(ref -> {
            assertThat(ref.getStatus()).isEqualTo(BacklogReferenceStatus.LINKED);
            assertThat(ref.getSourceField()).isEqualTo(BacklogReferenceField.TITLE);
        });
        mvc.perform(get("/api/v1/git-integration/backlog-items/{id}/git-links", moduleTask.getId())
                        .header("Authorization", "Bearer " + readerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pullRequests[0].pullRequest.number").value(10))
                .andExpect(jsonPath("$.pullRequests[0].link.source").value("AUTO"))
                .andExpect(jsonPath("$.pullRequests[0].link.field").value("TITLE"));
    }

    @Test
    void ac02ATaskIdInTheDescriptionOnlyLinksThePullRequest() throws Exception {
        openPr(11, "Add cart page", "Closes **" + moduleTask.getTaskKey() + "**");

        assertThat(link(moduleTask, prId(11))).isNotNull();
        assertThat(prRefs(prId(11))).singleElement()
                .satisfies(ref -> assertThat(ref.getSourceField()).isEqualTo(BacklogReferenceField.BODY));
    }

    @Test
    void theBranchNameIsNotASource() throws Exception {
        deliverAndProcess("pull_request", pullRequest("opened", 12, "Add cart page", "Implements the cart",
                "feature/" + moduleTask.getTaskKey() + "-cart", "2026-11-18T09:00:00Z", false));

        assertThat(link(moduleTask, prId(12))).isNull();
        assertThat(prRefs(prId(12))).singleElement()
                .satisfies(ref -> assertThat(ref.getStatus()).isEqualTo(BacklogReferenceStatus.MISSING));
    }

    @Test
    void severalValidTaskIdsLinkEveryTask() throws Exception {
        openPr(13, moduleTask.getTaskKey() + " cart", "Also touches " + masterTask.getTaskKey());

        assertThat(link(moduleTask, prId(13))).isNotNull();
        assertThat(link(masterTask, prId(13))).isNotNull();
    }

    // ---- AC03: unknown Task IDs ------------------------------------------------------------------------

    @Test
    void ac03AnUnknownTaskIdIsNotLinkedAndTheFailureIsStored() throws Exception {
        openPr(14, "Fix " + otherTenantOnlyKey, "Also " + otherProjectTask.getTaskKey());

        Long prId = prId(14);
        assertThat(links.findAll()).noneMatch(link -> link.getArtifactId().equals(prId)
                && link.getArtifactType() == GitArtifactType.PULL_REQUEST);
        assertThat(prRefs(prId)).extracting(BacklogReference::getStatus, BacklogReference::getReason)
                .containsExactlyInAnyOrder(
                        org.assertj.core.groups.Tuple.tuple(BacklogReferenceStatus.INVALID, BacklogReferenceReason.NOT_FOUND),
                        org.assertj.core.groups.Tuple.tuple(BacklogReferenceStatus.OUTSIDE_PROJECT, BacklogReferenceReason.OTHER_PROJECT));
    }

    // ---- AC04: merge does not move the task ----------------------------------------------------------

    @Test
    void ac04MergingAPullRequestKeepsTheTaskStatus() throws Exception {
        openPr(15, moduleTask.getTaskKey() + " cart", "");
        SprintBacklog before = backlogs.findById(moduleTask.getId()).orElseThrow();

        deliverAndProcess("pull_request", pullRequest("closed", 15, moduleTask.getTaskKey() + " cart", "",
                "feature/cart", "2026-11-18T12:00:00Z", true));

        assertThat(pullRequests.findById(prId(15)).orElseThrow().getState()).isEqualTo(GitPullRequestState.MERGED);
        assertThat(link(moduleTask, prId(15))).isNotNull();
        SprintBacklog after = backlogs.findById(moduleTask.getId()).orElseThrow();
        assertThat(after.getStatus()).isEqualTo(SprintBacklogStatus.IN_PROGRESS);
        assertThat(after.getVersion()).isEqualTo(before.getVersion());
    }

    // ---- AC05 / BR7: edits remove automatic links only --------------------------------------------------

    @Test
    void ac05EditingTheTaskIdOutRemovesTheAutomaticLinkAndKeepsTheManualOne() throws Exception {
        openPr(16, moduleTask.getTaskKey() + " cart", "");
        linkManually(masterTask, 16).andExpect(status().isCreated())
                .andExpect(jsonPath("$.link.source").value("MANUAL"))
                .andExpect(jsonPath("$.link.linkedByName").value("Git Linker"));

        editPr(16, "Cart", "", "2026-11-18T10:00:00Z");

        assertThat(link(moduleTask, prId(16))).isNull();
        assertThat(link(masterTask, prId(16))).isNotNull()
                .satisfies(link -> assertThat(link.getLinkSource()).isEqualTo(BacklogLinkSource.MANUAL));
    }

    @Test
    void aPinnedAutomaticLinkSurvivesEditingTheTaskIdOut() throws Exception {
        openPr(17, moduleTask.getTaskKey() + " cart", "");
        BacklogGitLink auto = link(moduleTask, prId(17));

        mvc.perform(patch("/api/v1/git-integration/backlog-items/{id}/git-links/{linkId}", moduleTask.getId(), auto.getId())
                        .header("Authorization", "Bearer " + developerToken)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"source\":\"MANUAL\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.link.source").value("MANUAL"))
                .andExpect(jsonPath("$.link.field").doesNotExist());
        editPr(17, "Cart", "", "2026-11-18T10:00:00Z");

        BacklogGitLink pinned = link(moduleTask, prId(17));
        assertThat(pinned).isNotNull();
        assertThat(pinned.getId()).isEqualTo(auto.getId());
        assertThat(pinned.getLinkSource()).isEqualTo(BacklogLinkSource.MANUAL);
        assertThat(pinned.getReferenceId()).isNull();
        assertThat(pinned.getLinkedByUserId()).isEqualTo(developerId);
        // The pull request list shows the manual link although the text no longer names the task.
        mvc.perform(get("/api/v1/git-integration/projects/{id}/repository/pull-requests", masterId)
                        .header("Authorization", "Bearer " + readerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].taskRefs.length()").value(1)) // linked, so not "No task ID"
                .andExpect(jsonPath("$.items[0].taskRefs[0].key").value(moduleTask.getTaskKey()))
                .andExpect(jsonPath("$.items[0].taskRefs[0].source").value("MANUAL"));
        mvc.perform(get("/api/v1/git-integration/projects/{id}/repository/pull-requests", masterId).param("link", "LINKED")
                        .header("Authorization", "Bearer " + readerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(1));
        for (String filter : List.of("MISSING", "NEEDS_ATTENTION")) {
            mvc.perform(get("/api/v1/git-integration/projects/{id}/repository/pull-requests", masterId).param("link", filter)
                            .header("Authorization", "Bearer " + readerToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.items.length()").value(0));
        }
        mvc.perform(get("/api/v1/git-integration/projects/{id}/repository/task-links/stats", masterId)
                        .header("Authorization", "Bearer " + readerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pullRequests.linked").value(1))
                .andExpect(jsonPath("$.pullRequests.missing").value(0));
    }

    // ---- the merge commit takes the tasks of its pull request ---------------------------------------------

    @Test
    void theMergeCommitOfAPullRequestIsLinkedToItsTasks() throws Exception {
        openPr(30, "Cart", "Closes " + moduleTask.getTaskKey());
        deliverAndProcess("pull_request", pullRequest("closed", 30, "Cart", "Closes " + moduleTask.getTaskKey(),
                "feature/cart", "2026-11-18T12:00:00Z", true));
        // GitHub copies the title only: the Task ID of the description is not in the message.
        push(commit("m30", "Merge pull request #30 from hcm26-java-team/feature/cart\n\nCart", "2026-11-18T12:00:01Z"));

        List<BacklogReference> refs = references(commit("m30"));
        assertThat(refs).anySatisfy(ref -> {
            assertThat(ref.getRefKey()).isEqualTo(moduleTask.getTaskKey());
            assertThat(ref.getSourceField()).isEqualTo(BacklogReferenceField.MERGED_PR);
            assertThat(ref.getStatus()).isEqualTo(BacklogReferenceStatus.LINKED);
            assertThat(ref.getRawText()).isEqualTo("#30");
        });
        assertThat(links.findByBacklogItemIdAndArtifactTypeAndArtifactId(moduleTask.getId(), GitArtifactType.COMMIT,
                commit("m30").getId())).isPresent();
        mvc.perform(get("/api/v1/git-integration/projects/{id}/repository/commits", masterId)
                        .header("Authorization", "Bearer " + readerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].taskRefs.length()").value(1))
                .andExpect(jsonPath("$.items[0].taskRefs[0].key").value(moduleTask.getTaskKey()))
                .andExpect(jsonPath("$.items[0].taskRefs[0].field").value("MERGED_PR"));
        mvc.perform(get("/api/v1/git-integration/projects/{id}/repository/commits", masterId).param("link", "MISSING")
                        .header("Authorization", "Bearer " + readerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(0));

        // Unlinking the task from the pull request unlinks it from the merge commit too.
        unlink(moduleTask, link(moduleTask, prId(30)).getId()).andExpect(status().isNoContent());
        assertThat(references(commit("m30"))).noneMatch(ref -> ref.getSourceField() == BacklogReferenceField.MERGED_PR);
        assertThat(links.findByBacklogItemIdAndArtifactTypeAndArtifactId(moduleTask.getId(), GitArtifactType.COMMIT,
                commit("m30").getId())).isEmpty();
        mvc.perform(get("/api/v1/git-integration/projects/{id}/repository/commits", masterId)
                        .header("Authorization", "Bearer " + readerToken))
                .andExpect(jsonPath("$.items[0].taskRefs[0].status").value("MISSING"));

        // Linked manually again: back on the merge commit.
        linkManually(moduleTask, 30).andExpect(status().isCreated());
        assertThat(links.findByBacklogItemIdAndArtifactTypeAndArtifactId(moduleTask.getId(), GitArtifactType.COMMIT,
                commit("m30").getId())).isPresent();
    }

    @Test
    void theMergeCommitPushedBeforeThePullRequestIsMarkedMergedIsLinkedToo() throws Exception {
        openPr(31, "Cart", "Closes " + masterTask.getTaskKey());
        push(commit("m31", "Merge pull request #31 from hcm26-java-team/feature/cart\n\nCart", "2026-11-18T12:00:00Z"));
        assertThat(links.findByBacklogItemIdAndArtifactTypeAndArtifactId(masterTask.getId(), GitArtifactType.COMMIT,
                commit("m31").getId())).isEmpty();

        deliverAndProcess("pull_request", pullRequest("closed", 31, "Cart", "Closes " + masterTask.getTaskKey(),
                "feature/cart", "2026-11-18T12:00:01Z", true));

        assertThat(links.findByBacklogItemIdAndArtifactTypeAndArtifactId(masterTask.getId(), GitArtifactType.COMMIT,
                commit("m31").getId())).isPresent();
        // Delivered again: no duplicate.
        deliverAndProcess("pull_request", pullRequest("closed", 31, "Cart", "Closes " + masterTask.getTaskKey(),
                "feature/cart", "2026-11-18T12:00:02Z", true));
        assertThat(references(commit("m31"))).filteredOn(ref -> ref.getSourceField() == BacklogReferenceField.MERGED_PR).hasSize(1);
    }

    @Test
    void mergeCommitsStoredBeforeTheFixAreBackFilledByARecheck() throws Exception {
        openPr(32, "Cart", "Closes " + moduleTask.getTaskKey());
        deliverAndProcess("pull_request", pullRequest("closed", 32, "Cart", "Closes " + moduleTask.getTaskKey(),
                "feature/cart", "2026-11-18T12:00:00Z", true));
        push(commit("m32", "Merge pull request #32 from hcm26-java-team/feature/cart\n\nCart", "2026-11-18T12:00:01Z"));
        // As stored before: only the MISSING verdict of the message.
        tx.executeWithoutResult(status -> references(commit("m32")).stream()
                .filter(ref -> ref.getSourceField() == BacklogReferenceField.MERGED_PR)
                .forEach(ref -> {
                    links.deleteByReference(ref.getId(), BacklogLinkSource.AUTO);
                    references.delete(ref);
                }));
        assertThat(references(commit("m32"))).singleElement()
                .satisfies(ref -> assertThat(ref.getStatus()).isEqualTo(BacklogReferenceStatus.MISSING));

        mvc.perform(post("/api/v1/git-integration/projects/{id}/repository/task-links/recheck", masterId)
                        .header("Authorization", "Bearer " + managerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nowLinked").value(1));

        assertThat(links.findByBacklogItemIdAndArtifactTypeAndArtifactId(moduleTask.getId(), GitArtifactType.COMMIT,
                commit("m32").getId())).isPresent();
        assertThat(linker.syncMergeCommits(null)).isZero(); // nothing left
    }

    // ---- unlink ----------------------------------------------------------------------------------------

    @Test
    void anUnlinkedPullRequestIsNotLinkedAgainAutomatically() throws Exception {
        openPr(18, moduleTask.getTaskKey() + " cart", "");
        BacklogGitLink auto = link(moduleTask, prId(18));

        unlink(moduleTask, auto.getId()).andExpect(status().isNoContent());
        editPr(18, moduleTask.getTaskKey() + " cart (renamed)", "", "2026-11-18T10:00:00Z");

        assertThat(link(moduleTask, prId(18))).isNull();
        assertThat(prRefs(prId(18))).singleElement().satisfies(ref -> {
            assertThat(ref.getStatus()).isEqualTo(BacklogReferenceStatus.EXCLUDED);
            assertThat(ref.getReason()).isEqualTo(BacklogReferenceReason.UNLINKED_BY_USER);
        });
        assertThat(exclusions.findByBacklogItemIdAndArtifactTypeAndArtifactId(moduleTask.getId(),
                GitArtifactType.PULL_REQUEST, prId(18))).isPresent();
        unlink(moduleTask, auto.getId()).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("GIT_TASK_LINK_NOT_FOUND"));
    }

    @Test
    void linkingAgainAfterAnUnlinkMakesAManualLink() throws Exception {
        openPr(19, moduleTask.getTaskKey() + " cart", "");
        unlink(moduleTask, link(moduleTask, prId(19)).getId()).andExpect(status().isNoContent());

        linkManually(moduleTask, 19).andExpect(status().isCreated());

        assertThat(link(moduleTask, prId(19)).getLinkSource()).isEqualTo(BacklogLinkSource.MANUAL);
        assertThat(exclusions.findAll()).isEmpty();
        assertThat(prRefs(prId(19))).singleElement()
                .satisfies(ref -> assertThat(ref.getStatus()).isEqualTo(BacklogReferenceStatus.LINKED));
    }

    // ---- BR6 / idempotency -------------------------------------------------------------------------------

    @Test
    void synchronizingThePullRequestAgainCreatesNoDuplicate() throws Exception {
        ObjectNode event = pullRequest("opened", 20, moduleTask.getTaskKey() + " cart", "", "feature/cart",
                "2026-11-18T09:00:00Z", false);
        for (int i = 0; i < 3; i++) deliverAndProcess("pull_request", event);
        linker.linkPullRequest(prId(20));

        assertThat(links.countByBacklogItemIdAndArtifactType(moduleTask.getId(), GitArtifactType.PULL_REQUEST)).isEqualTo(1);
        assertThat(prRefs(prId(20))).hasSize(1);
    }

    @Test
    void linkingManuallyTwiceKeepsOneLink() throws Exception {
        openPr(21, "Cart", "");

        linkManually(moduleTask, 21).andExpect(status().isCreated());
        linkManually(moduleTask, 21).andExpect(status().isOk()).andExpect(jsonPath("$.link.source").value("MANUAL"));

        assertThat(links.countByBacklogItemIdAndArtifactType(moduleTask.getId(), GitArtifactType.PULL_REQUEST)).isEqualTo(1);
    }

    @Test
    void aManualLinkRacingTheAutomaticMappingEndsAsOneManualLink() throws Exception {
        openPr(22, "Cart", "");
        byte[] edited = json.writeValueAsString(pullRequest("edited", 22, moduleTask.getTaskKey() + " cart", "",
                "feature/cart", "2026-11-18T10:00:00Z", false)).getBytes(StandardCharsets.UTF_8);

        runInParallel(List.of(
                () -> unchecked(() -> deliverAndProcessBytes(edited)),
                () -> unchecked(() -> linkManually(moduleTask, 22).andExpect(status().is2xxSuccessful()))));

        assertThat(links.countByBacklogItemIdAndArtifactType(moduleTask.getId(), GitArtifactType.PULL_REQUEST)).isEqualTo(1);
        assertThat(link(moduleTask, prId(22)).getLinkSource()).isEqualTo(BacklogLinkSource.MANUAL);
    }

    // ---- manual link rules and permissions ----------------------------------------------------------------

    @Test
    void manualLinksFollowTheSameRulesAsAutomaticOnes() throws Exception {
        openPr(23, "Cart", "");

        linkManually(moduleTask, 999).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("GIT_PULL_REQUEST_NOT_FOUND"));
        linkManually(deletedTask, 23).andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("GIT_TASK_INACTIVE"));
        // Banking has no repository: a pull request of another project's repository cannot be picked.
        linkManually(otherProjectTask, 23).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("GIT_REPOSITORY_NOT_LINKED"));
        mvc.perform(post("/api/v1/git-integration/backlog-items/{id}/git-links", moduleTask.getId())
                        .header("Authorization", "Bearer " + developerToken)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"type\":\"COMMIT\",\"number\":23}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("GIT_TASK_LINK_TYPE_NOT_SUPPORTED"));
        mvc.perform(post("/api/v1/git-integration/backlog-items/{id}/git-links", moduleTask.getId())
                        .header("Authorization", "Bearer " + developerToken)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"type\":\"PULL_REQUEST\",\"number\":0}"))
                .andExpect(status().isBadRequest());
        assertThat(links.findAll()).isEmpty();
    }

    @Test
    void linkingNeedsTheBacklogUpdatePermissionAndAVisibleTask() throws Exception {
        openPr(24, "Cart", "");
        String otherTenantDeveloper = tx.execute(status -> {
            Tenant other = tenants.saveAndFlush(Tenant.builder().code("TM3-O-" + UUID.randomUUID()).name("Other").build());
            return token(user(other, role("TM3-DEV-", "SPRINT_BACKLOG_READ", "SPRINT_BACKLOG_UPDATE")));
        });

        mvc.perform(post("/api/v1/git-integration/backlog-items/{id}/git-links", moduleTask.getId())
                        .header("Authorization", "Bearer " + readerToken)
                        .contentType(MediaType.APPLICATION_JSON).content(linkBody(24)))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/git-integration/backlog-items/{id}/git-links", moduleTask.getId())
                        .header("Authorization", "Bearer " + otherTenantDeveloper)
                        .contentType(MediaType.APPLICATION_JSON).content(linkBody(24)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("GIT_BACKLOG_ITEM_NOT_FOUND"));
        assertThat(links.findAll()).isEmpty();
    }

    // ---- link picker ---------------------------------------------------------------------------------------

    @Test
    void candidatesFindPullRequestsByNumberOrTitle() throws Exception {
        openPr(45, "Fix cart total rounding", "");
        openPr(46, masterTask.getTaskKey() + " header", "");

        mvc.perform(get("/api/v1/git-integration/backlog-items/{id}/git-links/candidates", moduleTask.getId())
                        .param("q", "#45").header("Authorization", "Bearer " + developerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].number").value(45));
        mvc.perform(get("/api/v1/git-integration/backlog-items/{id}/git-links/candidates", moduleTask.getId())
                        .param("q", "CART").header("Authorization", "Bearer " + developerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].title").value("Fix cart total rounding"));
        mvc.perform(get("/api/v1/git-integration/backlog-items/{id}/git-links/candidates", moduleTask.getId())
                        .header("Authorization", "Bearer " + developerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[?(@.number == 46)].linkedTaskKeys[0]").value(masterTask.getTaskKey()))
                .andExpect(jsonPath("$[?(@.number == 46)].alreadyLinked").value(false));
        mvc.perform(get("/api/v1/git-integration/backlog-items/{id}/git-links/candidates", masterTask.getId())
                        .param("q", "46").header("Authorization", "Bearer " + developerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].alreadyLinked").value(true));
    }

    // ---- one-off clean-up of SY-05 branch references ------------------------------------------------------

    @Test
    void theCleanUpRemovesBranchReferencesAndTheirAutomaticLinksOnly() throws Exception {
        openPr(25, "Cart", "");
        Long prId = prId(25);
        linkManually(masterTask, 25).andExpect(status().isCreated());
        // As SY-05 left it: a reference found in the branch name and its automatic link.
        BacklogReference branchRef = references.saveAndFlush(BacklogReference.builder()
                .tenantId(tenantId).projectId(masterId).repositoryId(connectionId)
                .sourceType(GitArtifactType.PULL_REQUEST).sourceId(prId).sourceField(BacklogReferenceField.BRANCH)
                .refKey(moduleTask.getTaskKey()).rawText(moduleTask.getTaskKey()).backlogItemId(moduleTask.getId())
                .status(BacklogReferenceStatus.LINKED).reason(BacklogReferenceReason.OK).resolvedAt(LocalDateTime.now())
                .build());
        links.saveAndFlush(BacklogGitLink.builder()
                .tenantId(tenantId).projectId(masterId).repositoryId(connectionId).backlogItemId(moduleTask.getId())
                .itemProjectId(moduleId).artifactType(GitArtifactType.PULL_REQUEST).artifactId(prId)
                .artifactAt(LocalDateTime.now()).linkSource(BacklogLinkSource.AUTO).referenceId(branchRef.getId())
                .linkedAt(LocalDateTime.now()).build());

        assertThat(branchCleanup.cleanUp()).containsExactly(prId);

        assertThat(link(moduleTask, prId)).isNull();
        assertThat(link(masterTask, prId)).isNotNull();
        assertThat(prRefs(prId)).noneMatch(ref -> ref.getSourceField() == BacklogReferenceField.BRANCH);
        assertThat(branchCleanup.cleanUp()).isEmpty();
    }

    // ---- helpers -------------------------------------------------------------------------------------------

    private void openPr(int number, String title, String description) throws Exception {
        deliverAndProcess("pull_request", pullRequest("opened", number, title, description, "feature/cart",
                "2026-11-18T09:00:00Z", false));
    }

    private void editPr(int number, String title, String description, String updatedAt) throws Exception {
        deliverAndProcess("pull_request", pullRequest("edited", number, title, description, "feature/cart", updatedAt, false));
    }

    private Long prId(int number) {
        return pullRequests.findByRepositoryIdAndNumber(connectionId, number).orElseThrow().getId();
    }

    private BacklogGitLink link(SprintBacklog task, Long prId) {
        return links.findByBacklogItemIdAndArtifactTypeAndArtifactId(task.getId(), GitArtifactType.PULL_REQUEST, prId)
                .orElse(null);
    }

    private List<BacklogReference> prRefs(Long prId) {
        return references.findBySourceTypeAndSourceId(GitArtifactType.PULL_REQUEST, prId);
    }

    private static String linkBody(int number) {
        return "{\"type\":\"PULL_REQUEST\",\"number\":" + number + "}";
    }

    private ResultActions linkManually(SprintBacklog task, int number) throws Exception {
        return mvc.perform(post("/api/v1/git-integration/backlog-items/{id}/git-links", task.getId())
                .header("Authorization", "Bearer " + developerToken)
                .contentType(MediaType.APPLICATION_JSON).content(linkBody(number)));
    }

    private ResultActions unlink(SprintBacklog task, Long linkId) throws Exception {
        return mvc.perform(delete("/api/v1/git-integration/backlog-items/{id}/git-links/{linkId}", task.getId(), linkId)
                .header("Authorization", "Bearer " + developerToken));
    }

    private interface ThrowingRunnable {
        void run() throws Exception;
    }

    private static void unchecked(ThrowingRunnable action) {
        try {
            action.run();
        } catch (Exception failure) {
            throw new IllegalStateException(failure);
        }
    }
}
