import {minutes} from 'milliseconds';
import clientFactory from './request-methods';
import poll from './poller';
import {
  BranchDeletionFailureError,
  FailedStatusFoundError,
  InvalidStatusFoundError,
  MergeFailureError
} from '../errors';

export default function (githubCredentials) {
  const {get, post, put, del} = clientFactory(githubCredentials);

  function ensureAcceptability({repo, ref, url}, log, timeout = minutes(1)) {
    log(['info', 'PR', 'validating'], url);

    return get(`https://api.github.com/repos/${repo.full_name}/commits/${ref}/status`)
      .then(response => response.body)
      .then(({state}) => {
        switch (state) {
          case 'pending':
            return poll({repo, ref}, log, timeout, ensureAcceptability)
              .then(message => {
                log(['info', 'PR', 'pending-status'], `retrying statuses for: ${url}`);
                return message;
              });
          case 'success':
            return Promise.resolve('All commit statuses passed')
              .then(message => {
                log(['info', 'PR', 'passing-status'], 'statuses verified, continuing...');
                return message;
              });
          case 'failure':
            return Promise.reject(new FailedStatusFoundError())
              .catch(err => {
                log(['error', 'PR', 'failure status'], 'found failed, rejecting...');
                return Promise.reject(err);
              });
          default:
            return Promise.reject(new InvalidStatusFoundError());
        }
      });
  }

  return {
    ensureAcceptability,

    acceptPR: (url, sha, prNumber, squash, log) => put(`${url}/merge`, {
      sha,
      commit_title: `greenkeeper-keeper(pr: ${prNumber}): :white_check_mark:`,
      commit_message: `greenkeeper-keeper(pr: ${prNumber}): :white_check_mark:`,
      squash
    })
      .then(result => {
        log(['info', 'PR', 'integrated'], url);
        return result;
      })
      .catch(err => Promise.reject(new MergeFailureError(err))),

    deleteBranch: ({repo, ref}, deleteBranches) => {
      if (deleteBranches) {
        return del(`https://api.github.com/repos/${repo.full_name}/git/refs/heads/${ref}`)
          .catch(err => Promise.reject(new BranchDeletionFailureError(err)));
      }

      return Promise.resolve();
    },

    postErrorComment: (url, error) => post(url, {
      body: `:x: greenkeeper-keeper failed to merge the pull-request \n> ${error.message}`
    })
  };
}
