// Save a COPY of this script to YOUR OWN account, then click Run and grant permissions. No need to 'Deploy' unless you need to trigger remotely
// To save: click 'i-Overview' top left, then click 'Make a copy' on the right. You need to make your own copy to enable editing
// Re: permissions, you are saving this script & running it on YOUR OWN account, & sending only to YOUR OWN email address & there is NO outside access
// Useage: set a time trigger (clock icon) to run:'checkForNewPosts'. Run frequently up to 1/min for live updates, or every few hours for an overview

// Settings:
var subreddits = ['Tasker', 'GoogleAppsScript', 'Googlehome', 'ElevenLabs', 'IFTTT', 'Chromecast', 'Sheets']; // Set the subreddits to watch
var email = '???????+Reddit@gmail.com'; // Set your email address to send to (The optional '+' address format simplifies labeling if using Gmail)

// Options:
var sendOneEmailPerPost = false; // Set 'true' to send one email for every post, 'false' to concatenate posts in each subreddit into one email (recommended)
var includeTerms = ['post', 'post']; // include only posts that contain any of these words
var excludeTerms = ['excludetermsgohere', 'excludetermsgohere']; // exclude any posts that contain any of these words

// To test run your settings, add the word 'post' to 'excludeTerms' to prevent any emails being sent (as all emails will contain that word) & click Run
// Email send limit for Apps Scripts is 100/day/account. There is a function included for checking your quota. Select it and click 'Run'to chk


function checkForNewPosts() {
    var karma = '';
    for (var s = 0; s < subreddits.length; s++) {
        var subreddit = subreddits[s];
        var url = 'https://www.reddit.com/r/' + subreddit + '/new.json?sort=new';
        var response = UrlFetchApp.fetch(url);
        var data = JSON.parse(response.getContentText());
        var posts = data['data']['children'];

        // Get the timestamp of the last check
        var lastCheckKey = 'lastCheck_' + subreddit;
        var lastCheck = PropertiesService.getScriptProperties().getProperty(lastCheckKey);

        // Check if this is the first time the function is being called
        if (lastCheck === null) {
            Logger.log("saving initial datetime")
            // Set the timestamp of the last check to the current time
            PropertiesService.getScriptProperties().setProperty(lastCheckKey, new Date().getTime());
            continue;
        }

        // Check if there are any new posts from earlier hours. Advisable to 'test run' this to chk results in log. See note about using 'post' exclude word
        var timeshift = 0; // (Hrs, for testing - CAUTION! may create duplicates if not zero, but try it for instant results, or updated replies count)     
        var datum = lastCheck - (timeshift * 60 * 60 * 1000);
        //Logger.log("lastCheck: "+ lastCheck)

        if (timeshift != 0 && sendOneEmailPerPost === 'true') {
            sendOneEmailPerPost = 'false';
            Logger.log("Cannot use timeshift with sendOneEmailPerPost as it could result in too many emails. Posts will be concatenated");
        }   // delete this rule with caution. G Scripts limits quota to 100 emails per day

        var newPosts = posts.filter(function (post) {
            return post['data']['created_utc'] * 1000 > datum;
        });

        // Log the number of new posts found
        Logger.log(newPosts.length + ' new posts found in r/' + subreddit);

        if (newPosts.length > 0) {
            // Update the timestamp of the last check
            PropertiesService.getScriptProperties().setProperty(lastCheckKey, new Date().getTime());

            var includedPosts = [];
            var excludedPosts = [];

            if (sendOneEmailPerPost) {
                // Send an email notification for each new post
                for (var i = 0; i < newPosts.length; i++) {
                    var subject = 'New post on: r/' + subreddit + ': ';
                    var postUrl = 'https://www.reddit.com' + newPosts[i]['data']['permalink'];
                    var username = '<span style="color:Turquoise">' + newPosts[i]['data']['author'] + '</span>'; // username colour 
                    var flair = '';
                    if (newPosts[i]['data']['link_flair_text']) {
                        flair += '<br><br>[Flair: ';
                        var flairs = newPosts[i]['data']['link_flair_text'].split(',');
                        for (var j = 0; j < flairs.length; j++) {
                            flair += '<span style="color:' + getFlairColor(j) + '">' + flairs[j] + '</span>';
                            if (j < flairs.length - 1) flair += ', ';
                        }
                        flair += ']';
                    }
                    var numComments = newPosts[i]['data']['num_comments'] || 0; // Set default value to 0 if num_comments is undefined
                    var author = newPosts[i]['data']['author'];
                    var karma = '<span style="color:Turquoise ">' + getAuthorKarma(author) + '</span>'; // Karma colour   // set Karma colour

                    var postDate = new Date(newPosts[i]['data']['created_utc'] * 1000);
                    var hours = postDate.getHours().toString().padStart(2, '0');
                    var minutes = postDate.getMinutes().toString().padStart(2, '0');
                    var formattedTime = hours + ':' + minutes;
                    var emailQuota = MailApp.getRemainingDailyQuota();

                    // remove any hyperlinks in the text body to avoid email attachments
                    var selftext = newPosts[i]['data']['selftext'].replace(/<a\b[^>]*>/gi, "<span>").replace(/<\/a>/gi, "</span>");

                    var body =
                        '<br><br>New post on <span style="color:red">r/' +
                        subreddit +
                        '</span>: <a href="' +
                        postUrl +
                        '">' +
                        newPosts[i]['data']['title'] +
                        '</a><br> ' +
                        username +
                        '&nbsp;&nbsp;&nbsp;' +
                        'Karma:&nbsp;' + karma +
                        '<br>' +
                        'Comments: <span style="color:turquoise !important">' + numComments + '</span>' +        // number of comments colour
                        '&nbsp;&nbsp;&nbsp;' +
                        formattedTime +
                        '&nbsp;&nbsp;&nbsp;' +
                        'Email:<span style="color:turquoise !important"> ' + (emailQuota) + '</span>' +               // email count colour
                        '<br>' +
                        selftext +
                        flair +
                        '<br><a href="https://www.reddit.com/r/GoogleAppsScript/comments/1458wvw/reddit_monitor_a_new_way_to_stay_updated/" style="color: turquoise; font-size: smaller;">Reddit Monitor</a>';

                    if (shouldSendEmail(subject + body)) {
                        includedPosts.push(newPosts[i]);
                        MailApp.sendEmail({
                            to: email,
                            subject: subject,
                            htmlBody: body,
                        });
                    } else {
                        excludedPosts.push(newPosts[i]);
                    }
                }
            } else {
                // Concatenate all new posts in a subreddit into one email
                //var subject = newPosts.length + ' new posts on r/' + subreddit; // optional subject inc mail count, but count displays in Gmail anyway
                var subject = ' New posts on: r/' + subreddit;                   // 'Posts' plural used when emails are concatenated
                var body = '';
                for (var i = 0; i < newPosts.length; i++) {
                    var postUrl = 'https://www.reddit.com' + newPosts[i]['data']['permalink'];
                    var username = '<span style="color:Turquoise">' + newPosts[i]['data']['author'] + '</span>'; // username colour
                    var flair = '';
                    if (newPosts[i]['data']['link_flair_text']) {
                        flair += '<br><br>[Flair: ';
                        var flairs = newPosts[i]['data']['link_flair_text'].split(',');
                        for (var j = 0; j < flairs.length; j++) {
                            flair += '<span style="color:' + getFlairColor(j) + '">' + flairs[j] + '</span>';
                            if (j < flairs.length - 1) flair += ', ';
                        }
                        flair += ']';
                    }
                    var numComments = newPosts[i]['data']['num_comments'] || 0; // Set default value to 0 if num_comments is undefined
                    var author = newPosts[i]['data']['author'];
                    var karma = '<span style="color:Turquoise ">' + getAuthorKarma(author) + '</span>'; // Karma colour 

                    var postDate = new Date(newPosts[i]['data']['created_utc'] * 1000);
                    var formattedTime = postDate.toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: 'numeric' });

                    var emailQuota = MailApp.getRemainingDailyQuota();

                    // remove any hyperlinks in the text body to avoid email attachments
                    var selftext = newPosts[i]['data']['selftext'].replace(/<a\b[^>]*>/gi, "<span>").replace(/<\/a>/gi, "</span>");
                    var body =
                        '<br><br>New post on <span style="color:red">r/' +
                        subreddit +
                        '</span>: <a href="' +
                        postUrl +
                        '">' +
                        newPosts[i]['data']['title'] +
                        '</a><br> ' +
                        username +
                        '&nbsp;&nbsp;&nbsp;' +
                        'Karma:&nbsp;' + karma +
                        '<br>' +
                        'Comments: <span style="color:turquoise !important">' + numComments + '</span>' +        // number of comments colour
                        '&nbsp;&nbsp;&nbsp;' +
                        formattedTime +
                        '&nbsp;&nbsp;&nbsp;' +
                        'Email:<span style="color:turquoise !important"> ' + (emailQuota) + '</span>' +               // email count colour
                        '<br>' +
                        selftext +
                        flair +
                        '<br><a href="https://www.reddit.com/r/GoogleAppsScript/comments/1458wvw/reddit_monitor_a_new_way_to_stay_updated/" style="color: turquoise; font-size: smaller;">Reddit Monitor</a>';
                }
                if (shouldSendEmail(subject + body)) {
                    includedPosts.push.apply(includedPosts, newPosts);
                    MailApp.sendEmail({
                        to: email,
                        subject: subject,
                        htmlBody: body,
                    });
                } else {
                    excludedPosts.push.apply(excludedPosts, newPosts);
                }
            }

            Logger.log(includedPosts.length + ' posts included from r/' + subreddit);
            Logger.log(excludedPosts.length + ' posts excluded from r/' + subreddit);
        }
    }
    checkEmailQuota()
}

