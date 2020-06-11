var path = require('path')
var pull = require("pull-stream")
var marked = require("ssb-marked")
var htime = require("human-time")
var emojis = require("emoji-named-characters")
var cat = require("pull-cat")
var h = require('hyperscript')
var refs = require('ssb-ref')

var emojiDir = path.join(require.resolve("emoji-named-characters"), "../pngs")

exports.wrapPage = wrapPage
exports.MdRenderer = MdRenderer
exports.renderEmoji = renderEmoji
exports.formatMsgs = formatMsgs
exports.renderThread = renderThread
exports.renderAbout = renderAbout
exports.renderShowAll = renderShowAll
exports.renderRssItem = renderRssItem
exports.wrapRss = wrapRss

function MdRenderer(opts) {
  marked.Renderer.call(this, {})
  this.opts = opts
}

MdRenderer.prototype = new marked.Renderer()

MdRenderer.prototype.urltransform = function(href) {
  if (!href) return false
  switch (href[0]) {
    case '#':
      return this.opts.base + 'channel/' + href.slice(1)
    case '%':
      if (!refs.isMsgId(href)) return false
      return this.opts.msg_base + encodeURIComponent(href)
    case '@':
      if (!refs.isFeedId(href)) return false
      href = (this.opts.mentions && this.opts.mentions[href.substr(1)]) || href
      return this.opts.feed_base + href
    case '&':
      if (!refs.isBlobId(href)) return false
      return this.opts.blob_base + href
  }
  if (href.indexOf('javascript:') === 0) return false
  return href
}

MdRenderer.prototype.image = function(href, title, text) {
  if (text.endsWith('.svg'))
    return h('object',
             { type: 'image/svg+xml',
               data: href,
               alt: text }).outerHTML
  else
    return h('img',
             { src: this.opts.img_base + href,
               alt: text,
               title: title
             }).outerHTML
}

function renderEmoji(emoji) {
  var opts = this.renderer.opts
  var url = opts.mentions && opts.mentions[emoji]
    ? opts.blob_base + encodeURIComponent(opts.mentions[emoji])
    : emoji in emojis && opts.emoji_base + escape(emoji) + '.png'
  return url
        ? h('img.ssb-emoji',
            { src: url,
              alt: ':' + escape(emoji) + ':',
              title: ':' + escape(emoji) + ':',
              height: 16, width: 16
            }).outerHTML
    : ':' + emoji + ':'
}

function escape(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&quot;')
}

function formatMsgs(id, ext, opts) {
  switch (ext || 'html') {
    case 'html':
      return pull(renderThread(opts, id, ''), wrapPage(id))
    case 'js':
      return pull(renderThread(opts), wrapJSEmbed(opts))
    case 'json':
      return wrapJSON()
    case 'rss':
      return pull(renderRssItem(opts), wrapRss(id, opts))
    default:
      return null
  }
}

function wrap(before, after) {
  return function(read) {
    return cat([pull.once(before), read, pull.once(after)])
  }
}

function callToAction() {
  return h('a.call-to-action',
           { href: 'https://www.scuttlebutt.nz' },
           'Join Scuttlebutt now').outerHTML
}

function toolTipTop() {
  return h('span.top-tip',
           'You are reading content from ',
           h('a', { href: 'https://www.scuttlebutt.nz' },
             'Scuttlebutt')).outerHTML
}

function renderAbout(opts, about, showAllHTML = "") {
  if (about.publicWebHosting === false || (about.publicWebHosting == null && opts.requireOptIn)) {
    return pull(
      pull.map(renderMsg.bind(this, opts, '')),
      wrap(toolTipTop() + '<main>', '</main>' + callToAction())
    )
  }

  var figCaption = h('figcaption')
  figCaption.innerHTML = 'Feed of ' + escape(about.name) + '<br>' + marked(String(about.description || ''), opts.marked)
  return pull(
    pull.map(renderMsg.bind(this, opts, '')),
    wrap(toolTipTop() + '<main>' +
         h('article',
           h('header',
             h('figure',
               h('img',
                 { src: opts.img_base + about.image,
                   style: 'max-height: 200px; max-width: 200px;'
                 }),
               figCaption)
            )).outerHTML,
         showAllHTML + '</main>' + callToAction())
  )
}

function renderThread(opts, id, showAllHTML = "") {
  return pull(
    pull.map(renderMsg.bind(this, opts, id)),
    wrap(toolTipTop() + '<main>', 
         showAllHTML + '</main>' + callToAction())
  )
}

function renderRssItem(opts) {
  return pull(
    pull.map(renderRss.bind(this, opts))
  )
}

