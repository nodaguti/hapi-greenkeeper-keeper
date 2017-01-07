import {assert} from 'chai';
import sinon from 'sinon';
import any from '@travi/any';
import processPR from '../../src/process';
import * as actionsFactory from '../../src/github/actions';

suite('process', () => {
  let sandbox, acceptPR, deleteBranch, postErrorComment;
  const githubCredentials = any.simpleObject();
  const url = any.url();
  const sha = any.string();
  const head = {sha};
  const number = any.integer();
  const squash = any.boolean();
  const deleteBranches = any.boolean();

  setup(() => {
    sandbox = sinon.sandbox.create();

    acceptPR = sinon.stub();
    deleteBranch = sinon.stub();
    postErrorComment = sinon.stub();

    sandbox.stub(actionsFactory, 'default').withArgs(githubCredentials).returns({
      acceptPR,
      deleteBranch,
      postErrorComment
    });
  });

  teardown(() => sandbox.restore());

  test('that processing a greenkeeper PR confirms that it can be merged, merges, and deletes the branch', () => {
    acceptPR.withArgs(url, sha, number, squash).resolves();
    deleteBranch.resolves();

    return processPR(
      {payload: {number, pull_request: {url, head}}},
      {github: githubCredentials, squash, deleteBranches}
    ).then(() => {
      assert.calledOnce(acceptPR);
      assert.calledWith(deleteBranch, head, deleteBranches);
    });
  });

  test('that failing to merge the PR causes a comment to be logged against the PR and prevents branch deletion', () => {
    const error = new Error(any.string());
    acceptPR.rejects(error);

    return processPR(
      {payload: {number, pull_request: {url, head}}},
      {github: githubCredentials, squash, deleteBranches}
    ).then(() => {
      assert.notCalled(deleteBranch);
      assert.calledWith(postErrorComment, url, error);
    })
  });
});