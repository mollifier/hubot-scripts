// Description
//   issue
//
// Dependencies:
//   "backlog-api": "1.0.2"
//
// Configuration:
//   HUBOT_ISSUE_SPACE_ID
//   HUBOT_ISSUE_USERNAME
//   HUBOT_ISSUE_PASSWORD
//
// Commands:
//   <issue-key> - display backlog issue info
//
// Author:
//   bouzuya
//
module.exports = function(robot) {
  var backlogApi = require('backlog-api');

  robot.hear(/([A-Z]+-\d+)/, function(res) {
    var issueKey = res.match[1].toUpperCase();

    var backlog = backlogApi(
      process.env.HUBOT_ISSUE_SPACE_ID,
      process.env.HUBOT_ISSUE_USERNAME,
      process.env.HUBOT_ISSUE_PASSWORD
    );
    backlog.getIssue({ issueKey: issueKey }).then(function(issue) {
      if (!issue) return;
      backlog.getComments({ issueId: issue.id }).then(function(comments) {
        var prurl;
        comments.reverse().some(function(comment) {
          var pattern = /^(https?:\/\/github.com\/\S*)\s*$/m;
          var match = comment.content.match(pattern);
          if (match) prurl = match[0];
          return match;
        });
        prurl = prurl || '';
        res.send(issue.url + '\n' + issue.summary + '\n' + prurl);
      });
    });
  });
};

