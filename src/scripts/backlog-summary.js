// Description
//   backlog-summary
//
// Dependencies:
//   "async": "0.7.0"
//   "backlog-api": "1.0.2"
//
// Configuration:
//   HUBOT_BACKLOG_SUMMARY_SPACE_ID
//   HUBOT_BACKLOG_SUMMARY_USERNAME
//   HUBOT_BACKLOG_SUMMARY_PASSWORD
//   HUBOT_BACKLOG_SUMMARY_USE_HIPCHAT
//
// Commands:
//   hubot backlog-summary <project> - display backlog project summary
//
// Author:
//   bouzuya
//
var format = require('util').format;

var maxWidth = function(ss) {
  return ss.reduce(function(max, s) {
    return Math.max(max, s.length);
  }, 0);
};

var pad = function(o, n, d) {
  var s = o.toString();
  var padding = '';
  for (var i = 0; i < n - s.length; i++) {
    padding += ' ';
  }
  return (d === 'l' ? padding : '') + s + (d === 'r' ? padding : '');
}

var lpad = function(o, n) { return pad(o, n, 'l'); };
var rpad = function(o, n) { return pad(o, n, 'r'); };

var formatLine = function(name, issues, display) {
  var closed = issues.filter(function(i) { return i.status.id === 4; });

  // count
  var allCount = issues.length;
  var closedCount = closed.length;
  if ((!display && allCount === closedCount) || (display && allCount === 0)) {
    return '';
  }

  // estimated hours
  var allEstimatedHours = issues.reduce(function(hours, i) {
    return hours + (i.estimated_hours || 0);
  }, 0);
  var closedEstimatedHours = closed.reduce(function(hours, i) {
    return hours + (i.estimated_hours || 0);
  }, 0);

  // actual hours
  var allActualHours = issues.reduce(function(hours, i) {
    return hours + (i.actual_hours || 0);
  }, 0);

  // format
  return format(
    '  %s: %s/%s (%sh/%sh,%sh)\n',
    name,
    lpad(closedCount, 4),
    lpad(allCount, 4),
    lpad(closedEstimatedHours, 4),
    lpad(allEstimatedHours, 4),
    lpad(allActualHours, 4));
};

var formatMilestone = function(milestone, users, issues) {
  var width = maxWidth(users.map(function(u) { return u.name; }));

  var first = milestone.name + ':\n';
  var second = formatLine(rpad('All', width), issues);
  if (second.length === 0) { return ''; }
  var userLines = users.map(function(user) {
    return formatLine(rpad(user.name, width), issues.filter(function(i) {
      return i.assigner && i.assigner.id === user.id;
    }), true);
  });
  return first + second + userLines.join('');
};

module.exports = function(robot) {
  var async = require('async');
  var backlogApi = require('backlog-api');

  robot.respond(/backlog-summary\s+([_a-zA-Z0-9]+)\s*$/i, function(res) {
    var projectKey = res.match[1].toUpperCase();

    res.send('OK. Now loading...');

    var backlog = backlogApi(
      process.env.HUBOT_BACKLOG_SUMMARY_SPACE_ID,
      process.env.HUBOT_BACKLOG_SUMMARY_USERNAME,
      process.env.HUBOT_BACKLOG_SUMMARY_PASSWORD
    );

    var project;
    var users;
    var milestones;
    backlog.getProject({ projectKey: projectKey})
    .then(function(p) {
      project = p;
      return backlog.getUsers({ projectId: project.id });
    })
    .then(function(us) {
      users = us;
      return backlog.getVersions({ projectId: project.id });
    })
    .then(function(ms) {
      milestones = ms.sort(function(a, b) { a.date < b.date });
      async.mapSeries(milestones, function(milestone, next) {
        backlog.findIssue({
          projectId: project.id,
          milestoneId: milestone.id,
        }, function(err, issues) {
          next(err, formatMilestone(milestone, users, issues));
        });
      }, function(err, messages) {
        if (err) {
          res.send('error!');
        } else {
          res.send(
            (process.env.HUBOT_BACKLOG_SUMMARY_USE_HIPCHAT ? '/quote ' : '') +
            'backlog-summary ' + projectKey + ' result:\n' +
            'milestone:\n  All: closed/all (estimated closed/all, actual)\n' +
            messages.join(''));
        }
      });
    });
  });
};

