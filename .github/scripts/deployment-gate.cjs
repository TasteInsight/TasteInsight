module.exports = async function shouldDeploy({ github, context }) {
  if (context.eventName === 'workflow_dispatch') return true;
  if (context.eventName === 'push') return context.ref.startsWith('refs/tags/v');
  if (context.eventName !== 'workflow_run') return false;

  const run = context.payload.workflow_run;
  const repository = `${context.repo.owner}/${context.repo.repo}`;
  if (
    run.conclusion !== 'success'
    || run.event !== 'push'
    || run.head_repository?.full_name !== repository
  ) return false;

  // A late CI completion must not deploy an older commit over the branch head.
  const { data: branch } = await github.rest.repos.getBranch({
    ...context.repo,
    branch: run.head_branch,
  });
  return branch.commit.sha === run.head_sha;
};