function getAuthorKarma(author) {
    var userUrl = 'https://www.reddit.com/user/' + author + '/about.json';
    var response = UrlFetchApp.fetch(userUrl);
    var data = JSON.parse(response.getContentText());
    var karma = data['data']['total_karma'];
    return karma;
}

function viewGlobalVariables() {
    // Get the script properties
    var scriptProperties = PropertiesService.getScriptProperties();

    // Get all properties
    var properties = scriptProperties.getProperties();

    // Log all properties
    for (var key in properties) {
        Logger.log(key + ': ' + properties[key]);
    }
}

function getFlairColor(index) {
    var colors = ['magenta', 'purple', 'blue', 'green']; // cycle the flair colours
    return colors[index % colors.length];
}

function shouldSendEmail(emailText) {
    emailText = emailText.toLowerCase();
    for (var i = 0; i < excludeTerms.length; i++) {
        if (emailText.indexOf(excludeTerms[i].toLowerCase()) !== -1) return false;
    }
    for (var i = 0; i < includeTerms.length; i++) {
        if (emailText.indexOf(includeTerms[i].toLowerCase()) !== -1) return true;
    }
    return includeTerms.length === 0;
}

function deleteGlobalVariables() {
    // included for tidiness
    // Get the script properties
    var scriptProperties = PropertiesService.getScriptProperties();
    // Delete all properties
    scriptProperties.deleteAllProperties();
}

function checkEmailQuota() {
    var remainingEmails = MailApp.getRemainingDailyQuota();
    Logger.log('You have ' + remainingEmails + ' emails left for today');
}
//
//   'Reddit Monitor'   u/Godberd   June 23   V1.1
//
