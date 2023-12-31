/**
 * CVN Overlay
 *
 * Copyright Timo Tijhof, https://gerrit.wikimedia.org/g/mediawiki/gadgets/CVNSimpleOverlay/
 *
 * SPDX-License-Identifier: MIT
 */
(function () {
  'use strict';
  var cvnApiUrl = 'https://cvn.wmcloud.org/api.php';
  var intuitionLoadUrl = 'https://meta.wikimedia.org/w/index.php?title=User:Krinkle/Scripts/Intuition.js&action=raw&ctype=text/javascript';
  var cvnLogo = 'https://upload.wikimedia.org/wikipedia/commons/c/c2/CVN_logo.svg';
  var blacklistIcon = 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/Nuvola_apps_important.svg/18px-Nuvola_apps_important.svg.png';
  var fullpagename = false;
  var userSpecCache = null;
  var canonicalSpecialPageName = mw.config.get('wgCanonicalSpecialPageName');
  var msg;

  // Construct a URL to a page on the wiki
  function wikiLink (s, targetserver) {
    return targetserver + mw.util.getUrl(s);
  }

  function parseWikiLink (input) {
    // relative to current
    var targetserver = '';
    if (input.indexOf('Autoblacklist: ') === 0) {
      var parts = input.split(' ');
      if (parts[parts.length - 2] === 'on' || parts[parts.length - 2] === 'at') {
        targetserver = 'https://' + parts[parts.length - 1] + '.org';
      }
    }

    return input.replace(/\[\[([^\]]+)\]\]/g, function (match, inner) {
      var split = inner.split('|');
      var target = split[0];
      var label = split[1] || split[0];
      // TODO: This double-escapes
      return mw.html.element('a', {
        href: wikiLink(target, targetserver),
        title: target
      }, label);
    });
  }

  function doUserSpecBox (data) {
    var comment = data.comment || '';
    var commentHtml;
    if (comment.length > 70) {
      commentHtml = mw.html.element('em',
        { style: 'cursor: help;', title: comment },
        new mw.html.Raw(mw.html.escape(comment.slice(0, 45)) + '...')
      );
    } else {
      commentHtml = '<em>' + parseWikiLink(mw.html.escape(comment)) + '</em>';
    }

    var html;
    if (data.type) {
      html = 'On <span class="cvn-overlay-list cvn-overlay-list-' + data.type + '">' + data.type + '</span>';
    } else {
      html = '<span class="cvn-overlay-list cvn-overlay-list-unlisted">Unlisted</span>';
    }

    if (data.adder) {
      html += ' added by <span style="white-space: nowrap;">' + mw.html.escape(data.adder) + '</span>';
    }

    if (data.expiry) {
      var d = new Date();
      d.setTime(data.expiry * 1000);
      html += ' <abbr style="vertical-align: super; font-size: smaller; color: purple;" title="until ' + mw.html.escape(d.toUTCString()) + '">(expiry)</abbr>';
    }

    if (commentHtml) {
      html += ': ' + commentHtml;
    }

    $('.cvn-overlay-userbox').remove();
    $('#firstHeading').before(
      '<div class="toccolours cvn-overlay-userbox">' +
        '<span class="cvn-overlay-logo" title="Counter-Vandalism Network"></span>' +
        html +
        '</div>'
    );
  }

  function getUserSpec () {
    if (userSpecCache === null) {
      userSpecCache = false;
      var val;
      if (mw.config.get('wgTitle').indexOf('/') === -1 && [2, 3].indexOf(mw.config.get('wgNamespaceNumber')) !== -1) {
        userSpecCache = mw.config.get('wgTitle');
      } else if (canonicalSpecialPageName === 'Contributions') {
        val = $.trim($('#bodyContent .mw-contributions-form input[name="target"]').val());
        if (val) {
          userSpecCache = val;
        }
      } else if (canonicalSpecialPageName === 'Log') {
        val = $.trim($('#mw-log-user').val());
        if (val) {
          userSpecCache = val;
        }
      } else if (canonicalSpecialPageName === 'Blockip') {
        val = $.trim($('#mw-bi-target').val());
        if (val) {
          userSpecCache = val;
        }
      }
    }

    return userSpecCache;
  }

  function doOverlayUsers (users) {
    var userSpec = getUserSpec();
    var userSpecDone = false;
    $.each(users, function (name, user) {
      var tooltip, d;
      if (user.type === 'blacklist') {
        tooltip = '';

        if (user.comment) {
          tooltip += msg('reason') + ': ' + user.comment + '. ';
        } else {
          tooltip += msg('reason-empty');
        }

        if (user.adder) {
          tooltip += msg('adder') + ': ' + user.adder + '. ';
        } else {
          tooltip += msg('adder') + ': ' + msg('adder-empty');
        }

        // Get expiry date
        if (user.expiry) {
          d = new Date();
          d.setTime(user.expiry * 1000);
          tooltip += msg('expiry') + ': ' + d.toUTCString();
        } else {
          tooltip += msg('expiry') + ': ' + msg('adder-empty');
        }

        // Spit it out
        $('.mw-userlink')
          .filter(function () {
            return $(this).text() === name;
          })
          .not('.cvn-overlay-list-blacklist')
          .addClass('cvn-overlay-list-blacklist')
          .prepend('<img src="' + blacklistIcon + '" alt="" title="' + mw.html.escape(tooltip) + '"/>')
          .attr('title', tooltip);
      }
      // If the current page is about one specific user,
      // and we have data about that user in 'userdata',
      // and we haven't done this already, trigger the UserSpecBox
      if (name === userSpec && !userSpecDone) {
        userSpecDone = true;
        doUserSpecBox(user);
      }
    });

    // If the current page is about one specific user, and we haven't seen that user
    // in the loop, render a generic user box instead.
    if (userSpec && !userSpecDone) {
      doUserSpecBox({});
    }
  }

  function doOverlayPage (page) {
    var text;
    if (page.comment) {
      text = msg('reason') + ': ' + parseWikiLink(mw.html.escape(page.comment)) + '. ';
    } else {
      text = msg('reason-empty');
    }

    if (page.adder) {
      text += msg('adder') + ': ' + page.adder;
    } else {
      text += msg('adder') + ': ' + msg('adder-empty');
    }

    var $node = $('<span class="cvn-overlay-pagesub" title="' + mw.html.escape(text) + '"><span class="cvn-overlay-logo" title="Counter-Vandalism Network"></span> CVN: ' + mw.html.escape(msg('globalwatched')) + '</span>');

    var parent = document.getElementById('left-navigation');
    if (parent) {
      // Vector skin
      $node.addClass('cvn-overlay-pagesub--portlet');
    } else {
      // Other skins (including MonoBook)
      parent = document.getElementById('contentSub');
    }

    $(parent)
      .find('.cvn-overlay-pagesub')
      .remove()
      .end()
      .append($node);
  }

  function checkAPI (users) {
    $.ajax({
      url: cvnApiUrl,
      // SECURITY: Use POST parameters to avoid storing personal information
      // about who is reviewing who's contributions and which articles they read.
      // Per <https://phabricator.wikimedia.org/T207900>, the full URL of cross-origin
      // fetches is is recorded in Logstash for 90 days (for potential CSP violations).
      method: 'POST',
      data: {
        users: users.join('|'),
        pages: fullpagename || ''
      },
      dataType: 'json',
      cache: true
    }).then(function (data) {
      if (data.users) {
        doOverlayUsers(data.users);
      }

      if (data.pages && data.pages[fullpagename]) {
        doOverlayPage(data.pages[fullpagename]);
      }
    });
  }

  function execute () {
    var usernamesOnPage = [];
    mw.util.addCSS('\
      .cvn-overlay-pagesub {\
        padding: 0 0.5em;\
      }\
      .cvn-overlay-pagesub--portlet {\
        display: block;\
        float: left;\
        padding: 1.25em 0.5em 0 0.5em;\
        font-size: 0.8em;\
      }\
      .cvn-overlay-pagesub:hover::after {\
        position: absolute;\
        display: block;\
        content: attr(title);\
        background: #fff;\
        color: #252525;\
        border: 1px solid #a7d7f9;\
        border-radius: 4px;\
        padding: 5px 8px;\
        max-width: 20em;\
      }\
      .cvn-overlay-userbox {\
        margin: 0;\
        padding: 0 3px;\
        float: right;\
        font-size: 13px;\
        line-height: 1.4;\
        text-align: left;\
      }\
      .cvn-overlay-logo {\
        display: inline-block;\
        background: url(' + cvnLogo + ') no-repeat 0 50%;\
        background-size: 13px;\
        width: 13px;\
        height: 13px;\
        margin-right: 3px;\
      }\
      .cvn-overlay-list-blacklist,\
      .mw-userlink.cvn-overlay-list-blacklist { color: red; }\
      .mw-userlink.cvn-overlay-list-blacklist img { vertical-align: bottom; }\
      .cvn-overlay-list-whitelist { color: teal; }\
      .cvn-overlay-list-unknown,\
      .cvn-overlay-list-unlisted { color: grey; }'
    );

    $('.mw-userlink').each(function () {
      var username = $(this).text();
      if (usernamesOnPage.indexOf(username) === -1) {
        usernamesOnPage.push(username);
      }
    });

    if (mw.config.get('wgNamespaceNumber') >= 0) {
      if (mw.config.get('wgNamespaceNumber') === 0) {
        fullpagename = '';
      } else {
        // We need fullpagename but unescaped (wgPageName is escaped like Main_Page)
        // wgTitle is unescaped but without namespace so we rebuild from namespace and wgTitle
        // if namespace is not main, then prefix namespace and colon. Otherwise no prefix.
        fullpagename = mw.config.get('wgCanonicalNamespace') + ':';
        if (fullpagename === 'File:') {
          // CVN uses Image: instead of File:
          fullpagename = 'Image:';
        }
      }
      fullpagename += mw.config.get('wgTitle');
    }

    // If the current page is about one specific user, add it to the array.
    // This could cause it to be in the array twice, but the API takes filters duplicates.
    if (getUserSpec()) {
      usernamesOnPage.push(getUserSpec());
    }

    // Only load if we have usernames and/or are on an editable/watchable/non-special page
    if (usernamesOnPage.length || fullpagename) {
      checkAPI(usernamesOnPage);
    }
  }

  function init () {
    if (!mw.libs.getIntuition) {
      mw.libs.getIntuition = $.ajax({ url: intuitionLoadUrl, dataType: 'script', cache: true });
    }

    var i18nLoad = mw.libs.getIntuition
      .then(function () {
        return mw.libs.intuition.load('cvnoverlay');
      })
      .then(function () {
        msg = $.proxy(mw.libs.intuition.msg, null, 'cvnoverlay');
      });

    $.when(mw.loader.using(['mediawiki.util']), i18nLoad, $.ready).then(execute);
  }

  // Don't load at all in edit mode unless the page doesn't exist yet (like a User-page)
  if (mw.config.get('wgAction') !== 'edit' && mw.config.get('wgAction') !== 'submit') {
    init();
  }
}());