function wrapPage(id) {
  return wrap(
    "<!doctype html><html><head>" +
      "<meta charset=utf-8>" +
      "<title>" +
      id + " | ssb-viewer" +
      "</title>" +
      '<meta name=viewport content="width=device-width,initial-scale=1">' +
      styles +
      "</head><body>",
    "</body></html>"
  )
}

function wrapRss(id, opts) {
  return wrap(
    '<?xml version="1.0" encoding="UTF-8" ?>' +
    '<rss version="2.0">' +
      '<channel>' +
        '<title>' + id + ' | ssb-viewer</title>',

      '</channel>'+
    '</rss>'
  )
}

var styles = `
  <style>
    html { background-color: #f1f3f5; }
    body {
      color: #212529;
      font-family: "Helvetica Neue", "Calibri Light", Roboto, sans-serif;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      letter-spacing: 0.02em;
      padding-top: 30px;
      padding-bottom: 50px;
    }
    a { color: #364fc7; }

    .top-tip, .top-tip a {
      color: #868e96;
    }
    .top-tip {
      text-align: center;
      display: block;
      margin-bottom: 10px;
      font-size: 14px;
    }
    main { margin: 0 auto; max-width: 40rem; }
    main article:first-child { border-radius: 3px 3px 0 0; }
    main article:last-child { border-radius: 0 0 3px 3px; }
    article {
      background-color: white;
      padding: 20px;
      box-shadow: 0 1px 3px #949494;
      position: relative;
    }
    .top-right { position: absolute; top: 20px; right: 20px; }
    article > header { margin-bottom: 20px; }
    article > header > figure {
      margin: 0; display: flex;
    }
    article > header > figure > img {
      border-radius: 2px; margin-right: 10px;
    }
    article > header > figure > figcaption {
      display: flex; flex-direction: column;
    }
    article > section {
      word-wrap: break-word;
    }
    .ssb-avatar-name { font-size: 1.2em; font-weight: bold; }
    time a { color: #868e96; }
    .ssb-avatar-name, time a {
      text-decoration: none;
    }
    .ssb-avatar-name:hover, time:hover a {
      text-decoration: underline;
    }
    section p { line-height: 1.45em; }
    section p img {
      max-width: 100%;
      max-height: 50vh;
      margin: 0 auto;
    }
    .status {
      font-style: italic;
    }

    code {
      display: inline;
      padding: 2px 5px;
      font-weight: 600;
      background-color: #e9ecef;
      border-radius: 3px;
      color: #495057;
    }
    blockquote {
      padding-left: 1.2em;
      margin: 0;
      color: #868e96;
      border-left: 5px solid #ced4da;
    }
    pre {
      background-color: #212529;
      color: #ced4da;
      font-weight: bold;
      padding: 5px;
      border-radius: 3px;
      position: relative;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    pre::before {
      content: "METADATA";
      position: absolute;
      top: -3px;
      right: 0px;
      background-color: #212529;
      padding: 2px 4px 0;
      border-radius: 2px;
      font-family: "Helvetica Neue", "Calibri Light", Roboto, sans-serif;
      font-size: 9px;
    }
    .call-to-action {
      display: block;
      margin: 0 auto;
      width: 13em;
      text-align: center;
      text-decoration: none;
      margin-top: 20px;
      margin-bottom: 60px;
      background-color: #5c7cfa;
      padding: 15px 0;
      color: #edf2ff;
      border-radius: 3px;
      border-bottom: 3px solid #3b5bdb;
    }
    .call-to-action:hover {
      background-color: #748ffc;
      border-bottom: 3px solid #4c6ef5;
    }
    .attending {
      text-align: center;
    }
  </style>
`

function wrapJSON() {
  var first = true
  return pull(pull.map(JSON.stringify), join(','), wrap('[', ']'))
}

function wrapJSEmbed(opts) {
  return pull(
    wrap('<link rel=stylesheet href="' + opts.base + 'static/base.css">', ""),
    pull.map(docWrite),
    opts.base_token && rewriteBase(new RegExp(opts.base_token, "g"))
  )
}

function rewriteBase(token) {
  // detect the origin of the script and rewrite the js/html to use it
  return pull(
    replace(token, '" + SSB_VIEWER_ORIGIN + "/'),
    wrap(
      "var SSB_VIEWER_ORIGIN = (function () {" +
        'var scripts = document.getElementsByTagName("script")\n' +
        "var script = scripts[scripts.length-1]\n" +
        "if (!script) return location.origin\n" +
        'return script.src.replace(/\\/%.*$/, "")\n' +
        "}())\n",
      ""
    )
  )
}

