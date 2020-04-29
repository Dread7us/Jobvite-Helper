const { App } = require("@slack/bolt");
const { WebClient } = require("@slack/web-api");
const store = require("./store");
// This is only included if it is decided to use more advanced blocks (messages are currently generic)
const messages = require("./messages");
// Our variable for our Jira API call
const fetch = require("node-fetch");

// Read a token from the environment variables
const token = process.env.SLACK_TOKEN;
const jiraToken = process.env.JIRA_TOKEN;
const jiraEmail = process.env.JIRA_EMAIL;

// Initialize
const web = new WebClient(token);
// List our const variables here
const classicURL = "*`Classic URL:`* ";
const jiraURL = "*`Jira URL:`* https://jobvite.atlassian.net/browse/";
const caseURL = "*`Case Search:`* https://jobvite.my.salesforce.com/search/SearchResults?searchType=2&asPhrase=1&sen=500&str=";
const classic = "https://jobvite.my.salesforce.com/";
// Variable to pull the project name from Jira API and afterdash formatting
var projectName;
var afterDash;

const app = new App({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  token: process.env.SLACK_BOT_TOKEN
});

async function getJiraProjects () {
  // API method to pull all Jira projects
  return fetch('https://jobvite.atlassian.net/rest/api/3/project', {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${Buffer.from(
        jiraEmail + ':' + jiraToken
      ).toString('base64')}`,
      'Accept': 'application/json'
    }
  })
  .then(response => {
    console.log(
      `Response: ${response.status} ${response.statusText}\n------------------------`
    );
    return response.text();
  })
  //.then(text => console.log(text))
  .catch(err => console.error(err));
}
    
app.event("app_home_opened", async ({ event, context }) => {
  try {
    /* view.publish is the method that your app uses to push a view to the Home tab */
    const home = await app.client.views.publish({
      /* retrieves your xoxb token from context */
      token: context.botToken,

      /* the user that opened your app's app home */
      user_id: event.user,

      /* the view payload that appears in the app home*/
      view: {
        type: "home",
        callback_id: "home_view",

        /* body of the view */
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "Welcome to *Jobvite Helper*! :tada:"
            }
          },
          {
            type: "divider"
          },
          {
            type: "divider"
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "Click the *About* tab for info on Slack Commands `NOT ACTIVE`\n\n*URL Usage Examples:*"
            }
          },
          {
            type: "divider"
          },
          {
            type: "divider"
          },
          {
            "type": "section",
            "fields": [
              {
              "type": "mrkdwn",
              "text": "*Jira:* Support-1001"
              },
              {
              "type": "mrkdwn",
              "text": "*Result: `Jira URL:`* https://jobvite.atlassian.net/browse/SUPPORT-1001"
              }
            ]
          },
          {
            type: "divider"
          },
          {
            "type": "section",
            "fields": [
              {
              "type": "mrkdwn",
              "text": "*Lightning Link:* https://jobvite.lightning.force.com/lightning/r/Case/5003A00000z0FAhQAM/view456"
              },
              {
              "type": "mrkdwn",
              "text": "*Result:* " + classicURL + "https://jobvite.my.salesforce.com/5003A00000z0FAh"
              }
            ]
          },
          {
            type: "divider"
          },
          {
            "type": "section",
            "fields": [
              {
              "type": "mrkdwn",
              "text": "*Case Search:* 00803482"
              },
              {
              "type": "mrkdwn",
              "text": "*Result: `Case Search:`* https://jobvite.my.salesforce.com/search/SearchResults?searchType=2&asPhrase=1&sen=500&str=00803482"
              }
            ]
          }
        ]
      }
    });
  } catch (error) {
    console.error(error);
  }
});

async function checkKeyWords (message, array) {
  // This function is to match keywords to Jira API result names (key)
  var p;
  for (p = 0; p < array.length; p++) {
    // First split the string by the dash, use try/catch in case the character doesn't exist
    try {
      var split = message.split('-')[1];
      // Remove all characters besides numbers
      var finalString = split.replace(/[^0-9]/g, '');
    } catch (error) {
      // No need to log this, expect a bunch that will not match
    }
    // Need to match the whole word plus a dash
    var matchIt = array[p].key + "-";
    // Create our regex to match key + word
    var re = new RegExp("\\b" + matchIt + "\\b","g");
    // Ensure finalString is not empty
    if (finalString) {
      // Make sure the word matches and doesn't include an actual URL
      if (message.match(re) && !message.includes("HTTPS://") 
           && !message.includes("HTTP://") && !message.includes("WWW.")) {
        //console.log(p + " " + array[p].key + " : " + message + "True");
        // Set our project name from Jira API return
        projectName = array[p].key;
        // Set the afterDash after being cleansed
        afterDash = finalString;
        return true;
      } else {
        //console.log(p + " " + array[p].key + " : " + message + "False");
      } 
    } 
  }
}

function isNumeric(num) {
  // Just to check if the variable is numeric
  return !isNaN(num)
}

app.event("message", async ({ event, message, say }) => {
  // Keyword match
  console.log("User: " + message.user + "\nChannel: " + event.channel);
  var msg = message.text.toUpperCase();
  // Get all projects from Jira using API
  const projects = JSON.parse(await getJiraProjects());
  // Split each word out into an array
  var words = msg.split(" ");
  // Create empty array to compare results to prevent duplication
  var compareWords = [];
  var i;
  // Look through the array looking for specific keywords
  for (i = 0; i < words.length; i++) {
    //console.log(words[i]);
    // Check to see if a case number was provided, remove all chars but numbers
    var finalString = words[i].replace(/[^0-9]/g, '');
    if (finalString.length === 8) {
      // Length is right, need to see if numeric only
      if (isNumeric(finalString)) {
        // Numeric only, now check for 2 or 3 leading zeros to confirm it is a case
        if (finalString.substring(0,3) === "000" || finalString.substring(0,2) === "00") {
          // Create the response we will be sending (if not a duplicate)
          var response = caseURL + finalString;
          if (compareWords.includes(response)) {
            // Nothing to do, we don't want any duplicates
          } else {
            await say(response);
            // Add matched word to array to compare and prevent duplication
            compareWords.push(response);
          }
        }
      }
    }
    // Provide SF classic links from Lightning
    if (words[i].includes("HTTPS://JOBVITE.LIGHTNING.FORCE.COM/LIGHTNING")) {
      // Received a SF Lightning link, need to convert classic
      // First split the message into an array by the "/" character
      var bits = message.text.split("/");
      // This is the portion that contains the UID that we need
      var bitstrim = bits[6];
      // Ensure we actually have a UID to proceed
      if (bitstrim.length > 1) {
        // Need to shave off the last 3 digits of the UID to be compatible with Classic
        bitstrim = bitstrim.substring(0, bitstrim.length - 3);
        var newURL = classic + bitstrim;
        var response = classicURL + newURL;
        // Check to see if we already provided a link for one of the words
        if (compareWords.includes(response)) {
          // Nothing to do, we don't want any duplicates
        } else {
          await say(response);
          // Add matched word to array to compare and prevent duplication
          compareWords.push(response);
        }
      }
    }
    // Check to see if a word matches a Jira project + "-"
    if (await checkKeyWords(words[i], projects)) {
      var response = jiraURL + projectName + "-" + afterDash;
      // Check to see if we already provided a link for one of the words
      if (compareWords.includes(response)) {
        // Nothing to do, we don't want any duplicates
      } else {
        //console.log("Query is unique\n" + "last: " + last + "\n" + "response: " + response);
        await say(response);
        // Add matched response to array to compare and prevent duplication
        compareWords.push(response);
      }
    }
  }
});

app.error((error) => {
  // Check the details of the error to handle cases where you should retry sending a message or stop the app
  console.error(error);
});

// Start your app
(async () => {
  await app.start(process.env.PORT || 3000);
})();
