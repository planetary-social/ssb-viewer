var pull = require('pull-stream')
var asyncmemo = require('asyncmemo')
var lru = require('hashlru')

function getChallenge(sbot, token, cb) {
  /* TODO: index this on disk */
  pull(
    sbot.messagesByType('acme-challenges-http-01'),
    pull.map(function (msg) {
      return msg.value.content.challenges
    }),
    pull.flatten(),
    pull.filter(function (challenge) {
      return challenge.token === token
    }),
    pull.collect(function (err, msgs) {
      cb(err, msgs && msgs[0])
    })
  )
}

function respond(res, code, str) {
  res.writeHead(code)
  res.end(str)
}

function respondError(res, code, err) {
  return respond(res, code, JSON.stringify(err, 0, 2))
}

module.exports = function (sbot) {
  var getChallengeCached = asyncmemo({cache: lru(10)}, getChallenge, sbot)

  function serveChallenge(req, res, token) {
    getChallengeCached(token, function (err, challenge) {
      if (err) return respondError(res, 500, err)
      if (!challenge) return respond(res, 404, 'Challenge not found')
      /* TODO (maybe):
       * validate challenge based on domain, msg author, or something */
      respond(res, 200, challenge.keyAuthorization)
    })
  }

  return function (req, res, next) {
    var m = /^\/\.well-known\/acme-challenge\/([^?]*)/.exec(req.url)
    if (m) return serveChallenge(req, res, m[1])
    if (next) return next()
    respond(res, 404, 'Not found')
  }
}