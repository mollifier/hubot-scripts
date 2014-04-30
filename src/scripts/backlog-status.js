// Description
//   backlog-status
//
// Dependencies:
//   "async": "0.7.0"
//   "backlog-api": "1.0.2"
//   "q": "1.0.1"
//
// Configuration:
//   HUBOT_BACKLOG_STATUS_SPACE_ID
//   HUBOT_BACKLOG_STATUS_USERNAME
//   HUBOT_BACKLOG_STATUS_PASSWORD
//
// Commands:
//   hubot backlog-status <project> - display backlog user status
//
// Author:
//   bouzuya
//
module.exports = function(robot) {
  var async = require('async');
  var Promise = require('q').Promise;
  var backlogApi = require('backlog-api');

  robot.respond(/backlog-status\s+([-a-zA-Z]+)\s*$/i, function(res) {
    var projectKey = res.match[1].toUpperCase();

    res.send('OK. Now loading...');

    var backlog = backlogApi(
      process.env.HUBOT_BACKLOG_STATUS_SPACE_ID,
      process.env.HUBOT_BACKLOG_STATUS_USERNAME,
      process.env.HUBOT_BACKLOG_STATUS_PASSWORD
    );

    var project;
    var users;
    new Promise(function(resolve) { resolve(); })
    .then(function() {
      return backlog.getProject({ projectKey: projectKey });
    })
    .then(function(p) { project = p; })
    .then(function() {
      return backlog.getUsers({ projectId: project.id });
    })
    .then(function(us) { users = us; })
    .then(function() {
      return new Promise(function(resolve, reject) {
        async.mapSeries(users, function(user, next) {
          backlog.findIssue({
            projectId: project.id,
            statusId: 2, // in progress
            assignerId: user.id,
          }, function(err, issues) {
            next(err, issues);
          });
        }, function(err, result) {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        });
      });
    })
    .then(function(r) {
      users = users.map(function(user, i) {
        return { name: user.name, issues: r[i] };
      });
    })
    .then(function() {
      // set prurl
      return new Promise(function(resolve, reject) {
        async.mapSeries(users, function(user, nextUser) {
          async.mapSeries(user.issues, function(issue, nextIssue) {
            // fetch comment
            backlog.getComments({
              issueId: issue.id
            }, function(err, comments) {
              if (err) return nextIssue(err);
              // parse comment
              var prurl;
              comments.reverse().some(function(comment) {
                var pattern = /^(https?:\/\/github.com\/\S*)\s*$/m;
                var match = comment.content.match(pattern);
                if (match) prurl = match[0];
                return match;
              });
              issue.prurl = prurl || '';
              nextIssue();
            });
          }, function(err) {
            nextUser(err);
          });
        }, function(err) {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    })
    .then(function() {
      // format
      var msgs = users
      .filter(function(user) {
        return user.issues.length > 0;
      }).map(function(user) {
        return user.name + ':\n' + user.issues.map(function(issue) {
          return [
            '  ' + issue.url,
            '    ' + issue.summary,
            '    ' + issue.prurl,
          ].join('\n')
        }).join('\n');
      });
      res.send('backlog-status result:\n' + msgs.join('\n'));
    })
    .catch(function(err) {
      var inspect = require('util').inspect;
      res.send('error! : ' + inspect(err));
    });
  });
};