function join(delim) {
  var first = true
  return pull.map(function(val) {
    if (!first) return delim + String(val)
    first = false
    return val
  })
}

function replace(re, rep) {
  return pull.map(function(val) {
    return String(val).replace(re, rep)
  })
}

function docWrite(str) {
  return 'document.write(' + JSON.stringify(str) + ')\n'
}

function renderMsg(opts, id, msg) {
  var c = msg.value.content || {}

  if (opts.renderPrivate == false && typeof(msg.value.content) == 'string') return ''
  if (opts.renderSubscribe == false && c.type == 'channel' && c.subscribed != undefined) return ''
  if (opts.renderVote == false && c.type == "vote") return ''
  if (opts.renderChess == false && c.type.startsWith("chess")) return ''
  if (opts.renderTalenet == false && c.type.startsWith("talenet")) return ''
  if (opts.renderFollow == false && c.type == "contact") return ''
  if (opts.renderAbout == false && c.type == "about") return ''
  if (opts.renderPub == false && c.type == "pub") return ''
  if (msg.author.publicWebHosting === false) return h('article', 'User has chosen not to be hosted publicly').outerHTML
  if (msg.author.publicWebHosting == null && opts.requireOptIn) return h('article', 'User has not chosen to be hosted publicly').outerHTML

  var name = encodeURIComponent(msg.key)
  return h('article#' + name,
           h('header',
             h('figure',
               h('img', { alt: '',
                          src: opts.img_base + msg.author.image,
                          height: 50, width: 50 }),
               h('figcaption',
                 h('a.ssb-avatar-name',
                   { href: opts.base + escape(msg.value.author) },
                   msg.author.name),
                 msgTimestamp(msg, opts.base + name), ' ',
                 h('small', h('code', msg.key))
               ))),
           render(opts, id, c)).outerHTML
}

function renderRss(opts, msg) {
  var c = msg.value.content || {}
  var name = encodeURIComponent(msg.key)

  let content = h('div', render(opts, c)).innerHTML

  if (!content) return null

  return (
    '<item>' +
      '<title>' + escape(c.type || 'private') + '</title>' +
      '<author>' + escape(msg.author.name) + '</author>' +
      '<description><![CDATA[' + content + ']]></description>' +
      '<link>' + opts.base + escape(name) + '</link>' +
      '<pubDate>' + new Date(msg.value.timestamp).toUTCString() + '</pubDate>' +
      '<guid>' + msg.key + '</guid>' +
    '</item>'
  )
}

function msgTimestamp(msg, link) {
  var date = new Date(msg.value.timestamp)
  var isoStr = date.toISOString()
  return h('time.ssb-timestamp',
           { datetime: isoStr },
           h('a',
             { href: link,
               title: isoStr },
             formatDate(date)))
}

function formatDate(date) {
  return htime(date)
}

