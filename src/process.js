import createActions from './github/actions';

export default function ({payload}, {github, squash, deleteBranches}) {
  const {pull_request, number} = payload;
  const {acceptPR, deleteBranch, postErrorComment} = createActions(github);

  return acceptPR(pull_request.url, pull_request.head.sha, number, squash)
    .then(() => deleteBranch(pull_request.head, deleteBranches))
    .catch((err) => postErrorComment(pull_request.url, err));
}