function render(opts, id, c) {
  var base = opts.base
  if (!c) return
  if (c.type === 'post') {
    var channel = c.channel
        ? h('div.top-right',
            h('a',
              { href: base + 'channel/' + c.channel },
              '#' + c.channel))
        : ''
    return [channel, renderPost(opts, id, c)]
  } else if (c.type == 'vote' && c.vote.expression == 'Dig') {
    var channel = c.channel
        ? [' in ',
           h('a',
             { href: base + 'channel/' + c.channel },
             '#' + c.channel)]
        : ''
    var linkedText = 'this'
    if (typeof c.vote.linkedText != 'undefined')
        linkedText = c.vote.linkedText.substring(0, 75)
    return h('span.status',
             ['Liked ',
              h('a', { href: base + encodeURIComponent(c.vote.link) }, linkedText),
              channel])
  } else if (c.type == 'vote') {
    var linkedText = 'this'
    if (c.vote && typeof c.vote.linkedText === 'string')
      linkedText = c.vote.linkedText.substring(0, 75)
      return h('span.status',
               ['Voted ',
                h('a', { href: base + encodeURIComponent(c.vote.link) }, linkedText)])
  } else if (c.type == 'contact' && c.following) {
    var name = c.contact
    if (c.contactAbout)
        name = c.contactAbout.name
    return h('span.status',
             ['Followed ',
              h('a', { href: base + c.contact }, name)])
  } else if (c.type == 'contact' && !c.following) {
    var name = c.contact
    if (c.contactAbout)
        name = c.contactAbout.name
    return h('span.status',
             ['Unfollowed ',
              h('a', { href: base + c.contact }, name)])
  } else if (typeof c == 'string') {
    return h('span.status', 'Wrote something private')
  } else if (c.type == 'chess_move') {
    return h('span.status', 'Moved a chess piece')
  } else if (c.type == 'chess_invite') {
    return h('span.status', 'Started a chess game')
  }
  else if (c.type == 'about') {
    return [h('span.status', 'Changed something in about'),
            renderDefault(c)]
  }
  else if (c.type == 'issue') {
    return [h('span.status',
             'Created a git issue' +
              (c.repoName ? ' in repo ' + c.repoName : ''),
              renderPost(opts, id, c))]
  }
  else if (c.type == 'git-repo') {
    return h('span.status',
             'Created a git repo ' + c.name)
  }
  else if (c.type == 'git-update') {
    return h('div.status', 'Did a git update ' +
      (c.repoName ? ' in repo ' + c.repoName : ''),
      (Array.isArray(c.commits) ? h('ul',
        c.commits.filter(Boolean).map(com => {
          return h('li', String(com.title || com.sha1))
        })
      ) : '')
    )
  }
  else if (c.type == 'ssb-dns') {
    return [h('span.status', 'Updated DNS'), renderDefault(c)]
  }
  else if (c.type == 'pub') {
    var host = c.address && c.address.host
    return h('span.status', 'Connected to the pub ' + host)
  }
  else if (c.type == 'npm-packages') {
    return h('div.status', 'Pushed npm packages',
      Array.isArray(c.mentions) ? h('ul', c.mentions.map(function (link) {
        var name = link && link.name
        var m = name && /^npm:([^:]*):([^:]*)(?::([^:]*)(?:\.tgz)?)?$/.exec(name)
        if (!m) return
        var [, name, version, tag] = m
        return h('li', name + ' v' + version + (tag ? ' (' + tag + ')' : ''))
      })) : ''
    )
  }
  else if (c.type == 'channel' && c.subscribed)
    return h('span.status',
             'Subscribed to channel ',
             h('a',
               { href: base + 'channel/' + c.channel },
               '#' + c.channel))
  else if (c.type == 'channel' && !c.subscribed)
    return h('span.status',
             'Unsubscribed from channel ',
             h('a',
               { href: base + 'channel/' + c.channel },
               '#' + c.channel))
  else if (c.type == 'blog') {
    //%RTXvyZ2fZWwTyWdlk0lYGk5sKw5Irj+Wk4QwxyOVG5g=.sha256
    var channel = c.channel
      ? h('div.top-right',
          h('a',
            { href: base + 'channel/' + c.channel },
            '#' + c.channel))
      : ''

    var s = h('section')
    s.innerHTML = marked(String(c.blogContent), opts.marked)

    return [channel, h('h2', String(c.title)), s]
  }
  else if (c.type === 'gathering') {
    return h('div', renderGathering(opts, id, c))
  }
  else return renderDefault(c)
}

function renderGathering(opts, id, c) {
  const title = h('h2', String(c.about.title))
  const startEpoch = c.about.startDateTime && c.about.startDateTime.epoch
  const time = startEpoch ? h('h3', new Date(startEpoch).toUTCString()) : ''
  const image = h('p', h('img', { src: opts.img_base + c.about.image }))
  const attending = h('h3.attending', c.numberAttending + ' attending')
  const desc = h('div')
  desc.innerHTML = marked(String(c.about.description), opts.marked)
  return h('section',
    [title,
    time,
    image,
    attending,
    desc]
  )
}

function renderPost(opts, id, c) {
  opts.mentions = {}
  if (Array.isArray(c.mentions)) {
    c.mentions.forEach(function (link) {
      if (link && link.name && link.link)
        opts.mentions[link.name] = link.link
    })
  }
  var s = h('section')
  var content = ''
  if (c.root && c.root != id)
    content += 'Re: ' + h('a',
                          { href: '/' + encodeURIComponent(c.root) },
                          c.root.substring(0, 10)).outerHTML + '<br>'
  var textHTML = marked(String(c.text), opts.marked)
  if (typeof c.contentWarning === 'string') {
    textHTML = h('details',
      h('summary', 'Content warning: ' + c.contentWarning),
      h('div', {innerHTML: textHTML})
    ).outerHTML
  }
  s.innerHTML = content + textHTML
  return s
}

function renderDefault(c) {
  return h('pre', JSON.stringify(c, 0, 2))
}

function renderShowAll(showAll, url) {
  if (!showAll)
    return '<br>' + h('a', { href : url + '?showAll' }, 'Show whole feed').outerHTML
}
